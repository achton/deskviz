#!/usr/bin/env bash
#
# desk.sh - Control and log standing desk height
#
# Usage: desk.sh [-f CSV_FILE] {stand|sit|status} [--save]
#

set -euo pipefail

# Configuration
DEFAULT_CSV_FILE="${HOME}/desk.csv"
OFFICE_ETH_MAC=""      # Office ethernet dongle MAC address (empty = always log)
LINAK_CONTROLLER="/mnt/c/Users/Jacob/AppData/Local/Packages/PythonSoftwareFoundation.Python.3.13_qbz5n2kfra8p0/LocalCache/local-packages/Python313/Scripts/linak-controller.exe"
DESK_MAC="C9:C0:CD:A9:D3:5A"
STANDING_HEIGHT=1040   # mm
SITTING_HEIGHT=797     # mm
TIMEOUT_SECONDS=60

# Show usage information
usage() {
    echo "Usage: $(basename "$0") [-f CSV_FILE] {stand|sit|status} [--save]" >&2
    echo "" >&2
    echo "Options:" >&2
    echo "  -f CSV_FILE    Path to CSV file (default: ~/desk.csv)" >&2
    echo "" >&2
    echo "Commands:" >&2
    echo "  stand          Move desk to standing position (${STANDING_HEIGHT}mm)" >&2
    echo "  sit            Move desk to sitting position (${SITTING_HEIGHT}mm)" >&2
    echo "  stand --save   Save current height as new standing default" >&2
    echo "  sit --save     Save current height as new sitting default" >&2
    echo "  status         Log current height to CSV" >&2
    exit 1
}

# Get current desk height
get_current_height() {
    local output height retries=3
    local start_time end_time duration
    for ((i=1; i<=retries; i++)); do
        start_time=$(date +%s.%N)
        output=$(run_with_timeout "${LINAK_CONTROLLER}" --mac-address "${DESK_MAC}" 2>&1) || true
        height=$(extract_height "${output}")
        if [[ -n "${height}" ]]; then
            end_time=$(date +%s.%N)
            duration=$(echo "${end_time} - ${start_time}" | bc)
            echo "${height}"
            echo "Connected in ${duration}s" >&2
            return 0
        fi
        end_time=$(date +%s.%N)
        duration=$(echo "${end_time} - ${start_time}" | bc)
        if [[ $i -lt $retries ]]; then
            echo "Retry $i/$retries - failed after ${duration}s, waiting..." >&2
            sleep 2
        fi
    done
    return 1
}

# Save a new height to this script
save_height() {
    local position="$1"  # "STANDING" or "SITTING"
    local new_height="$2"
    local script_path
    script_path="$(realpath "$0")"
    
    # Update the height in the script
    sed -i "s/^${position}_HEIGHT=[0-9]*/${position}_HEIGHT=${new_height}/" "${script_path}"
    echo "Saved ${position,,} height: ${new_height}mm"
}

# Move desk to target height with retries
move_to_height() {
    local target_height="$1"
    local retries=3
    local start_time end_time duration
    
    for ((i=1; i<=retries; i++)); do
        start_time=$(date +%s.%N)
        if run_with_timeout "${LINAK_CONTROLLER}" --mac-address "${DESK_MAC}" --move-to "${target_height}" 2>&1; then
            end_time=$(date +%s.%N)
            duration=$(echo "${end_time} - ${start_time}" | bc)
            echo "Completed in ${duration}s"
            return 0
        fi
        end_time=$(date +%s.%N)
        duration=$(echo "${end_time} - ${start_time}" | bc)
        if [[ $i -lt $retries ]]; then
            echo "Retry $i/$retries - failed after ${duration}s, waiting..." >&2
            sleep 3
        fi
    done
    echo "Failed to move desk after ${retries} attempts" >&2
    return 1
}

# Detect if at office desk by checking for ethernet dongle MAC address
is_at_office() {
    # If no MAC configured, always consider at office
    if [[ -z "${OFFICE_ETH_MAC}" ]]; then
        return 0
    fi
    # Use ip (Linux) or ifconfig (macOS/BSD) to find the MAC
    if command -v ip &>/dev/null; then
        ip link 2>/dev/null | grep -iq "${OFFICE_ETH_MAC}"
    else
        ifconfig 2>/dev/null | grep -iq "${OFFICE_ETH_MAC}"
    fi
}

# Detect if the screen is locked
is_screen_locked() {
    case "$(uname -s)" in
        Linux)
            # Check GNOME/Cinnamon/MATE via DBus
            if dbus-send --print-reply --dest=org.gnome.ScreenSaver /org/gnome/ScreenSaver org.gnome.ScreenSaver.GetActive 2>/dev/null | grep -q "boolean true"; then
                return 0
            fi
            # Check Freedesktop standard (KDE and others)
            if dbus-send --print-reply --dest=org.freedesktop.ScreenSaver /org/freedesktop/ScreenSaver org.freedesktop.ScreenSaver.GetActive 2>/dev/null | grep -q "boolean true"; then
                return 0
            fi
            return 1
            ;;
        Darwin)
            # macOS: Check if the loginwindow is the frontmost app or use python to check Quartz
            if python3 -c 'import sys, Quartz; d=Quartz.CGSessionCopyCurrentDictionary(); sys.exit(0 if d and d.get("CGSSessionScreenIsLocked") else 1)' 2>/dev/null; then
                return 0
            fi
            return 1
            ;;
        *)
            return 1
            ;;
    esac
}

# Cross-platform timeout wrapper
run_with_timeout() {
    # Skip timeout for Windows executables in WSL (can cause issues)
    if [[ "$1" == *.exe ]]; then
        "$@"
    elif command -v timeout &>/dev/null; then
        timeout -s SIGTERM "${TIMEOUT_SECONDS}" "$@"
    elif command -v gtimeout &>/dev/null; then
        # macOS with coreutils installed via Homebrew
        gtimeout -s SIGTERM "${TIMEOUT_SECONDS}" "$@"
    else
        # Fallback: run without timeout
        "$@"
    fi
}

# Extract height from linak-controller output (cross-platform grep)
extract_height() {
    local output="$1"
    # POSIX-compatible: match "Height: <number>" and extract the number
    echo "${output}" | sed -n 's/^Height:[[:space:]]*\([0-9]*\).*/\1/p'
}

# Generate ISO 8601 timestamp (cross-platform)
iso_timestamp() {
    case "$(uname -s)" in
        Linux)
            date -Iseconds
            ;;
        Darwin)
            date -u +"%Y-%m-%dT%H:%M:%S%z"
            ;;
        *)
            date -u +"%Y-%m-%dT%H:%M:%SZ"
            ;;
    esac
}

# Main
main() {
    local csv_file="${DEFAULT_CSV_FILE}"

    # Parse options
    while getopts ":f:h" opt; do
        case "${opt}" in
            f)
                csv_file="${OPTARG}"
                ;;
            h)
                usage
                ;;
            :)
                echo "Error: -${OPTARG} requires an argument" >&2
                usage
                ;;
            \?)
                echo "Error: Unknown option -${OPTARG}" >&2
                usage
                ;;
        esac
    done
    shift $((OPTIND - 1))

    if [[ $# -lt 1 || $# -gt 2 ]]; then
        usage
    fi

    local cmd="$1"
    local flag="${2:-}"

    case "${cmd}" in
        stand)
            if [[ "${flag}" == "--save" ]]; then
                local current_height
                current_height=$(get_current_height) || { echo "Failed to get current height" >&2; exit 1; }
                save_height "STANDING" "${current_height}"
            else
                move_to_height "${STANDING_HEIGHT}"
            fi
            ;;
        sit)
            if [[ "${flag}" == "--save" ]]; then
                local current_height
                current_height=$(get_current_height) || { echo "Failed to get current height" >&2; exit 1; }
                save_height "SITTING" "${current_height}"
            else
                move_to_height "${SITTING_HEIGHT}"
            fi
            ;;
        status)
            # Only log if at office desk
            if ! is_at_office; then
                echo "Not at office desk, skipping log"
                exit 0
            fi

            # Log 0 height if screen is locked (away from computer)
            if is_screen_locked; then
                echo "Screen is locked, logging as Away (0mm)"
                height=0
            else
                local output height retries=3
                for ((i=1; i<=retries; i++)); do
                    output=$(run_with_timeout "${LINAK_CONTROLLER}" --mac-address "${DESK_MAC}" 2>&1) || true
                    height=$(extract_height "${output}")
                    if [[ -n "${height}" ]]; then
                        break
                    fi
                    if [[ $i -lt $retries ]]; then
                        echo "Retry $i/$retries - connection failed, waiting..." >&2
                        sleep 2
                    fi
                done
            fi

            if [[ -n "${height}" ]]; then
                echo "Current height: ${height}mm"

                # Create CSV header if file doesn't exist
                if [[ ! -f "${csv_file}" ]]; then
                    echo "timestamp,height_mm" > "${csv_file}"
                fi

                echo "$(iso_timestamp),${height}" >> "${csv_file}"
                echo "Logged to ${csv_file}"
            else
                echo "Could not get height" >&2
                echo "${output}" >&2
                exit 1
            fi
            ;;
        *)
            usage
            ;;
    esac
}

main "$@"

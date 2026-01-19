#!/usr/bin/env bash
#
# desk.sh - Control and log standing desk height
#
# Usage: desk.sh [-f CSV_FILE] {stand|sit|status}
#

set -euo pipefail

# Configuration
DEFAULT_CSV_FILE="${HOME}/desk.csv"
OFFICE_ETH_MAC="20:7b:d2:97:e4:74"      # Office ethernet dongle MAC address
LINAK_CONTROLLER="${HOME}/.local/bin/linak-controller"
TIMEOUT_SECONDS=30

# Show usage information
usage() {
    echo "Usage: $(basename "$0") [-f CSV_FILE] {stand|sit|status}" >&2
    echo "" >&2
    echo "Options:" >&2
    echo "  -f CSV_FILE    Path to CSV file (default: ~/desk.csv)" >&2
    echo "" >&2
    echo "Commands:" >&2
    echo "  stand          Move desk to standing position" >&2
    echo "  sit            Move desk to sitting position" >&2
    echo "  status         Log current height to CSV" >&2
    exit 1
}

# Detect if at office desk by checking for ethernet dongle MAC address
is_at_office() {
    # Use ip (Linux) or ifconfig (macOS/BSD) to find the MAC
    if command -v ip &>/dev/null; then
        ip link 2>/dev/null | grep -iq "${OFFICE_ETH_MAC}"
    else
        ifconfig 2>/dev/null | grep -iq "${OFFICE_ETH_MAC}"
    fi
}

# Cross-platform timeout wrapper
run_with_timeout() {
    if command -v timeout &>/dev/null; then
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

    if [[ $# -ne 1 ]]; then
        usage
    fi

    case "$1" in
        stand|sit)
            run_with_timeout "${LINAK_CONTROLLER}" --move-to "$1"
            ;;
        status)
            # Only log if at office desk
            if ! is_at_office; then
                echo "Not at office desk, skipping log"
                exit 0
            fi

            local output height
            output=$(run_with_timeout "${LINAK_CONTROLLER}" 2>&1)
            height=$(extract_height "${output}")

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

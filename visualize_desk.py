#!/usr/bin/env python3
"""
Visualize standing desk usage data from a CSV file.

Shows:
- Timeline of standing vs sitting throughout each day
- Daily summary of standing/sitting time
- Overall statistics

Usage:
    visualize_desk.py [CSV_FILE]

Arguments:
    CSV_FILE    Path to the CSV file (default: ~/desk.csv)
"""

import argparse
import csv
from datetime import datetime, timedelta
from collections import defaultdict
from pathlib import Path
import sys

try:
    import matplotlib.pyplot as plt
    import matplotlib.dates as mdates
    from matplotlib.patches import Patch
except ImportError:
    print("Error: matplotlib is required. Install it with:")
    print("  pip install matplotlib")
    sys.exit(1)


# Thresholds for categorizing desk height
STANDING_THRESHOLD = 900  # mm - above this is considered standing
DEFAULT_CSV_PATH = Path.home() / "desk.csv"


def load_data(filename):
    """Load and parse the CSV data."""
    data = []
    with open(filename, "r") as f:
        reader = csv.DictReader(f)
        for row in reader:
            timestamp = datetime.fromisoformat(row["timestamp"])
            height = int(row["height_mm"])
            is_standing = height >= STANDING_THRESHOLD
            data.append(
                {"timestamp": timestamp, "height": height, "is_standing": is_standing}
            )
    return data


def calculate_durations(data):
    """
    Calculate standing/sitting durations between measurements.
    Assumes the state persists until the next measurement.
    """
    durations = []
    for i in range(len(data) - 1):
        current = data[i]
        next_entry = data[i + 1]

        # Only count duration if same day (avoid overnight gaps)
        if current["timestamp"].date() == next_entry["timestamp"].date():
            duration = (
                next_entry["timestamp"] - current["timestamp"]
            ).total_seconds() / 60  # minutes
            # Cap duration at 60 minutes to avoid counting long gaps
            duration = min(duration, 60)
            durations.append(
                {
                    "start": current["timestamp"],
                    "end": next_entry["timestamp"],
                    "duration_min": duration,
                    "is_standing": current["is_standing"],
                    "height": current["height"],
                }
            )
    return durations


def aggregate_by_day(durations):
    """Aggregate durations by day."""
    daily = defaultdict(lambda: {"standing": 0, "sitting": 0, "entries": []})

    for d in durations:
        day = d["start"].date()
        if d["is_standing"]:
            daily[day]["standing"] += d["duration_min"]
        else:
            daily[day]["sitting"] += d["duration_min"]
        daily[day]["entries"].append(d)

    return daily


def create_visualization(data, durations, daily_stats):
    """Create the visualization."""
    fig = plt.figure(figsize=(14, 10))

    # Color scheme
    standing_color = "#2ecc71"  # green
    sitting_color = "#e74c3c"  # red

    # --- Plot 1: Daily standing vs sitting bar chart ---
    ax1 = fig.add_subplot(2, 1, 1)

    days = sorted(daily_stats.keys())
    day_labels = [d.strftime("%a\n%m/%d") for d in days]
    standing_mins = [daily_stats[d]["standing"] for d in days]
    sitting_mins = [daily_stats[d]["sitting"] for d in days]

    x = range(len(days))
    width = 0.35

    bars1 = ax1.bar(
        [i - width / 2 for i in x],
        standing_mins,
        width,
        label="Standing",
        color=standing_color,
        edgecolor="white",
    )
    bars2 = ax1.bar(
        [i + width / 2 for i in x],
        sitting_mins,
        width,
        label="Sitting",
        color=sitting_color,
        edgecolor="white",
    )

    ax1.set_ylabel("Minutes")
    ax1.set_title("Daily Standing vs Sitting Time", fontsize=14, fontweight="bold")
    ax1.set_xticks(x)
    ax1.set_xticklabels(day_labels)
    ax1.legend()
    ax1.grid(axis="y", alpha=0.3)

    # Add value labels on bars
    for bar in bars1:
        height = bar.get_height()
        if height > 0:
            ax1.annotate(
                f"{int(height)}",
                xy=(bar.get_x() + bar.get_width() / 2, height),
                xytext=(0, 3),
                textcoords="offset points",
                ha="center",
                va="bottom",
                fontsize=8,
            )
    for bar in bars2:
        height = bar.get_height()
        if height > 0:
            ax1.annotate(
                f"{int(height)}",
                xy=(bar.get_x() + bar.get_width() / 2, height),
                xytext=(0, 3),
                textcoords="offset points",
                ha="center",
                va="bottom",
                fontsize=8,
            )

    # --- Plot 2: Timeline view ---
    ax2 = fig.add_subplot(2, 1, 2)

    # Group entries by day for timeline
    for idx, day in enumerate(days):
        entries = daily_stats[day]["entries"]
        for entry in entries:
            start_hour = entry["start"].hour + entry["start"].minute / 60
            duration_hours = entry["duration_min"] / 60
            color = standing_color if entry["is_standing"] else sitting_color
            ax2.barh(
                idx,
                duration_hours,
                left=start_hour,
                height=0.6,
                color=color,
                edgecolor="none",
                alpha=0.8,
            )

    ax2.set_yticks(range(len(days)))
    ax2.set_yticklabels([d.strftime("%a %m/%d") for d in days])
    ax2.set_xlabel("Hour of Day")
    ax2.set_title(
        "Daily Timeline (Standing = Green, Sitting = Red)",
        fontsize=14,
        fontweight="bold",
    )
    ax2.set_xlim(7, 18)  # Show 7 AM to 6 PM
    ax2.set_xticks(range(7, 19))
    ax2.set_xticklabels([f"{h}:00" for h in range(7, 19)])
    ax2.grid(axis="x", alpha=0.3)
    ax2.invert_yaxis()  # Most recent at top

    # Add legend
    legend_elements = [
        Patch(facecolor=standing_color, label="Standing"),
        Patch(facecolor=sitting_color, label="Sitting"),
    ]
    ax2.legend(handles=legend_elements, loc="upper right")

    plt.tight_layout()

    # --- Print summary statistics ---
    total_standing = sum(standing_mins)
    total_sitting = sum(sitting_mins)
    total_time = total_standing + total_sitting

    print("\n" + "=" * 50)
    print("STANDING DESK USAGE SUMMARY")
    print("=" * 50)
    print(f"\nDate range: {min(days)} to {max(days)}")
    print(f"Total days tracked: {len(days)}")
    print(
        f"\nTotal standing time: {total_standing:.0f} min ({total_standing / 60:.1f} hours)"
    )
    print(
        f"Total sitting time:  {total_sitting:.0f} min ({total_sitting / 60:.1f} hours)"
    )
    print(f"\nStanding percentage: {100 * total_standing / total_time:.1f}%")
    print(f"Sitting percentage:  {100 * total_sitting / total_time:.1f}%")
    print(f"\nAverage per day:")
    print(f"  Standing: {total_standing / len(days):.0f} min")
    print(f"  Sitting:  {total_sitting / len(days):.0f} min")
    print("=" * 50)

    return fig


def main():
    parser = argparse.ArgumentParser(description="Visualize standing desk usage data.")
    parser.add_argument(
        "csv_file",
        nargs="?",
        default=str(DEFAULT_CSV_PATH),
        help=f"Path to the CSV file (default: {DEFAULT_CSV_PATH})",
    )
    args = parser.parse_args()

    csv_path = Path(args.csv_file)
    if not csv_path.exists():
        print(f"Error: File not found: {csv_path}", file=sys.stderr)
        sys.exit(1)

    print(f"Loading data from {csv_path}...")
    data = load_data(csv_path)
    print(f"Loaded {len(data)} records")

    durations = calculate_durations(data)
    daily_stats = aggregate_by_day(durations)

    fig = create_visualization(data, durations, daily_stats)

    # Save and show
    output_file = csv_path.stem + "_visualization.png"
    fig.savefig(output_file, dpi=150, bbox_inches="tight")
    print(f"\nVisualization saved to {output_file}")

    plt.show()


if __name__ == "__main__":
    main()

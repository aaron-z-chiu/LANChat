"""Render the factorial LRDT completion-time heatmap from its summary CSV."""

import argparse
import csv
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.colors import LogNorm
import numpy as np


def render(summary: Path, output: Path) -> None:
    with summary.open(encoding="utf-8", newline="") as stream:
        rows = list(csv.DictReader(stream))
    losses = sorted({float(row["loss_probability"]) for row in rows})
    windows = sorted({int(row["max_window"]) for row in rows})
    grid = {(float(row["loss_probability"]), int(row["max_window"])): row for row in rows}
    if len(rows) != len(grid) or len(grid) != len(losses) * len(windows):
        raise ValueError("Summary must contain exactly one row for each loss/window pair")

    times = np.full((len(losses), len(windows)), np.nan)
    annotations = {}
    for y, loss in enumerate(losses):
        for x, window in enumerate(windows):
            row = grid[loss, window]
            successes, total = int(row["successful_trials"]), int(row["total_trials"])
            value = row["mean_completion_time_model_ms"]
            if successes:
                times[y, x] = float(value)
                label = f"{times[y, x]:,.1f}"
            else:
                label = "N/A"
            if successes != total:
                label += f"\n{successes}/{total} successful"
            annotations[y, x] = label

    finite = times[np.isfinite(times)]
    if np.any(finite <= 0):
        raise ValueError("Completion times must be positive for a logarithmic color scale")
    least = float(finite.min()) if finite.size else 1.0
    most = float(finite.max()) if finite.size else 10.0
    norm = LogNorm(vmin=least, vmax=most if most > least else 2 * least)
    cmap = matplotlib.colormaps["Blues"].resampled(256).with_extremes(bad="#edf0f3")

    with plt.rc_context({
        "font.family": "DejaVu Sans",
        "font.size": 10,
        "axes.labelsize": 11,
        "pdf.fonttype": 42,
        "figure.facecolor": "white",
        "text.color": "#182b3d",
        "axes.labelcolor": "#182b3d",
        "xtick.color": "#182b3d",
        "ytick.color": "#182b3d",
    }):
        fig = plt.figure(figsize=(7.1, 4.25))
        ax = fig.add_axes((0.145, 0.17, 0.665, 0.78))
        color_axis = fig.add_axes((0.835, 0.17, 0.027, 0.78))
        mesh = ax.pcolormesh(
            np.arange(len(windows) + 1), np.arange(len(losses) + 1), np.ma.masked_invalid(times),
            cmap=cmap, norm=norm, edgecolors="white", linewidth=1.1,
        )
        ax.set_xticks(np.arange(len(windows)) + 0.5, labels=[str(size) for size in windows])
        ax.set_yticks(np.arange(len(losses)) + 0.5, labels=[f"{100 * loss:g}" for loss in losses])
        ax.invert_yaxis()
        ax.set_xlabel("Maximum Sliding Window Size (segments)", labelpad=11)
        ax.set_ylabel("Packet Loss Probability (%)", labelpad=11)
        ax.tick_params(length=0, pad=7)
        for spine in ax.spines.values():
            spine.set_visible(False)

        for (y, x), label in annotations.items():
            value = times[y, x]
            if np.isfinite(value):
                red, green, blue, _ = cmap(norm(value))
                brightness = 0.2126 * red + 0.7152 * green + 0.0722 * blue
                color = "white" if brightness < 0.52 else "#142d43"
            else:
                color = "#142d43"
            ax.text(x + 0.5, y + 0.5, label, ha="center", va="center",
                    color=color, fontsize=8 if "\n" in label else 10)

        colorbar = fig.colorbar(mesh, cax=color_axis)
        colorbar.solids.set_rasterized(False)
        colorbar.solids.set_edgecolor("face")
        ticks = [value for value in (200, 500, 1000, 2000, 5000, 10000) if norm.vmin <= value <= norm.vmax]
        if len(ticks) >= 2:
            colorbar.set_ticks(ticks, labels=[f"{value:,}" for value in ticks])
        colorbar.minorticks_off()
        colorbar.ax.tick_params(length=2.5, labelsize=9)
        colorbar.outline.set_linewidth(0.5)
        colorbar.set_label("Mean Completion Time (model ms)\nLogarithmic color scale", labelpad=9, fontsize=9)

        output.mkdir(parents=True, exist_ok=True)
        fig.savefig(output / "loss_window_heatmap.pdf", metadata={"Title": "LRDT packet loss and sliding window"})
        fig.savefig(output / "loss_window_heatmap.png", dpi=300)
        plt.close(fig)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--summary", type=Path, default=Path("results/loss_window_2d/summary.csv"))
    parser.add_argument("--output", type=Path, default=Path("results/loss_window_2d"))
    arguments = parser.parse_args()
    render(arguments.summary, arguments.output)

#!/usr/bin/env python3
"""
APEX Dashboard Audit Script v2.0
Scores a dashboard description/spec against the APEX rubric.
Usage: python audit_dashboard.py [--input spec.md]
APEX Business Systems Ltd. © 2026
"""

import sys
import argparse
from pathlib import Path

RUBRIC = {
    "information_hierarchy": {
        "weight": 15,
        "criteria": [
            "Primary KPI identified and above-fold",
            "KPI hierarchy defined (primary/secondary/tertiary)",
            "Z/F reading pattern applied",
        ]
    },
    "chart_appropriateness": {
        "weight": 15,
        "criteria": [
            "Each chart answers exactly one question",
            "Chart type matches data type per visualization matrix",
            "No anti-pattern charts (3D, dual Y, pie>5)",
        ]
    },
    "debug_completeness": {
        "weight": 15,
        "criteria": [
            "Loading state defined for all async components",
            "Error state with retry CTA defined",
            "Empty state with actionable message defined",
            "Root cause identified before fix proposed",
        ]
    },
    "design_system_fidelity": {
        "weight": 15,
        "criteria": [
            "Semantic color system applied (success/warning/error/info)",
            "Typography scale followed (tabular-nums on values)",
            "Spacing uses 4px base unit",
            "Dark mode tokens defined",
        ]
    },
    "component_completeness": {
        "weight": 10,
        "criteria": [
            "Global date/time filter present",
            "Last refresh indicator present",
            "Export functionality (CSV/PNG) defined",
        ]
    },
    "accessibility": {
        "weight": 15,
        "criteria": [
            "WCAG 2.1 AA contrast ratios met",
            "ARIA labels on all charts",
            "Keyboard navigation defined",
            "Color not sole differentiator",
            "prefers-reduced-motion respected",
        ]
    },
    "performance": {
        "weight": 10,
        "criteria": [
            "Render budget < 16ms per chart",
            "Data memoization applied",
            "Large datasets downsampled",
            "Bundle tree-shaking applied",
        ]
    },
    "responsiveness": {
        "weight": 5,
        "criteria": [
            "Mobile breakpoint (375px) defined",
            "Tablet breakpoint (768px) defined",
            "Touch targets ≥ 44×44px on mobile",
        ]
    },
}


def interactive_audit() -> None:
    print("\n" + "="*60)
    print("APEX DASHBOARD AUDIT TOOL v2.0")
    print("Score your dashboard against the APEX rubric")
    print("="*60 + "\n")
    print("For each criterion, enter score 0–10 (or press Enter to skip):\n")

    total_weighted = 0.0
    total_weight = 0.0
    dimension_scores = {}

    for dimension, config in RUBRIC.items():
        label = dimension.replace("_", " ").title()
        print(f"\n── {label} (weight: {config['weight']}/100) ──")

        dim_scores = []
        for criterion in config["criteria"]:
            while True:
                raw = input(f"  [{criterion}] (0–10): ").strip()
                if raw == "":
                    raw = "5"  # default mid-score if skipped
                try:
                    score = float(raw)
                    if 0 <= score <= 10:
                        dim_scores.append(score)
                        break
                    print("  Enter a value between 0 and 10")
                except ValueError:
                    print("  Invalid input")

        avg_dim = sum(dim_scores) / len(dim_scores)
        weighted = (avg_dim / 10) * config["weight"]
        total_weighted += weighted
        total_weight += config["weight"]
        dimension_scores[label] = {"avg": avg_dim, "weighted": weighted, "weight": config["weight"]}
        print(f"  → Dimension score: {avg_dim:.1f}/10 | Weighted: {weighted:.1f}/{config['weight']}")

    final_score = int(total_weighted)
    print("\n" + "="*60)
    print("AUDIT RESULTS")
    print("="*60)
    for dim, scores in dimension_scores.items():
        bar = "█" * int(scores["weighted"] / scores["weight"] * 20)
        print(f"  {dim:<28} {bar:<20} {scores['weighted']:.1f}/{scores['weight']}")
    print("-"*60)
    print(f"  {'TOTAL':<28} {'':20} {final_score}/100")
    print("="*60)

    if final_score >= 85:
        print(f"✅ PASS ({final_score}/100) — Production-ready")
    elif final_score >= 70:
        print(f"⚠️  WARN ({final_score}/100) — Address failing dimensions before shipping")
    else:
        print(f"✗ FAIL ({final_score}/100) — Significant rework required")

    # Lowest dimension
    lowest = min(dimension_scores.items(), key=lambda x: x[1]["avg"])
    print(f"\nPriority fix: {lowest[0]} (score: {lowest[1]['avg']:.1f}/10)")
    print("="*60 + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="APEX Dashboard Audit Tool")
    parser.add_argument("--interactive", action="store_true", default=True,
                        help="Run interactive scoring audit")
    args = parser.parse_args()

    if args.interactive:
        interactive_audit()

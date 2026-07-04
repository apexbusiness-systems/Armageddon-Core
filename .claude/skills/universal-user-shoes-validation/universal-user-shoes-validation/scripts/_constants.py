"""Shared constants for apex-skill-forge tooling.

Single source of truth — import from both forge.py and _forge_rubric.py.
If a budget or lexicon changes, edit here only.
"""
import re

DESC_BUDGET      = 500          # APEX budget (spec hard limit below)
DESC_SPEC_MAX    = 1024         # open Agent Skills spec limit
SKILL_LINE_BUDGET = 200
BODY_TOKEN_TARGET = 2500        # estimated tokens — warn above
BODY_TOKEN_MAX   = 5000         # estimated tokens — fail above
REF_TOC_THRESHOLD = 100         # reference files longer than this need ## Contents
MIN_TRIGGER_POS  = 8
MIN_TRIGGER_NEG  = 8
NAME_RE          = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
MULTIPLIER_RE    = re.compile(r"\b(?!0x)\d+(?:\.\d+)?x\b", re.IGNORECASE)  # excludes hex
HYPE_LEXICON     = [
    "omnipotent", "omniscient", "god-mode", "god mode", "godlike",
    "world's best", "worlds best", "world-class", "revolutionary",
    "quantum leap", "ultimate", "magic", "magical", "singularity",
    "first-pass perfection", "zero-failure", "infallible",
]

#!/usr/bin/env python3
"""Validate an apex-frontend response artifact (markdown) for required sections.

Usage:
  python validate_artifact.py path/to/output.md
"""
from __future__ import annotations
import sys, re, pathlib

REQUIRED = [
  r"^1\)\s+\*\*Mode \+ Goal\*\*" ,
  r"^2\)\s+\*\*Assumptions" ,
  r"^3\)\s+\*\*Plan" ,
  r"^4\)\s+\*\*Deliverables\*\*" ,
  r"^5\)\s+\*\*Verification Gates" ,
  r"^6\)\s+\*\*Risks" ,
  r"^7\)\s+\*\*Next actions" ,
]

def main():
    if len(sys.argv) < 2:
        print("Provide a markdown file to validate.")
        return 2
    p = pathlib.Path(sys.argv[1])
    text = p.read_text(encoding='utf-8', errors='ignore')
    lines = text.splitlines()
    ok = True
    for pat in REQUIRED:
        if not re.search(pat, text, flags=re.MULTILINE):
            ok = False
            print(f"MISSING: pattern {pat}")
    if ok:
        print("PASS: required structure present")
        return 0
    print("FAIL")
    return 1

if __name__ == '__main__':
    raise SystemExit(main())

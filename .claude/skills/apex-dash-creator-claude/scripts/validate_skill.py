#!/usr/bin/env python3
"""
APEX-DASH-CREATOR Skill Validator v2.0
Validates SKILL.md integrity, section completeness, and rubric compliance.
APEX Business Systems Ltd. © 2026
"""

import re
import sys
from pathlib import Path

REQUIRED_SECTIONS = [
    "AR-7 ABSOLUTE LAWS",
    "MASTER ENTRY TREE",
    "INTENT ENGINE",
    "SECTION A",
    "SECTION B",
    "SECTION C",
    "SECTION D",
    "SECTION E",
    "SECTION F",
    "SECTION G",
    "SECTION H",
    "APEX RUBRIC",
    "DASHBOARD CATEGORY",
    "FAILURE GUARD",
]

REQUIRED_DEBUG_DOMAINS = [
    "F.1",
    "F.2",
    "F.3",
    "F.4",
    "F.5",
    "F.6",
]

MIN_TRIGGERS = 20
MIN_LINES = 400
MAX_LINES = 700

REQUIRED_FRONTMATTER_KEYS = ["name", "description", "license", "compatibility", "metadata"]


def load_skill(path: Path) -> str:
    if not path.exists():
        print(f"✗ SKILL.md not found at {path}")
        sys.exit(1)
    return path.read_text(encoding="utf-8")


def check_frontmatter(content: str) -> tuple[bool, list[str]]:
    issues = []
    if not content.startswith("---"):
        issues.append("Missing YAML frontmatter opening ---")
        return False, issues

    fm_end = content.find("---", 3)
    if fm_end == -1:
        issues.append("YAML frontmatter not closed")
        return False, issues

    frontmatter = content[3:fm_end]
    for key in REQUIRED_FRONTMATTER_KEYS:
        if key + ":" not in frontmatter:
            issues.append(f"Missing frontmatter key: {key}")

    return len(issues) == 0, issues


def check_line_count(content: str) -> tuple[bool, str]:
    lines = len(content.splitlines())
    if lines < MIN_LINES:
        return False, f"SKILL.md too short: {lines} lines (min {MIN_LINES})"
    if lines > MAX_LINES:
        return False, f"SKILL.md too long: {lines} lines (max {MAX_LINES}) — move content to references/"
    return True, f"Line count OK: {lines} lines"


def check_sections(content: str) -> tuple[bool, list[str]]:
    missing = []
    for section in REQUIRED_SECTIONS:
        if section not in content:
            missing.append(f"Missing section: {section}")
    return len(missing) == 0, missing


def check_debug_domains(content: str) -> tuple[bool, list[str]]:
    missing = []
    for domain in REQUIRED_DEBUG_DOMAINS:
        if domain not in content:
            missing.append(f"Missing debug domain: {domain}")
    return len(missing) == 0, missing


def check_trigger_count(content: str) -> tuple[bool, str]:
    # Look in manifest
    manifest_path = Path(__file__).parent.parent / "MANIFEST.json"
    if manifest_path.exists():
        import json
        manifest = json.loads(manifest_path.read_text())
        triggers = manifest.get("triggers", [])
        count = len(triggers)
        if count < MIN_TRIGGERS:
            return False, f"Insufficient triggers in MANIFEST.json: {count} (min {MIN_TRIGGERS})"
        return True, f"Trigger count OK: {count} triggers"

    # Fallback: count trigger-like phrases in SKILL.md
    trigger_keywords = re.findall(r'"([^"]+)"', content)
    if len(trigger_keywords) < MIN_TRIGGERS:
        return False, f"Insufficient trigger phrases found: {len(trigger_keywords)} (min {MIN_TRIGGERS})"
    return True, f"Trigger phrases found: {len(trigger_keywords)}"


def check_absolute_laws(content: str) -> tuple[bool, str]:
    law_count = len(re.findall(r"AR-\d", content))
    if law_count < 7:
        return False, f"Expected 7 AR laws, found {law_count}"
    return True, f"Absolute Laws present: {law_count}"


def check_rubric(content: str) -> tuple[bool, str]:
    if "APEX RUBRIC" not in content:
        return False, "Missing APEX RUBRIC section"
    if "100" not in content[content.find("APEX RUBRIC"):content.find("APEX RUBRIC")+500]:
        return False, "Rubric max score (100) not defined"
    return True, "Rubric present with scoring dimensions"


def check_failure_guard(content: str) -> tuple[bool, str]:
    if "FAILURE GUARD" not in content and "FAILURE MODE" not in content:
        return False, "Missing failure guard / failure modes section"
    return True, "Failure guard present"


def check_constitutional_lock(content: str) -> tuple[bool, str]:
    if "CONSTITUTIONAL" not in content.upper():
        return False, "Missing constitutional safety lock"
    return True, "Constitutional lock present"


def run_validation(skill_path: Path) -> None:
    content = load_skill(skill_path)
    print(f"\n{'='*60}")
    print(f"APEX-DASH-CREATOR SKILL VALIDATOR v2.0")
    print(f"File: {skill_path}")
    print(f"{'='*60}\n")

    checks = []

    # 1. Frontmatter
    ok, issues = check_frontmatter(content)
    status = "✅" if ok else "✗"
    checks.append(ok)
    if ok:
        print(f"{status} Frontmatter: All required keys present")
    else:
        for issue in issues:
            print(f"  ✗ {issue}")

    # 2. Line count
    ok, msg = check_line_count(content)
    checks.append(ok)
    print(f"{'✅' if ok else '✗'} {msg}")

    # 3. Required sections
    ok, missing = check_sections(content)
    checks.append(ok)
    if ok:
        print(f"✅ Sections: All {len(REQUIRED_SECTIONS)} required sections present")
    else:
        for m in missing:
            print(f"  ✗ {m}")

    # 4. Debug domains
    ok, missing = check_debug_domains(content)
    checks.append(ok)
    if ok:
        print(f"✅ Debug Domains: All {len(REQUIRED_DEBUG_DOMAINS)} debug domains present")
    else:
        for m in missing:
            print(f"  ✗ {m}")

    # 5. Triggers
    ok, msg = check_trigger_count(content)
    checks.append(ok)
    print(f"{'✅' if ok else '✗'} {msg}")

    # 6. Absolute laws
    ok, msg = check_absolute_laws(content)
    checks.append(ok)
    print(f"{'✅' if ok else '✗'} {msg}")

    # 7. Rubric
    ok, msg = check_rubric(content)
    checks.append(ok)
    print(f"{'✅' if ok else '✗'} {msg}")

    # 8. Failure guard
    ok, msg = check_failure_guard(content)
    checks.append(ok)
    print(f"{'✅' if ok else '✗'} {msg}")

    # 9. Constitutional lock
    ok, msg = check_constitutional_lock(content)
    checks.append(ok)
    print(f"{'✅' if ok else '✗'} {msg}")

    # Summary
    passed = sum(checks)
    total = len(checks)
    score = int(passed / total * 100)

    print(f"\n{'='*60}")
    print(f"RESULT: {passed}/{total} checks passed | Score: {score}/100")
    if score >= 85:
        print("STATUS: ✅ PASS — Skill production-ready")
    elif score >= 70:
        print("STATUS: ⚠️  WARN — Fix issues before production deploy")
    else:
        print("STATUS: ✗ FAIL — Skill not production-ready")
    print(f"{'='*60}\n")

    sys.exit(0 if score >= 85 else 1)


if __name__ == "__main__":
    skill_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).parent.parent / "SKILL.md"
    run_validation(skill_path)

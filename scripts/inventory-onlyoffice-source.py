"""Index a saved ONLYOFFICE source snapshot without importing or executing it.

Usage: python3 scripts/inventory-onlyoffice-source.py SOURCE_ROOT OUTPUT_JSON
The result distinguishes tracked source, inspected text, UI call sites and API
definitions. These counts do not establish runtime compatibility or coverage.
"""

from __future__ import annotations

import argparse
from collections import defaultdict
from pathlib import Path
import json
import re
import subprocess


SOURCE_SUFFIXES = {
    ".js", ".ts", ".tsx", ".jsx", ".c", ".cpp", ".cc", ".h", ".hpp",
    ".py", ".cs", ".java", ".go", ".rs", ".m", ".mm", ".sh", ".ps1",
}
API_PATHS = {
    "word/api.js", "cell/api.js", "pdf/api.js", "slide/api.js",
    "visio/api.js", "common/apiBase.js", "pdf/src/apiPDF.js",
}
METHOD = re.compile(r"\.prototype\.(\w+)\s*=\s*function\s*\(([^)]*)\)")
CALL = re.compile(r"\bapi\.(\w+)\s*\(")
FORMULA = re.compile(r"\bfunction\s+c_?([A-Z][A-Z0-9_]*)\s*\(")


def git(repo: Path, *args: str) -> str:
    return subprocess.check_output(["git", *args], cwd=repo, text=True).strip()


def scan(root: Path) -> dict:
    report = {
        "schemaVersion": 1,
        "root": str(root),
        "scope": "ONLYOFFICE Docs browser editors, native conversion and service source",
        "repositories": [],
        "apiDefinitions": {},
        "uiApiCalls": {},
        "formulaConstructors": [],
    }
    for name in ("web-apps", "sdkjs", "core", "server", "DocumentServer"):
        repo = root / name
        tree = git(repo, "ls-tree", "-r", "HEAD").splitlines()
        paths, submodules = [], []
        for entry in tree:
            metadata, rel = entry.split("\t", 1)
            mode, kind, oid = metadata.split()
            if kind == "commit":
                submodules.append({"path": rel, "commit": oid})
            else:
                paths.append(rel)
        modules = defaultdict(lambda: {
            "tracked": 0, "source": 0, "materializedSource": 0, "sourceLines": 0,
        })
        missing = []
        for rel in paths:
            stats = modules[rel.split("/")[0]]
            stats["tracked"] += 1
            path = repo / rel
            if path.suffix.lower() not in SOURCE_SUFFIXES:
                continue
            stats["source"] += 1
            if not path.is_file():
                missing.append(rel)
                continue
            content = path.read_text(errors="replace")
            stats["materializedSource"] += 1
            stats["sourceLines"] += content.count("\n") + 1
            if name == "sdkjs" and rel in API_PATHS:
                report["apiDefinitions"][rel] = [
                    {
                        "method": match[1],
                        "line": content.count("\n", 0, match.start()) + 1,
                        "parameters": match[2].strip(),
                    }
                    for match in METHOD.finditer(content)
                ]
            if name == "web-apps" and "/controller/" in rel and path.suffix == ".js":
                calls = [
                    {"method": match[1], "line": content.count("\n", 0, match.start()) + 1}
                    for match in CALL.finditer(content)
                ]
                if calls:
                    report["uiApiCalls"][rel] = calls
            if name == "sdkjs" and rel.startswith("cell/model/FormulaObjects/"):
                report["formulaConstructors"].extend(
                    {
                        "name": match[1], "path": rel,
                        "line": content.count("\n", 0, match.start()) + 1,
                    }
                    for match in FORMULA.finditer(content)
                )
        report["repositories"].append({
            "name": name,
            "commit": git(repo, "rev-parse", "HEAD"),
            "trackedFiles": len(paths),
            "submodules": submodules,
            "modules": dict(modules),
            "unmaterializedSourceCount": len(missing),
            "unmaterializedSource": missing,
        })
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source_root", type=Path)
    parser.add_argument("output_json", type=Path)
    args = parser.parse_args()
    report = scan(args.source_root.resolve())
    args.output_json.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    for repo in report["repositories"]:
        stats = repo["modules"].values()
        print(repo["name"], repo["commit"], repo["trackedFiles"], "tracked files;",
              sum(value["sourceLines"] for value in stats), "source lines;",
              repo["unmaterializedSourceCount"], "unmaterialized source files")
    print("API definitions:", sum(map(len, report["apiDefinitions"].values())))
    print("UI API call sites:", sum(map(len, report["uiApiCalls"].values())))
    print("Formula constructor records:", len(report["formulaConstructors"]))
    if any(repo["unmaterializedSourceCount"] for repo in report["repositories"]):
        raise SystemExit("Source index is incomplete; see unmaterializedSource.")


if __name__ == "__main__":
    main()

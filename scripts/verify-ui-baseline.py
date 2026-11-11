#!/usr/bin/env python3
"""Verify the selective upstream import without installing or executing it.

Run without arguments before the T01 commit. After native changes, use
--ref upstream-ui-baseline to verify the immutable imported snapshot.
"""

import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys


root = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--ref", help="Git snapshot to inspect instead of working files")
args = parser.parse_args()


def git(*arguments):
    return subprocess.check_output(["git", "-C", str(root), *arguments])


def read(path):
    if args.ref:
        return git("show", f"{args.ref}:{path}")
    file = root / path
    if file.is_symlink():
        raise ValueError(f"Unexpected symlink: {path}")
    return file.read_bytes()


manifest = json.loads(read("docs/sprint/ui-baseline-manifest.json"))
expected = {entry["path"] for entry in manifest["files"]}
if args.ref:
    actual = set(git("ls-tree", "-r", "--name-only", "-z", args.ref,
                     "LICENSE", "web", "docs-site").decode().strip("\0").split("\0"))
else:
    actual = {"LICENSE"} if (root / "LICENSE").is_file() else set()
    for directory in ("web", "docs-site"):
        actual.update(str(path.relative_to(root)) for path in (root / directory).rglob("*")
                      if path.is_file() or path.is_symlink())

failures = []
if expected != actual:
    failures.append(f"Path mismatch: missing={sorted(expected - actual)}, extra={sorted(actual - expected)}")
for entry in manifest["files"]:
    try:
        data = read(entry["path"])
        if len(data) != entry["bytes"] or hashlib.sha256(data).hexdigest() != entry["sha256"]:
            failures.append(f"Content mismatch: {entry['path']}")
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        failures.append(f"Unreadable import: {entry['path']}: {error}")
for entry in manifest["excluded"]:
    if entry["path"] in actual:
        failures.append(f"Excluded path imported: {entry['path']}")

if failures:
    print("\n".join(failures), file=sys.stderr)
    sys.exit(1)
print(f"Verified {len(expected)} exact files, {len(manifest['excluded'])} exclusions; "
      f"source {manifest['upstream_commit']}; target {args.ref or 'working tree'}.")

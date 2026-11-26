#!/usr/bin/env bash
# Moves the repository's pictures (the renders, the e2e baselines, the mockups' assets) into Git LFS,
# as one new commit on the current branch. History is not rewritten: the pictures already in old
# commits stay where they are, so nobody's clone breaks and no force-push is needed.
#
# Before running it:
#   1. Vercel: Project Settings → Git → turn on "Git LFS", or the next deploy builds from pointer
#      files and every picture on the site breaks.
#   2. git lfs install (once per machine).
# Then: scripts/adopt-lfs.sh, look over the commit, and push it.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
git lfs version >/dev/null
git diff --quiet && git diff --cached --quiet || { echo "Commit or stash your changes first." >&2; exit 1; }
# Track the picture types, then re-add every file so the ones already committed become LFS pointers.
git lfs track '*.png' '*.webp' '*.jpg' '*.jpeg' '*.blend' '*.glb' '*.exr' >/dev/null
git add .gitattributes
git add --renormalize .
git commit -q -m "Keep the pictures in Git LFS"
git lfs ls-files | wc -l | xargs echo "Files now in LFS:"

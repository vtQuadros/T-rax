#!/usr/bin/env bash
# Publishes a new T-rax version: bumps the version, commits, tags and pushes.
# GitHub Actions (.github/workflows/release.yml) then builds, signs and creates the release.
#
# Usage: scripts/release.sh 0.3.0
# Before running: describe the version in CHANGELOG.md under "## [0.3.0] - YYYY-MM-DD".
set -euo pipefail

VERSION="${1:-}"
cd "$(dirname "$0")/.."

if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Usage: scripts/release.sh X.Y.Z" >&2
  exit 1
fi
if [[ "$(git branch --show-current)" != "Linux" ]]; then
  echo "Releases are made from the Linux branch." >&2
  exit 1
fi
if git rev-parse -q --verify "refs/tags/v$VERSION" >/dev/null; then
  echo "Tag v$VERSION already exists." >&2
  exit 1
fi
if ! grep -q "^## \[$VERSION\]" CHANGELOG.md; then
  echo "Add a '## [$VERSION] - $(date +%F)' section to CHANGELOG.md first." >&2
  exit 1
fi
# Only the changelog may have pending edits; everything else must be committed.
if [[ -n "$(git status --porcelain -- . ':!CHANGELOG.md')" ]]; then
  echo "Commit or stash your changes first." >&2
  exit 1
fi

npm version "$VERSION" --no-git-tag-version --allow-same-version >/dev/null
sed -i "0,/^version = \".*\"/s//version = \"$VERSION\"/" src-tauri/Cargo.toml
(cd src-tauri && cargo update -p t-rax --offline -q 2>/dev/null || cargo update -p t-rax -q)

git add package.json package-lock.json src-tauri/Cargo.toml src-tauri/Cargo.lock CHANGELOG.md
git commit -q -m "Versão $VERSION"
git tag -a "v$VERSION" -m "T-rax $VERSION"
git push -q origin Linux "v$VERSION"

echo "v$VERSION pushed. Follow the build at: https://github.com/vtQuadros/T-rax/actions"

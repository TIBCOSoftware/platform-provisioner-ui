#!/bin/bash
#
# Copyright © 2025. Cloud Software Group, Inc.
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

# bump-changelog.sh — Bump Helm chart version, conditionally bump package.json,
# and generate a CHANGELOG draft from git commits.
#
# Usage: bash provisioner-webui/scripts/bump-changelog.sh
# Run from the project root directory.

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
PROJECT_ROOT=$(cd "$SCRIPT_DIR/../.." && pwd)
cd "$PROJECT_ROOT"

CHART_FILE="charts/platform-provisioner-ui/Chart.yaml"
PACKAGE_JSON="provisioner-webui/package.json"
CHANGELOG_FILE="provisioner-webui/CHANGELOG.md"
BASE_BRANCH="main"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
bump_patch() {
  local version="$1"
  local major minor patch
  IFS='.' read -r major minor patch <<< "$version"
  echo "${major}.${minor}.$((patch + 1))"
}

# ---------------------------------------------------------------------------
# Step 1: Bump Helm chart version (patch +1)
# ---------------------------------------------------------------------------
echo "==> Step 1: Bumping Helm chart version..."

if ! command -v yq &>/dev/null; then
  echo "ERROR: yq is required but not found. Install: https://github.com/mikefarah/yq"
  exit 1
fi

CHART_VERSION=$(yq '.version' "$CHART_FILE" | tr -d '"')
NEW_CHART_VERSION=$(bump_patch "$CHART_VERSION")

sed -i.bak "s/version: \"${CHART_VERSION}\"/version: \"${NEW_CHART_VERSION}\"/" "$CHART_FILE"
rm -f "$CHART_FILE.bak"
echo "  Chart.yaml: ${CHART_VERSION} -> ${NEW_CHART_VERSION}"

# ---------------------------------------------------------------------------
# Step 2: Conditionally bump package.json version
# ---------------------------------------------------------------------------
echo "==> Step 2: Checking package.json for changes..."

PKG_VERSION=$(node -p "require('./${PACKAGE_JSON}').version")

if git diff "$BASE_BRANCH" -- "$PACKAGE_JSON" | grep -q '^[+-]'; then
  NEW_PKG_VERSION=$(bump_patch "$PKG_VERSION")
  # Use node to update version to preserve JSON formatting
  node -e "
    const fs = require('fs');
    const pkg = JSON.parse(fs.readFileSync('${PACKAGE_JSON}', 'utf8'));
    pkg.version = '${NEW_PKG_VERSION}';
    fs.writeFileSync('${PACKAGE_JSON}', JSON.stringify(pkg, null, 2) + '\n');
  "
  # Sync package-lock.json version
  (cd "$(dirname "$PACKAGE_JSON")" && npm install --package-lock-only --ignore-scripts) >/dev/null 2>&1
  echo "  package.json: ${PKG_VERSION} -> ${NEW_PKG_VERSION}"
  echo "  package-lock.json: synced"
  PKG_VERSION="$NEW_PKG_VERSION"
else
  echo "  package.json: no changes detected, skipping (${PKG_VERSION})"
fi

# ---------------------------------------------------------------------------
# Step 3: Generate CHANGELOG draft from git commits
# ---------------------------------------------------------------------------
echo "==> Step 3: Generating CHANGELOG draft..."

TODAY=$(date +%Y-%m-%d)

ADDED=""
FIXED=""
CHANGED=""

while IFS= read -r msg; do
  [ -z "$msg" ] && continue
  # Skip Co-Authored-By lines
  echo "$msg" | grep -qi "co-authored-by" && continue

  if echo "$msg" | grep -qiE '^(add|feat|new)\b'; then
    ADDED="${ADDED}\n- ${msg}"
  elif echo "$msg" | grep -qiE '^fix\b'; then
    FIXED="${FIXED}\n- ${msg}"
  else
    CHANGED="${CHANGED}\n- ${msg}"
  fi
done < <(git log "$BASE_BRANCH"..HEAD --pretty=format:"%s" --no-merges)

# Build the new entry
ENTRY="## [${PKG_VERSION}] - ${TODAY}"

if [ -n "$ADDED" ]; then
  ENTRY="${ENTRY}\n### Added$(echo -e "$ADDED")"
fi
if [ -n "$FIXED" ]; then
  ENTRY="${ENTRY}\n### Fixed$(echo -e "$FIXED")"
fi
if [ -n "$CHANGED" ]; then
  ENTRY="${ENTRY}\n### Changed$(echo -e "$CHANGED")"
fi

# Check if this version already exists in CHANGELOG
if grep -q "## \[${PKG_VERSION}\]" "$CHANGELOG_FILE" 2>/dev/null; then
  echo ""
  echo "  WARNING: Version [${PKG_VERSION}] already exists in CHANGELOG.md"
  echo "  Skipping CHANGELOG update. Edit manually if needed."
else
  # Prepend to CHANGELOG
  ENTRY_TEXT=$(echo -e "$ENTRY")
  EXISTING=$(cat "$CHANGELOG_FILE")
  printf '%s\n\n%s\n' "$ENTRY_TEXT" "$EXISTING" > "$CHANGELOG_FILE"
  echo "  Added [${PKG_VERSION}] entry to CHANGELOG.md"
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo "========================================="
echo "  Summary"
echo "========================================="
echo "  Chart.yaml:   ${CHART_VERSION} -> ${NEW_CHART_VERSION}"
echo "  package.json: ${PKG_VERSION}"
echo "  CHANGELOG:    [${PKG_VERSION}] - ${TODAY}"
echo ""
echo "  Generated CHANGELOG entry:"
echo "-----------------------------------------"
echo -e "$ENTRY"
echo "-----------------------------------------"
echo ""
echo "  Please review the changes and commit."

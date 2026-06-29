#!/bin/bash
#
# Copyright (c) 2025. Cloud Software Group, Inc. All Rights Reserved. Confidential & Proprietary
#

# Move to the project root directory
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
PROJECT_ROOT=$(dirname "$SCRIPT_DIR")
cd "$PROJECT_ROOT" || { echo "❌ Failed to change to project root directory."; exit 1; }

echo "📂 Now in project root: $PROJECT_ROOT"

get_current_version() {
  local yaml_file="$1"
  local yq_path="$2"

  # Read raw value from YAML
  local raw_value
  raw_value=$(yq "$yq_path" "$yaml_file")

  if [[ -z "$raw_value" ]]; then
    echo "ERROR: Cannot read path: $yq_path" >&2
    return 1
  fi

  # Extract full version string starting with X.Y.Z
  # Example matches:
  # 1.6.13
  # 1.6.13-auto-on-prem-jammy
  # 1.6.13_rc1
  # 1.6.13+build45
  local version
  version=$(echo "$raw_value" | grep -oE '^[0-9]+\.[0-9]+\.[0-9]+.*')

  if [[ -z "$version" ]]; then
    echo "ERROR: Value does not contain valid version prefix (X.Y.Z): $raw_value" >&2
    return 1
  fi

  echo "$version"
}

set_version() {
  local yaml_file="$1"
  local current_value="$2"

  # 1) Extract X.Y.Z
  local base_version
  base_version=$(echo "$current_value" | grep -oE '^[0-9]+\.[0-9]+\.[0-9]+')

  if [[ -z "$base_version" ]]; then
    echo "ERROR: failed to detect version in: $current_value" >&2
    return 1
  fi

  # 2) bump patch version
  local major minor patch
  IFS='.' read -r major minor patch <<< "$base_version"
  local new_version="${major}.${minor}.$((patch + 1))"

  # 3) keep suffix
  local suffix="${current_value#"$base_version"}"
  local new_full="${new_version}${suffix}"

  # 4) escape special chars for sed
  local old_escaped new_escaped
  old_escaped=$(printf '%s' "$current_value" | sed 's/[\/&]/\\&/g')
  new_escaped=$(printf '%s' "$new_full" | sed 's/[\/&]/\\&/g')

  # 5) replace ONLY this exact string (preserves all formatting)
  sed -i.bak "s/$old_escaped/$new_escaped/" "$yaml_file"
  rm -f "$yaml_file.bak"

  echo "✅  Version updated:"
  echo "File: $yaml_file"
  echo "Current version: $current_value"
  echo "New version: $new_full"
}
# Define file paths
CHART_FILE="charts/platform-provisioner-ui/Chart.yaml"

chart_version=$(get_current_version "${CHART_FILE}" ".version")
set_version "${CHART_FILE}" "${chart_version}"

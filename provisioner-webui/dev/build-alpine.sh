#!/bin/bash

#
# Copyright © 2025. Cloud Software Group, Inc.
# This file is subject to the license terms contained
# in the license file that is distributed with this file.
#

BOOT_SH_ROOT=$(
  boot_sh_root=$(dirname "$0")
  cd "${boot_sh_root}" || exit
  pwd
)
readonly BOOT_SH_ROOT
cd "$BOOT_SH_ROOT" || exit

sourceDockerfile="Dockerfile.dev"

MODE=${1:-development}
# if MODE is production or production_pre, then use the production Dockerfile
if [ "$MODE" == "production" ] || [ "$MODE" == "production_pre" ]; then
    sourceDockerfile="Dockerfile"
fi

cd ../
[ -z "$GIT_BRANCH" ] && GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
[ -z "$GIT_COMMIT" ] && GIT_COMMIT=$(git rev-parse HEAD)
[ -z "$BUILD_TIME" ] && BUILD_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
[ -z "$DOCKERFILE" ] && DOCKERFILE=$sourceDockerfile

echo "------------ GIT INFO ------------"
echo "GIT_BRANCH=${GIT_BRANCH}, GIT_COMMIT=${GIT_COMMIT}, BUILD_TIME=${BUILD_TIME}, DOCKERFILE=${DOCKERFILE}"
docker build -f dev/${sourceDockerfile} \
  --build-arg GIT_BRANCH="${GIT_BRANCH}" \
  --build-arg GIT_COMMIT="${GIT_COMMIT}" \
  --build-arg BUILD_TIME="${BUILD_TIME}" \
  --build-arg DOCKERFILE="${DOCKERFILE}" \
  -t platform-provisioner/platform-provisioner-ui .


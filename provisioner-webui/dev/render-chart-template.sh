#!/bin/bash

#
# Copyright © 2025. Cloud Software Group, Inc.
# This file is subject to the license terms contained
# in the license file that is distributed with this file.
#

NAMESPACE=${1}
RELEASE=${2}

[ -n "${NAMESPACE}" ] || { >&2 echo "ERROR: Please put NAMESPACE."; exit 1; }

CHART_NAME=platform-provisioner-ui

cd ../../charts || exit

cat <<EOF> values-customize.yaml
namespace: ${NAMESPACE}
vanityDomain: provisioner-staging
dockerRegistrySecret: "yyy"

sso:
  issuer: "provisioner_stg"
  pem:
    private: "ooo"
    public: "xxx"

dockerImage: /tibcosoftware/platform-provisioner/platform-provisioner
global:
  dockerRegistry: ghcr.io
EOF

echo "Generating template ${CIC_LAYER}"
helm template --debug -n ${NAMESPACE} ${RELEASE} ${CHART_NAME} --values values-customize.yaml > template.yaml
if [ $? -ne 0 ]; then
  echo "helm template error"
  exit
fi

echo "helm lint"
helm lint -n ${NAMESPACE} ${CHART_NAME} --values values-customize.yaml

cd ../provisioner-webui/dev || exit

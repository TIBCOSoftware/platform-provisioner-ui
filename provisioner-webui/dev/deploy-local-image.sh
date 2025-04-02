#!/bin/bash
export DEPLOYMENT_NAMESPACE="tekton-tasks"
export POD_CONTAINER_NAME="platform-provisioner-ui"
export POD_IMAGE_NAME="platform-provisioner-ui"
export DEPLOYMENT_NAME="platform-provisioner-ui"
export REMOTE_VERSION=${REMOTE_VERSION:-'v1.0.5'}

if [[ "$1" == "local" ]]; then
  export dev_image_label
  dev_image_label="dev-$(date "+%Y%m%d_%H%M%S")"
  docker images | grep "${POD_IMAGE_NAME}" | grep "dev-" | awk '{print $1":"$2}' | tr -s ' ' | awk '{print $1}' | sort | uniq | xargs docker rmi

  kubectl patch deployment platform-provisioner-ui -n tekton-tasks --type='json' -p='[
  {"op": "replace", "path": "/spec/template/spec/containers/0/imagePullPolicy", "value": "Never"}
  {"op": "replace", "path": "/spec/template/spec/containers/0/securityContext/readOnlyRootFilesystem", "value": false}
]'

  docker tag "platform-provisioner/platform-provisioner-ui:latest" "${POD_IMAGE_NAME}:${dev_image_label}"
  kubectl set image "deployment/${DEPLOYMENT_NAME}" "${POD_CONTAINER_NAME}=${POD_IMAGE_NAME}:${dev_image_label}" -n "${DEPLOYMENT_NAMESPACE}"
  kubectl rollout restart "deployment/${DEPLOYMENT_NAME}" -n "${DEPLOYMENT_NAMESPACE}"
fi

if [[ "$1" == "remote" ]]; then
    kubectl patch deployment platform-provisioner-ui -n tekton-tasks --type='json' -p='[
  {"op": "replace", "path": "/spec/template/spec/containers/0/imagePullPolicy", "value": "Always"}
]'

  kubectl set image "deployment/${DEPLOYMENT_NAME}" "${POD_CONTAINER_NAME}=ghcr.io/tibco/platform-provisioner-ui/platform-provisioner-ui:${REMOTE_VERSION}" -n "${DEPLOYMENT_NAMESPACE}"
  kubectl rollout restart "deployment/${DEPLOYMENT_NAME}" -n "${DEPLOYMENT_NAMESPACE}"
fi

if [[ "$1" == "" ]]; then
  echo "Usage: $0 [local|remote]"
  echo ""
  echo "Arguments:"
  echo "  local       Deploy local dev image"
  echo "  remote      Deploy remote ghcr.io/tibco/platform-provisioner-ui/platform-provisioner-ui:${REMOTE_VERSION}"
  exit 1
fi

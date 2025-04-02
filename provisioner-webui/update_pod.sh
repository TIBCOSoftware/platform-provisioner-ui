#!/bin/bash

#
# Copyright © 2025. Cloud Software Group, Inc.
# This file is subject to the license terms contained
# in the license file that is distributed with this file.
#

BOOT_SH_ROOT=$(
  boot_sh_root=$(dirname "$0")
  cd "${boot_sh_root}" || exit 1
  pwd
)
readonly BOOT_SH_ROOT
export EXIT_STATUS=0
cd "$BOOT_SH_ROOT" || exit 1
PROJECT_ROOT="${BOOT_SH_ROOT}"
# shellcheck disable=all
source "${PROJECT_ROOT}/dev/functions.sh"

get_pod_name(){
    local name="${DEPLOYMENT_NAME}"
    local selector="app.kubernetes.io/name=${name}"
    kubectl get pods -n ${POD_NAMESPACE} --selector=${selector} -o jsonpath='{.items[0].metadata.name}'
}
get_pod_container() {
    local name="${DEPLOYMENT_NAME}"
    local selector="app.kubernetes.io/name=${name}"
    local jq_selector=".  | map( select( .name == \"${POD_CONTAINER_NAME}\" )  ) | .[0] | .name"
    kubectl get pods -n "${POD_NAMESPACE}" --selector="${selector}" -o=jsonpath='{.items[*].spec.containers}' | jq -r "${jq_selector}"
}
waiting_pod_running() {
    # Set initial value and maximum retry times
    local counter=0
    local wait_seconds=5
    local total_wait_time=${1:-15}  # Total time the function should wait, in seconds, default to 15 if not provided.
    local is_print_status=${2:-'false'}

    # Calculate maximum retries based on total wait time and wait interval (wait_seconds)
    local max_retries=$((total_wait_time / wait_seconds))

    # Loop until the Pod is ready or timeout
    while [[ $(kubectl get pod "$(get_pod_name)" -n ${POD_NAMESPACE}  | awk 'NR==2 {print $2}') != "1/1" && $counter -lt $max_retries ]]; do
      fct_print_info_msg "Waiting for pod $(get_pod_name) to be ready...($(((counter + 1) * wait_seconds)) seconds)"
      sleep ${wait_seconds}
      ((counter++))
    done

    if [[ $(kubectl get pod "$(get_pod_name)" -n ${POD_NAMESPACE}  | awk 'NR==2 {print $2}') == "1/1" && "$is_print_status" == "true" ]]; then
      fct_print_success_msg "Pod $(get_pod_name) is now running successfully."
    fi

    # If the maximum number of retries is exceeded, print an error message and exit
    if [[ $counter -eq $max_retries ]]; then
      fct_print_error_msg "Pod $(get_pod_name) did not become ready after ${total_wait_time} seconds."
      exit 1
    fi
}
pod_shell_exec(){
    kubectl exec -n "${POD_NAMESPACE}" --container "$(get_pod_container)" --stdin --tty "$(get_pod_name)" -- sh -c "${@}"
}
cp_to_pod(){
    local source=${1}
    local dest=${2}
    kubectl cp -c ${POD_CONTAINER_NAME} "${source}" "${POD_NAMESPACE}/$(get_pod_name):${dest}"
}
pod_container_reboot() {
    fct_print_info_msg "Getting process list with app.js ..."
    local process_list pid
    process_list=$(pod_shell_exec "ps -ef" | grep app.js)
    fct_print_info_msg "Process list: ${process_list}"
    pid=$(echo "${process_list}" | grep -v "sh -c" | grep -v grep | awk '{ print $1 }' | tr -d ' ')
    if [ -z "$pid" ]; then
      fct_print_error_msg "No process id with app.js found, pod reset to initial state."
      exit 1
    fi
    fct_print_info_msg "kill -SIGTERM $pid, waiting for pod restart ..."
    pod_shell_exec "kill -SIGTERM $pid"
    sleep 5

    local wait_time=60
    waiting_pod_running ${wait_time}
    process_list=$(pod_shell_exec "ps -ef" | grep app.js)
    if [ -z "$process_list" ]; then
      fct_print_error_msg "Restart pod failed, pod reset to initial state."
      fct_print_info_msg "Make sure you have changed the livenessProbe and readinessProbe periodSeconds in ${DEPLOYMENT_NAME} deployment."

      local liveness_period readiness_period periodSeconds
      liveness_period=$(kubectl get deployment ${DEPLOYMENT_NAME} -n ${POD_NAMESPACE} -o=jsonpath='{.spec.template.spec.containers[0].livenessProbe.periodSeconds}')
      readiness_period=$(kubectl get deployment ${DEPLOYMENT_NAME} -n ${POD_NAMESPACE} -o=jsonpath='{.spec.template.spec.containers[0].readinessProbe.periodSeconds}')

      periodSeconds=$((wait_time * 2))
      fct_print_warn_msg "Your current livenessProbe.periodSeconds = ${liveness_period} and readinessProbe.periodSeconds = ${readiness_period} in ${DEPLOYMENT_NAME} deployment."
      fct_print_warn_msg "Change periodSeconds to ${periodSeconds}."

      # shellcheck disable=SC2140
      fct_print_info_msg "kubectl patch deployment ${DEPLOYMENT_NAME} -n ${POD_NAMESPACE} --type='json' -p='[{"op": "replace", "path": "/spec/template/spec/containers/0/livenessProbe/periodSeconds", "value": ${periodSeconds}},{"op": "replace", "path": "/spec/template/spec/containers/0/readinessProbe/periodSeconds", "value": ${periodSeconds}}]'"
      exit 1
    fi
    fct_print_info_msg "${process_list}"
    pid=$(echo "${process_list}" | grep -v "sh -c" | grep -v grep | awk '{ print $1 }' | tr -d ' ')
    fct_print_success_msg "Restart pod success, New process id: $pid"
}

loadEnv() {
  # Make sure "docker" is installed correctly
  if [ "$(which kubectl)" ]; then
    CONTAINER_ID=$(get_pod_name)
    EXIT_STATUS=$((EXIT_STATUS + $?))
    if [ "$EXIT_STATUS" -ne 0 ] || [ -z "$CONTAINER_ID" ]; then
      fct_print_error_msg "Get pod name failed, check your network or restart your Docker."
      exit 1
    fi
  else
    fct_print_error_msg "No 'kubectl' executable found. Please install kubernetes command line tools first."
    exit 1
  fi
}

commonBuildAndCopy() {
  local build_command="${1}"    # dev build command
  local pod_folder="${2}"             # project folder in pod from pod WORKDIR folder
  local local_build_folder="${3}"     # local build folder

  local backup_folder="${POD_ROOT}/${pod_folder}.bak"

  cd "${PROJECT_ROOT}" || exit
  if [ "$IS_NPM_INSTALL" = "true" ]; then
    fct_print_info_msg "Run 'npm install --legacy-peer-deps' in ${local_build_folder} ..."
    npm install --legacy-peer-deps
  fi
  fct_print_info_msg "Deleting folder ${local_build_folder} ..."
  rm -rf "${local_build_folder}"
  fct_print_info_msg "Run '$build_command' in ${local_build_folder} ..."
  eval "$build_command"
  EXIT_STATUS=$((EXIT_STATUS + $?))
  if [ "$EXIT_STATUS" = 0 ]; then
    fct_print_info_msg "Done building UI files."
    if [ "$IS_COPY_TO_POD" = "true" ]; then
      fct_print_info_msg "cp_to_pod $(get_pod_name) ${local_build_folder} ${POD_ROOT}/${pod_folder}"
      cp_to_pod "${local_build_folder}" "${POD_ROOT}/${pod_folder}.new"
      pod_shell_exec "mv ${POD_ROOT}/${pod_folder} ${POD_ROOT}/${pod_folder}.delete && mv ${POD_ROOT}/${pod_folder}.new ${POD_ROOT}/${pod_folder} && rm -rf ${POD_ROOT}/${pod_folder}.delete"
    fi
  else
    fct_print_error_msg "Error building UI files."
    exit 1
  fi
}

buildAndCopyWebUI() {
  local build_command="npm run build:dev"    # dev build command
  local pod_folder="client"   # project folder in pod from pod WORKDIR folder
  local local_build_folder="${PROJECT_ROOT}/dist/client"   # local build folder
  if [ "$BUILD_MODE" = "prod" ]; then
    build_command="npm run build:prod"
  fi

  commonBuildAndCopy "${build_command}" ${pod_folder} "${local_build_folder}"
}

buildAndCopyWebServer() {
  local folder="server"
  local local_build_folder="${PROJECT_ROOT}/dist/${folder}"
  cd "${PROJECT_ROOT}" || exit
  fct_print_info_msg "Delete ${local_build_folder} folder"
  rm -rf "${local_build_folder}"
  fct_print_info_msg "Copying ./${folder}/* to ./dist/${folder}/ folder, excluding data/*.pem files"
  rsync -a --exclude='data/*.pem' ./${folder}/ "${local_build_folder}"
  EXIT_STATUS=$((EXIT_STATUS + $?))
  if [ "$IS_COPY_TO_POD" = "true" ]; then
    pod_shell_exec "rm -rf ${folder}"
    fct_print_info_msg "cp_to_pod ${local_build_folder} ${POD_ROOT}/"
    cp_to_pod "${local_build_folder}" ${POD_ROOT}/
    EXIT_STATUS=$((EXIT_STATUS + $?))
  fi
}

cleanAndCopyUIToPod() {
  local component
  for component in "${@}"
  do
    case $component in
      "WebUI")
        buildAndCopyWebUI
        ;;
      *)
        echo "Unknown component: $component"
        echo "Valid components are: WebUI"
        ;;
    esac
  done
}

cleanAndCopyServerToPod() {
  buildAndCopyWebServer
}

updateUI() {
  # Make sure container is running
  if [ -n "$CONTAINER_ID" ]; then
    fct_print_info_msg "Copying built UI files into the kubernetes pod container => ${CONTAINER_ID}"
    cleanAndCopyUIToPod "${@}"
    if [ "$EXIT_STATUS" -eq 0 ]; then
      if [ "$IS_COPY_TO_POD" = "true" ]; then
        fct_print_info_msg "Done copying built UI files to the kubernetes pod container => ${CONTAINER_ID}"
      fi
    else
      fct_print_error_msg "Error copying built UI files to the kubernetes pod container => ${CONTAINER_ID}"
    fi
  else
    fct_print_error_msg "No Platform platform-provisioner-ui container found. Nothing has been copied."
    return 2
  fi
}

handleServerOperation() {
  local operation=$1
  if [ -n "$CONTAINER_ID" ]; then
    if [ "$operation" = "update" ]; then
      fct_print_info_msg "Copying built Server files into the kubernetes pod container => ${CONTAINER_ID}"
      cleanAndCopyServerToPod
      if [ "$EXIT_STATUS" -eq 0 ]; then
        fct_print_info_msg "Done copying built Server files to the kubernetes pod container => ${CONTAINER_ID}"
      else
        fct_print_error_msg "Error copying built Server files to the kubernetes pod container => ${CONTAINER_ID}"
      fi
    fi
    if [ "$IS_RESTART_SERVER" = "true" ] || [ "$operation" = "restart" ]; then
      fct_print_info_msg "Restarting server ${CONTAINER_ID} ..."
      pod_container_reboot
      waiting_pod_running 30 "true"
    fi
  else
    fct_print_error_msg "No Platform platform-provisioner-ui container found. Nothing has been copied."
    return 2
  fi
}

usage() {
  printf "%b" "$BLUE"
  echo "Usage: ${0} [<arguments>]"
  echo
  echo "Available commands:"
  printf "%-25s %s\n" "arguments" "Explanation"
  printf "%-25s %s\n" "-c" "true/false, default is true, build file and copy to pod"
  printf "%-25s %s\n" "-d" "Enable shell scripts debug mode, need to be the first parameter"
  printf "%-25s %s\n" "-i" "true/false, default is true, run npm install before build"
  printf "%-25s %s\n" "-m" "dev/prod, default is dev, build project in dev or prod mode"
  printf "%-25s %s\n" "-h" "for help"
  printf "%-25s %s\n" "-r" "Restart Server node process only"
  printf "%-25s %s\n" "-s" "Build Server files"
  printf "%-25s %s\n" "-f" "(need to be the last parameter) Options: WebUI"
  printf "%-25s %s\n" "  WebUI" "build project ~/web-ui and copy file to pod"

  echo ""
  echo "Example for local kind:"
  printf "%-2s %-70s %s\n" "" "${0} -c false -f WebUI" "Only build WebUI, no copy to pod"
  printf "%-2s %-70s %s\n" "" "${0} -i false -f WebUI" "Do not run npm install before build"
  printf "%-2s %-70s %s\n" "" "${0} -m prod -f WebUI" "Build project in prod mode"
  printf "%-2s %-70s %s\n" "" "${0} -r" "Restart Server node process only"
  printf "%-2s %-70s %s\n" "" "${0} -s" "Build Server files and copy to pod"
  printf "%b" "$NC"
}

export POD_ROOT="/workspace"                                # Project files root folder in pod
export POD_CONTAINER_NAME="platform-provisioner-ui"         # Lens: Pod -> Containers Name
export DEPLOYMENT_NAME="platform-provisioner-ui"            # Lens: Deployments -> Name
# pod namespace will be different in different environment
export POD_NAMESPACE="tekton-tasks"                         # Lens: Deployments → Namespace

# ----- below variables are for local kind, it will be overwritten if env is Others ----
export KUBECONFIG="${HOME}/.kube/config"                    # Lens: Right-click sidebar icon: Settings → General → KUBECONFIG
# ----- the above variables are for local kind, it will be overwritten if env is Others ----

BUILD_MODE="dev"
IS_COPY_TO_POD="true"
IS_NPM_INSTALL="true"
IS_RESTART_SERVER="true"

[ $# -eq 0 ] && usage && exit 0
while [[ $# -gt 0 ]]; do
  key="$1"

  case $key in
    -f | --file)
      shift # past argument
      loadEnv
      updateUI "${@}"
      exit 0
      ;;
    -c | --copyToPod)
      IS_COPY_TO_POD="${2:-"true"}"
      shift # past argument
      if [[ -n "$1" && "$1" != -* ]]; then
        shift # past value if it is not empty
      fi
      ;;
    -d | --debug)
      shift # past argument
      # enable debug mode when debug mode is on
      fct_print_info_msg "Enable debug mode"
      set -x
      ;;
    -h | --help)
      HELP="true"
      shift # past argument
      ;;
    -i | --npmInstall)
      IS_NPM_INSTALL="${2:-"true"}"
      shift # past argument
      if [[ -n "$1" && "$1" != -* ]]; then
        shift # past value if it is not empty
      fi
      ;;
    -m | --mode)
      BUILD_MODE="${2:-"dev"}"
      shift # past argument
      if [[ -n "$1" && "$1" != -* ]]; then
        shift # past value if it is not empty
      fi
      ;;
    -r | --restart)
      shift # past argument
      loadEnv
      handleServerOperation "restart"
      exit 0
      ;;
    -s | --server)
      IS_RESTART_SERVER="${2:-"true"}"
      shift # past argument
      if [[ -n "$1" && "$1" != -* ]]; then
        shift # past value if it is not empty
      fi
      loadEnv
      handleServerOperation "update"
      exit 0
      ;;
    --default)
      HELP="true"
      shift # past argument
      ;;
  esac
done

if [ "${HELP}" == "true" ]; then
  usage
  exit 0
fi

# close debug mode
set +x

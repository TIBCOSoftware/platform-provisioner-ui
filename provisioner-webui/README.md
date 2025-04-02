# Running from source

## Prerequisite

* Running kubernetes cluster (Docker Desktop in following sample)
* Install the tekton and pipelines in the kubernetes cluster
```bash
export PIPELINE_SKIP_PROVISIONER_UI=true
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/TIBCOSoftware/platform-provisioner/main/dev/platform-provisioner-install.sh)"
```
* [nvm](https://github.com/nvm-sh/nvm) installed (optional but suggested)

Use environment variable `TEKTON_PIPELINE_RELEASE` to specify the version of tekton-pipelines to install. The default value is `v0.41.2`.

### How to know the current `TEKTON_PIPELINE_RELEASE` version?
```
# make sure the namespace of `tekton-pipelines` has been created
kubectl get ns | grep tekton-pipelines

# get the current installed version of tekton-pipelines
kubectl get pod -n tekton-pipelines -l app=tekton-pipelines-controller -o jsonpath="{.items[*].metadata.labels['pipeline\.tekton\.dev/release']}"
```

## Project setup
`npm install`

### Compiles and hot-reloads for development
* Change your kubeconfig to point to your local k8s

### Customize configuration
See [Configuration Reference](https://cli.vuejs.org/config/).

## How to run the server in local?

1. start the node server (does not support for hot reload without watching source code change)
   Clone platform provisioner repo: https://github.com/tibco/platform-provisioner 
   ```shell
   export TEKTON_API_VERSION=v1        # for v1, v0.58.0 latest
   export START_FROM_SOURCE=true
   export PIPELINE_TEMPLATE_LABEL_KEY_ACCOUNT="env.cloud.tibco.com/account"
   export PIPELINE_TEMPLATE_LABEL_KEY_ACTION="env.cloud.tibco.com/action"
   export PIPELINE_TEMPLATE_LABEL_KEY_CONFIG="env.cloud.tibco.com/config"
   export PIPELINE_TEMPLATE_LABEL_KEY_CONFIG_GROUPS="env.cloud.tibco.com/config-groups"
   export PIPELINE_TEMPLATE_LABEL_KEY_CREATE_BY="env.cloud.tibco.com/create-by"
   export PIPELINE_TEMPLATE_LABEL_KEY_NAME="env.cloud.tibco.com/name"
   export PIPELINE_TEMPLATE_LABEL_KEY_NOTE="env.cloud.tibco.com/note"
   export PIPELINE_TEMPLATE_LABEL_VALUE="pipeline-gui-config"
   export ON_PREM_MODE=true
   export START_FROM_SOURCE=true
   export PIPELINES_CLEAN_UP_ENABLED=true
   
   # Optional: see the pipeline menu config in local
   export PIPELINE_MENU_CONFIG=<path to platform-provisioner repo>/charts/provisioner-config-local
   
   npm run start:local
   ```
2. open http://127.0.0.1:81/ in Chrome browser

## How to run the server in local for dev mode (for developers, watching code change, hot reload source code change)?
### Hot reload for local development (Local dev steps)
1. start the vue hot reload server, then build UI code in dev mode and start local project server
   ```shell
   export TEKTON_API_VERSION=v1        # for v1, v0.58.0 latest
   
   npm run build:client:dev   # build UI client code in development mode
   # run below command in different terminal
   npm run watch-build        # watch UI code change in development mode
   npm run preview            # preview UI code after UI build
   npm run start:local:dev    # start server in local, and watch code change
   ```
2. open http://127.0.0.1:81/ in Chrome browser

## Questions:
### How to create a pipeline for Status page?

1. Go to Pipeline page.
2. Select any AWS account.
3. Select pipelines: "generic-runner-task"
    ```yaml
    tasks:
      - script:
          ignoreErrors: false
          base64Encoded: false
          skip: false
          fileName: script.sh
          content: |
            echo "hello"
    ```
4. Click `Run` button.
5. Go to `Status` page to verify the task status.

### How to know the API that kubectl calls when kubectl command is executed

* Add the -v=9 to kubectl command to see the API that kubectl calls
* Please refer to https://kubernetes.io/docs/reference/kubectl/cheatsheet/#kubectl-output-verbosity-and-debugging

For example
```
kubectl get -v=9 pods -A -n tekton-tasks
kubectl get -v=9 taskrun -n tekton-tasks -o json
kubectl get -v=9 taskrun -n tekton-tasks -o json generic-runner-840364868265-36-generic-runner
```

Check the current tasks
```
kubectl get pipelinerun -A --sort-by='.status.startTime'
```

### How to read the `*.md` file in the project?

1. Add the `*.md` file
   * Local: in the `./provisioner-webui/server/data` folder
   * Remote: in the `./charts/provisioner-config-cloud/config` folder
   * AWS Pod: in the `/workspace/data` folder
2. Update the `configmap.md` in the `provisioner-webui/server/config.json` file
   * Note: keep the `md` key and the `*.md` file name the same
   * Note: the value is the path to the `*.md` file
    ```json
    {
      "configmap": {
        "md": {
          "connectDetailsPage": "/workspace/data/connectDetailsPage.md",
          "xyz": "/workspace/data/xyz.md"
        }
      }
    }
    ```
3. Add the md file link in the menuContent.yaml file
   * Note: the path in the `to` value `xyz` should be the same as the `*.md` file name
    ```yaml
    - label: "Md to html"
      to: "/docs/xyz"
      icon: 'pi pi-cog'
    ```

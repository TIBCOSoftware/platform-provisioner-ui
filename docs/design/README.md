# Platform Provisioner UI Configuration

## Overview

The Platform Provisioner UI is a web-based user interface that allows users to manage pipelines and recipes. 
The GUI menu is fully config driven and can be extended to fit your needs. By default, the UI is designed for the [TIBCO Platform](https://www.tibco.com/platform).
The default GUI menu config can be found in [provisioner-config-local](https://github.com/TIBCOSoftware/platform-provisioner/tree/main/charts/provisioner-config-local)

The Platform Provisioner UI support following features:
* SSO login
* Trigger the tekton pipelineruns and inject labels
* Retrieve and Show the pipeline logs

## Dynamic Config Driven Menu

The dynamic config menu data is stored as helm chart. The helm chart will create one or more configmaps in the kubernetes cluster. 
The configmaps will be mounted to the UI pod as volume on `/workspace/data`. The UI will read the configmaps and render the menu.

By default, the provisioner-config-local helm chart creat a configmap named `provisioner-config-local-config` in the kubernetes cluster.
It will read all the files in the `config` folder. The `config` folder contains:
* `tenantList.yaml`: This will act as user/team management config file. The UI will read this file to determine the user/team access control.
* `menuContent.yaml`: The menu UI on the top of the GUI. This will point to specific sub-menu UI config files.
  *  The pipeline to use for the sub-menu UI is defined on this config file.
* `pp-*.yaml`: The actual sub-menu UI config files. 

## Sub-menu UI Config

The sub-menu UI config files have the following parts:
* `pipelineName`: The name of the pipeline. This will be shown in the UI.
* `pipelineDescription`: The description of the pipeline. This will be shown in the UI.
* `options`: The options for the UI element.  
* `recipe`: The recipe to use for the pipeline.

For more details on the sub-menu UI config, please refer to the [README.md](../../provisioner-webui/docs/README.md)

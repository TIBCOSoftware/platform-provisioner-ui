# Platform Provisioner UI by TIBCO®

This project is the UI for the [Platform Provisioner](https://github.com/TIBCOSoftware/platform-provisioner) by TIBCO®. 
This UI provides a way to manage recipes. 

## Why Platform Provisioner UI?

The Platform Provisioner UI is designed the best fit for the following use cases:
* Developer/DevOps engineer wants to manage recipes for the platform provisioning.
* SRE/DevOps engineer wants to manage the recipes for the operation tasks.
* Platform team wants to provide a zero trust provisioning system for multi-cloud environment.
* Platform team wants to dynamically provision a platform infrastructure and applications on demand.
* Platform team wants to provide a self-service provisioning system for the developers.
* Platform team wants to eliminate toil between teams.

## Getting Started

The platform provisioner UI needs to work with the [Platform Provisioner](https://github.com/TIBCOSoftware/platform-provisioner) runs in kubernetes cluster.

### Prerequisite
* Running kubernetes cluster (Docker Desktop in following sample)

### Run the Platform Provisioner UI

```bash
export PIPELINE_GUI_SERVICE_PORT=8080
export PIPELINE_GUI_SERVICE_TYPE=LoadBalancer
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/TIBCOSoftware/platform-provisioner/main/dev/platform-provisioner-install.sh)"
```

Access http://localhost:8080/ to see the UI. The UI is fully customizable and can be extended to fit your needs. By default, the UI is fit for the [TIBCO Platform](https://www.tibco.com/platform).

---
Copyright 2025 Cloud Software Group, Inc.

License. This project is Licensed under the Apache License, Version 2.0 (the "License").
You may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and limitations under the License.

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

FROM --platform=${BUILDPLATFORM} node:22 AS builder
ARG GIT_COMMIT
ENV GIT_COMMIT=${GIT_COMMIT}
WORKDIR /workspace/
ADD . /workspace/
RUN npm ci
RUN npm run build:prod

# Remove devDependencies and keep production dependencies
RUN npm prune --production

FROM node:22-alpine
WORKDIR /workspace/
COPY --chown=1000:1000 --from=builder /workspace/dist /workspace/
COPY --chown=1000:1000 --from=builder /workspace/node_modules /workspace/node_modules

# Define build arguments
ARG GIT_BRANCH
ARG GIT_COMMIT
ARG BUILD_TIME
ARG DOCKERFILE

# Set the environment variables
ENV GIT_BRANCH=${GIT_BRANCH}
ENV GIT_COMMIT=${GIT_COMMIT}
ENV BUILD_TIME=${BUILD_TIME}
ENV DOCKERFILE=${DOCKERFILE}

ENTRYPOINT [ "node", "server/app.js" ]
EXPOSE 80

#
# Copyright © 2025. Cloud Software Group, Inc.
# This file is subject to the license terms contained
# in the license file that is distributed with this file.
#

FROM --platform=${BUILDPLATFORM} node:22 AS builder
WORKDIR /workspace/
ADD . /workspace/
RUN npm ci
RUN npm run build:prod

# Remove devDependencies and keep production dependencies
RUN npm prune --production

FROM node:22-alpine
WORKDIR /workspace/
COPY --from=builder /workspace/dist /workspace/
COPY --from=builder /workspace/node_modules /workspace/node_modules

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

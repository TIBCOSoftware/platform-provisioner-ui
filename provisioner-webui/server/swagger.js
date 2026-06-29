/*
 * Copyright © 2025. Cloud Software Group, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const swaggerJsdoc = require('swagger-jsdoc');
const { koaSwagger } = require('koa2-swagger-ui');
const Router = require('koa-router');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Platform Provisioner API',
      version: '1.0.0',
      description: 'REST API for the TIBCO Platform Provisioner. Supports pipeline triggering, status monitoring, log retrieval, and recipe management.'
    },
    components: {
      securitySchemes: {
        BasicAuth: {
          type: 'http',
          scheme: 'basic',
          description: 'Base64-encoded username:password. Configure credentials in tenantList.yaml.'
        }
      }
    },
    security: [{ BasicAuth: [] }],
    tags: [
      { name: 'recipe', description: 'Recipe template management' },
      { name: 'pipeline', description: 'Pipeline run lifecycle — trigger, list, status, cancel' },
      { name: 'log', description: 'Container log retrieval' },
      { name: 'payload', description: 'Save and load deployment payloads' },
      { name: 'cluster', description: 'EKS cluster provisioning and teardown' },
      { name: 'chart', description: 'Helm chart operations' }
    ]
  },
  apis: [__dirname + '/routes/api.js']
};

const swaggerSpec = swaggerJsdoc(options);

const swaggerUI = koaSwagger({
  routePrefix: false,
  swaggerOptions: {
    url: '/swagger.json'
  }
});

const specRouter = new Router();
specRouter.get('/swagger.json', (ctx) => {
  ctx.body = swaggerSpec;
});

module.exports = { swaggerSpec, swaggerUI, specRouter };

/*
 * Copyright © 2025. Cloud Software Group, Inc.
 * This file is subject to the license terms contained
 * in the license file that is distributed with this file.
 */

const Koa = require('koa');
const path = require('path');
const router = require('./router');
const http = require('http');
const compress = require('koa-compress');
const conditional = require('koa-conditional-get');
const etag = require('koa-etag');
const fs = require("fs");
const { execSync } = require('child_process');
const isOnPrem = process.env.ON_PREM_MODE === 'true';

const app = new Koa();
console.log("--- Env --- Start ---");
// when running in watch code mode in local dev, get git info
if (process.env.DEV_IS_WATCH_CODE === 'true') {
  process.env.GIT_BRANCH = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
  process.env.GIT_COMMIT = execSync('git rev-parse HEAD').toString().trim();
  process.env.BUILD_TIME = new Date().toISOString();
  process.env.DOCKERFILE = "no dockerfile, local dev server";
}
console.log("Git info:", process.env.GIT_BRANCH, process.env.GIT_COMMIT, process.env.BUILD_TIME, process.env.DOCKERFILE);
console.log("TEKTON_API_VERSION =", process.env.TEKTON_API_VERSION || "", ", PIPELINE_MENU_CONFIG =", process.env.PIPELINE_MENU_CONFIG || "");
console.log("ON_PREM_MODE =", process.env.ON_PREM_MODE || "", ", PLATFORM_PROVISIONER_UI_SERVICE_PORT =", process.env.PLATFORM_PROVISIONER_UI_SERVICE_PORT || "");
console.log("DEV_IS_WATCH_CODE =", process.env.DEV_IS_WATCH_CODE || "", ', DEV_START_FROM_SOURCE =', process.env.DEV_START_FROM_SOURCE || "", ', NODE_ENV =', process.env.NODE_ENV || "");
console.log("Project start with tekton version", process.env.TEKTON_API_VERSION || "");
console.log("--- Env --- End ---");

// gzipped
app.use(compress({
  threshold: 2048,
  gzip: {
    flush: require('zlib').constants.Z_SYNC_FLUSH
  },
  deflate: {
    flush: require('zlib').constants.Z_SYNC_FLUSH,
  },
  br: false // disable brotli
}));

// use koa-conditional-get to handle conditional requests
app.use(conditional());
// use koa-etag to generate ETag response header
app.use(etag());

/* read config */

const nconf = require('nconf');
nconf.env();
const config = path.normalize(path.join(__dirname, 'config.json'));
if (fs.existsSync(config)) {
  nconf.file('default', config);
}

const configMap = require('./configmap');
configMap.init();

let passport = null;

if (!isOnPrem) {
  passport = require('./passport');
  passport.init();
}

/* Configure routes */
router(app);

/* Start listening for web requests */
const isDev = process.env.NODE_ENV === 'development';
// const serverPort = isDev ? nconf.get('web:devPort') : nconf.get('web:port');

// see the port, devPort, and host in the config.json file
let serverPort = nconf.get('web:port');
if (isDev) {
  serverPort = nconf.get('web:devPort')
} else if (process.env.PLATFORM_PROVISIONER_UI_SERVICE_PORT) {
  serverPort = process.env.PLATFORM_PROVISIONER_UI_SERVICE_PORT.toString();
}
const serverHostname = nconf.get('web:host');
const server = http.createServer(app.callback());

server.listen(serverPort, serverHostname, function(e) {
  if (e) {
    if (e.code === 'EADDRINUSE') {
      console.error('Cannot start web server on %s:%d, address already in use.', server.address().address, server.address().port);
    }
  } else {
    console.log('Web server started on port %s:%d', server.address().address, server.address().port);
  }
});

/* Shutdown hook */
process.on('exit', function () {
  console.log('Existing web server');
});

/* Catch uncaught exceptions to prevent a process from exiting */
process.on('uncaughtException', function (err) {
  // logger.log(logger.LOG_ERROR, "TSC-WS", thisFileName, "Error" + JSON.stringify(err));
  console.error('UncaughtException %j', err);
});

module.exports = server;

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

const { koaBody } = require('koa-body');
const Static = require('koa-static');

const wsRoutes = require('./routes/ws');
const apiRoutes = require('./routes/api');
const { swaggerUI, specRouter } = require('./swagger');

const session = require('koa-session');
const Router = require('koa-router');
const _ = require('lodash');

const cookieKey = 'cic2-provisioner';

const configMap = require('./configmap');
const isDev = process.env.NODE_ENV === 'development';
const isOnPrem = process.env.ON_PREM_MODE === 'true';
const isWatchCode = process.env.DEV_IS_WATCH_CODE === 'true';
const formAuthEnabled = process.env.FORM_AUTH_ENABLED === 'true';
const formAuthUser = process.env.FORM_AUTH_USER || '';
const formAuthPassword = process.env.FORM_AUTH_PASSWORD || '';
// the port is for local development server, see preview.port in the vite.config.ts file
const devServerPort = "8081";

let koaPassport = null;

if (!isOnPrem) {
  koaPassport = require('./passport').passport;
}

const addRoutes = function (app) {
  // passport
  if (!isOnPrem) {
    app.use(koaPassport.initialize());
  }

  const ssoConfig = !isOnPrem ? configMap.getSsoConfig() : {};

  let timeoutInHours = _.has(ssoConfig,'sso.timeoutInHours') && ssoConfig['sso']['timeoutInHours'] ?
    ssoConfig['sso']['timeoutInHours'] : 8;

  //login/logout callbacks
  let loginCallback = _.has(ssoConfig,'sso.loginCallbackPath') && ssoConfig['sso']['loginCallbackPath'] ?
    ssoConfig['sso']['loginCallbackPath'] : '/saml/acscallback';
  let logoutCallback =  _.has(ssoConfig,'sso.logoutCallbackPath') && ssoConfig['sso']['logoutCallbackPath'] ?
    ssoConfig['sso']['logoutCallbackPath'] : '/auth/logout';

  // sessions — key derived from build commit; all sessions invalidate on upgrade
  app.keys = [process.env.GIT_COMMIT || 'dev'];
  app.use(session({
    key: cookieKey,
    maxAge: timeoutInHours * 60 * 60 * 1000,
    httpOnly: true,
    overwrite: true,
    signed: true
  }, app));
  if (!isOnPrem) {
    app.use(koaPassport.session());

    // Node: fixed issue req.session.regenerate is not a function
    // https://github.com/jaredhanson/passport/issues/904#issuecomment-1307558283
    // register regenerating & save after the cookieSession middleware initialization
    app.use(async (ctx, next) => {
      if (ctx.session && !ctx.session.regenerate) {
        ctx.session.regenerate = (cb) => {
          cb();
        };
      }
      if (ctx.session && !ctx.session.save) {
        ctx.session.save = (cb) => {
          cb();
        };
      }
      await next();
    });
  }

  app.use(koaBody());

  // authMiddleware
  const authMiddleware = async (ctx, next) => {
    // todo: find a better way to handle this

    if (ctx.session && ctx.session.passport && ctx.session.passport.user) {
      ctx.state.user = ctx.session.passport.user;
      await next();
    } else {
      console.log('redirecting for SAML login');
      ctx.redirect('/auth/login');
    }
  };

  // auth Routes
  const authRouter = new Router();
  // Expose auth config so frontend knows which login methods are available
  authRouter.get('/auth/config', async (ctx) => {
    ctx.body = {
      formAuthEnabled: formAuthEnabled,
      samlEnabled: !isOnPrem && !isDev
    };
  });

  // Local username/password login
  if (formAuthEnabled) {
    authRouter.post('/auth/local-login', async (ctx) => {
      const { email, password } = ctx.request.body;
      if (email === formAuthUser && password === formAuthPassword) {
        ctx.session.passport = {
          user: {
            email: email,
            firstName: email.split('@')[0],
            lastName: '',
            nameID: email,
            nameIDFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified',
          }
        };
        ctx.body = { success: true };
      } else {
        ctx.status = 401;
        ctx.body = { success: false, message: 'Invalid email or password' };
      }
    });
  }

  authRouter.get('/auth/login',
    async (ctx, next) => {
      if ((isDev || isOnPrem) && !formAuthEnabled) {
        const mockUserData = configMap.getMockUser();
        const mockUser = mockUserData["mockUser"];
        ctx.session.passport = {
          user: mockUser
        };
        ctx.redirect('/');
      } else if (formAuthEnabled && (isDev || isOnPrem)) {
        // Local auth is enabled, redirect to login page instead of auto-login
        ctx.redirect('/login');
      } else {
        ctx.session.callbackUrl = ctx.query.callbackUrl;
        await next();
      }
    },
    !isOnPrem ? koaPassport.authenticate('saml') : () => {}
  );

  // Local auth logout: clear session and redirect to login page
  if (formAuthEnabled) {
    const localLogout = async (ctx) => {
      ctx.session = null;
      ctx.cookies.set(cookieKey, null);
      ctx.cookies.set(`${cookieKey}.sig`, null);
      ctx.redirect('/login');
    };
    authRouter.get('/auth/logout', localLogout);
    authRouter.post('/auth/logout', localLogout);
  }

  if (!isOnPrem) {
    authRouter.post(loginCallback,
      koaPassport.authenticate('saml'),
      ctx => {
        let callbackUrl = '/';
        if (ctx.session.callbackUrl) {
          callbackUrl = ctx.session.callbackUrl;
          delete ctx.session.callbackUrl;
        }
        ctx.redirect(callbackUrl);
      }
    );

    authRouter.post(logoutCallback,
      koaPassport.logoutSamlCallback,
      ctx => {
        ctx.cookies.set(cookieKey, null);
        ctx.cookies.set(`${cookieKey}.sig`, null);
        ctx.redirect('/login');
      }
    );
  }

  // authRouter.post('/auth/logout', async (ctx, next) => {
  //     console.log('[router.js] Receive the /auth/logout request, start to destroy session and delete cookie');
  //     ctx.session = null;
  //     ctx.cookies.set(cookieKey, null);
  //     ctx.cookies.set(`${cookieKey}.sig`, null);
  //     await next();
  // },
  // koaPassport.authenticate('saml'),
  // async (ctx, next) => {
  //     console.log('[router.js] Finish the logout and start to redirect');
  //     ctx.redirect('/');
  // });

  app.use(require('koa-json')(app));

  // When user opens following url in browser, should return a correct HTML file:
  app.use(async (ctx, next) => {
    const path = ctx.path.endsWith('/') ? ctx.path.substring(0, ctx.path.length - 1) : ctx.path;
    if (!path.toLowerCase().startsWith('/cic2-ws/') &&
      !path.toLowerCase().startsWith('/cic2/public') &&
      !path.toLowerCase().startsWith('/auth/') &&
      !path.toLowerCase().startsWith('/api-docs') &&
      !path.toLowerCase().startsWith('/swagger.json') &&
      !path.toLowerCase().startsWith('/mcp') &&
      !path.toLowerCase().startsWith('/oauth/') &&
      !path.toLowerCase().startsWith('/.well-known/') &&
      !path.toLowerCase().startsWith(loginCallback.trim()) &&
      !path.toLowerCase().startsWith(logoutCallback.trim()) &&
      !/\/[^/]+\.[^./]+$/i.test(path)) {
      ctx.path = '/';
    } else if (isDev && isWatchCode && (
      path.startsWith('/index.html') || path.startsWith('/assets/') ||
      path.startsWith('/js/') || path.startsWith('/css/') || path.startsWith('/img/') || path.startsWith('/yaml_linter/')
    )) {
      ctx.redirect(`http://localhost:${devServerPort}${path}`);
      return;
    }
    await next();
  });

  const path = require('path');
  const webDir = path.normalize(path.join(__dirname, '..', isDev ? '/dist/client' : '/client'));

  app.use(Static(webDir, {
    maxage: 365 * 24 * 60 * 60 * 1000,
    gzip: true,
    brotli: false
  }));

  // Note: MUST be after the above Static middleware
  app.use(async (ctx, next) => {
    await next();

    if ((ctx.path === '/' || ctx.path.endsWith('index.html')) && ctx.status === 200) {
      ctx.set('Cache-Control', 'no-cache');
    }
  });

  // Swagger UI and spec
  app.use(specRouter.routes());
  app.use(specRouter.allowedMethods());
  app.use(async (ctx, next) => {
    if (ctx.path === '/api-docs') {
      return swaggerUI(ctx, next);
    }
    await next();
  });

  app.use(authRouter.routes());

  // Adding all available routes
  // wsRoutes.public.use(authMiddleware);
  app.use(wsRoutes.public.routes());

  // apiRoutes.use(authMiddleware);
  app.use(apiRoutes.routes());

  wsRoutes.secure.use(authMiddleware);
  app.use(wsRoutes.secure.routes());

  // MCP routes (OAuth2 public + Bearer-protected MCP endpoint)
  if (process.env.MCP_ENABLED !== 'false') {
    const mcpRoutes = require('./routes/mcp');
    app.use(mcpRoutes.public.routes());
    app.use(mcpRoutes.secure.routes());
  }
};

module.exports = addRoutes;

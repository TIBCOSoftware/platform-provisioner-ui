/*
 * Copyright © 2025. Cloud Software Group, Inc.
 * This file is subject to the license terms contained
 * in the license file that is distributed with this file.
 */

'use strict';

const { koaBody } = require('koa-body');
const Static = require('koa-static');

const wsRoutes = require('./routes/ws');
const apiRoutes = require('./routes/api');

const session = require('koa-session');
const Router = require('koa-router');
const _ = require('lodash');

const cookieKey = 'cic2-provisioner';

const configMap = require('./configmap');
const isDev = process.env.NODE_ENV === 'development';
const isOnPrem = process.env.ON_PREM_MODE === 'true';
const isWatchCode = process.env.DEV_IS_WATCH_CODE === 'true';
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

  // sessions
  // app.keys = ['your-session-secret'];
  app.keys = ['cic2-provisioner-session-key-745372543'];
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
  authRouter.get('/auth/login',
    async (ctx, next) => {
      if (isDev || isOnPrem) {
        const mockUserData = configMap.getMockUser();
        const mockUser = mockUserData["mockUser"];
        ctx.session.passport = {
          user: mockUser
        };
        ctx.redirect('/');
      } else {
        ctx.session.callbackUrl = ctx.query.callbackUrl;
        await next();
      }
    },
    !isOnPrem ? koaPassport.authenticate('saml') : () => {}
  );

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

    if (ctx.path.endsWith('index.html') && ctx.status === 200) {
      ctx.set('Cache-Control', 'no-cache');
    }
  });

  app.use(authRouter.routes());

  // Adding all available routes
  // wsRoutes.public.use(authMiddleware);
  app.use(wsRoutes.public.routes());

  // apiRoutes.use(authMiddleware);
  app.use(apiRoutes.routes());

  wsRoutes.secure.use(authMiddleware);
  app.use(wsRoutes.secure.routes());
};

module.exports = addRoutes;

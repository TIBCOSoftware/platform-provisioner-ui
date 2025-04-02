/*
 * Copyright © 2025. Cloud Software Group, Inc.
 * This file is subject to the license terms contained
 * in the license file that is distributed with this file.
 */

'use strict';

const Strategy = require('passport-saml').Strategy;
const passport = require('koa-passport');
const fs = require('fs');

const configMap = require('./configmap');
const isOnPrem = process.env.ON_PREM_MODE === 'true';
const isDev = process.env.NODE_ENV === 'development';
const isFromSource = process.env.DEV_START_FROM_SOURCE === 'true';

function init() {
  const ssoConfig = configMap.getSsoConfig();

  // Update the variables below with correct values:
  let entryPoint, logoutUrl, issuer, pathToPublicCert, privateKey, signatureAlgorithm, protocol = 'https:';

  if (ssoConfig) {
    const sso = ssoConfig.sso;

    if (sso) {
      entryPoint = sso.entryPoint;
      logoutUrl = sso.logoutUrl;
      issuer = sso.issuer;
      pathToPublicCert = sso.pathToPublicCert;
      privateKey = sso.privateKey;
      signatureAlgorithm = sso.signatureAlgorithm;
    }
  }

  if (!entryPoint ||
    !logoutUrl ||
    !issuer ||
    !pathToPublicCert ||
    !privateKey ||
    !signatureAlgorithm) {
    console.error('The SSO SAML misses required settings.');
  }

  passport.serializeUser(function(user, cb) {
    cb(null, user);
  });

  passport.deserializeUser(function(user, cb) {
    cb(null, user);
  });

  function onProfile(profile, cb) {
    return cb(null,
      (() => {
        const attrs = ['email', 'firstName', 'lastName', 'authenticatingAuthority', 'dplStatus', 'issuer', 'nameID', 'nameIDFormat', 'sessionIndex'];
        const re = {};
        for(const a of attrs) {
          if (profile[a]) {
            re[a] = profile[a];
          }
        }
        console.log(`[passport] The profile of logged in user is: ${JSON.stringify(re)}`);
        return re;
      })());
  }

  const samlConf = {
    path: '/saml/acscallback',
    // set the protocol to https: instead of default http:
    protocol,
    entryPoint,
    logoutUrl,
    issuer,
    cert: fs.readFileSync(pathToPublicCert, 'utf8'),
    privateKey: fs.readFileSync(privateKey, 'utf8'),
    // don't pass NameIDPolicy in request
    identifierFormat: null,
    // no forceAuthn in request is the default behavior
    // forceAuthn: false,
    signatureAlgorithm
  };

  let samlStrategy;
  if (!isOnPrem || !isDev || !isFromSource) {
    samlStrategy = new Strategy(samlConf, onProfile);
  }

  const logout = (ctx) => {

    return new Promise((resolve, reject) => {
      samlStrategy.logout(ctx, (err, url) => {

        if (!err) {
          resolve(url);
        } else {
          reject(err);
        }
      });
    });

  };

  passport.logoutSamlCallback = async (ctx, next) => {
    // const res = ctx.res;
    if (ctx.session && ctx.session.passport && ctx.session.passport.user) {
      ctx.user = {};
      ctx.user.nameID = ctx.session.passport.user.nameID;
      ctx.user.nameIDFormat = ctx.session.passport.user.nameIDFormat;
      ctx.user.sessionIndex = ctx.session.passport.user.sessionIndex;


      // session is there, logout
      try {
        const logoutUrl = await logout(ctx);
        console.log(`[passport] The saml logout url is: ${logoutUrl}`);
        ctx.redirect(logoutUrl);

      } catch (e) {
        console.warn("[Passport] Logout error: " + e.message);
        ctx.redirect('/');
      }
      next();
    } else {
      ctx.redirect('/');
      await next();
    }

  };

  passport.use(samlStrategy);

}

module.exports = {
  init: init,
  passport: passport
};

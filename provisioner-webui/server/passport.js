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

const Strategy = require('@node-saml/passport-saml').Strategy;
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

  // Build callbackUrl from protocol and the configured callback path
  // node-saml v5: callbackUrl is required (path/protocol/host options were removed)
  const callbackPath = (ssoConfig && ssoConfig.sso && ssoConfig.sso.loginCallbackPath) || '/saml/acscallback';
  const callbackHost = (ssoConfig && ssoConfig.sso && ssoConfig.sso.callbackHost) || '';
  const callbackUrl = callbackHost ? `${protocol}//${callbackHost}${callbackPath}` : callbackPath;

  const samlConf = {
    callbackUrl,
    entryPoint,
    logoutUrl,
    issuer,
    // v5: cert renamed to idpCert
    idpCert: fs.readFileSync(pathToPublicCert, 'utf8'),
    privateKey: fs.readFileSync(privateKey, 'utf8'),
    // don't pass NameIDPolicy in request
    identifierFormat: null,
    // no forceAuthn in request is the default behavior
    // forceAuthn: false,
    signatureAlgorithm,
    // v4: audience is required; set to false to skip validation
    // (old v3 didn't validate audience; the IdP sends SP entity ID which differs from issuer)
    audience: false,
    // v4: these default to true now; set to false to maintain compatibility
    // with IdPs that don't sign both the response and assertions
    wantAssertionsSigned: false,
    wantAuthnResponseSigned: false,
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

var config = require('../config');
var httpStatus = require('http-status');
var superagent = require('superagent');
var log = require('log4js').getLogger('esdr:middleware:accesstoken');

module.exports.refreshAccessToken = function() {
   return function(req, res, next) {
      if (req.isAuthenticated()) {
         var currentTimeMillis = Date.now();
         var accessTokenExpirationMillis = new Date(req.user.accessTokenExpiration).getTime();

         // if the current time is after the access token expiration, then force a termination of the session
         if (currentTimeMillis > accessTokenExpirationMillis) {
            log.debug("Access token expired!  Regenerating session.");
            req.session.regenerate(function() {
               return next();
            });
         }
         else {
            // Our access token is still good, but see if we're due for a refresh
            if (currentTimeMillis > new Date(req.session.accessTokenRefreshRequiredAfter).getTime()) {
               log.debug("Refreshing access token...");

               superagent
                     .post(config.get("esdr:oauthRootUrl"))
                     .type('form')
                     .send({
                              grant_type : 'refresh_token',
                              client_id : config.get("esdrClient:clientName"),
                              client_secret : config.get("esdrClient:clientSecret"),
                              refresh_token : req.user.refreshToken
                           })
                     .end(function(err, res) {
                             if (err) {
                                log.error("refreshAccessToken(): token refresh failed: " + err);
                             }
                             else {
                                if (res.statusCode === httpStatus.OK) {
                                   var tokenResponse = res.body;
                                   log.debug("refreshAccessToken(): tokenResponse: " + JSON.stringify(tokenResponse, null, 3));
                                   var newTokens = {
                                      accessToken : tokenResponse.access_token,
                                      refreshToken : tokenResponse.refresh_token,
                                      accessTokenExpiration : new Date(new Date().getTime() + (tokenResponse.expires_in * 1000))
                                   };

                                   log.debug("Access token refresh successful!: " + JSON.stringify(newTokens, null, 3));
                                   // set the session to expire at the same time as the access token
                                   req.session.cookie.expires = new Date(newTokens.accessTokenExpiration);

                                   // Update the accessTokenRefreshRequiredAfter in the session too.  This is kind of stupid, but is
                                   // apparently what you need to do to force the cookie to be resent to the browser with the
                                   // new expiration time that we just set.  As long as you change something--anything--in the
                                   // session (not just the expires time in the cookie!) then the updated cookie expiration
                                   // time will get sent to the browser.  So, we save the accessTokenRefreshRequiredAfter time--we
                                   // need it anyway to decide when to issue a refresh, and saving it in the session helps solve
                                   // the issue with setting the cookie expiration time.
                                   req.session.accessTokenRefreshRequiredAfter = computeTimeToRefreshAccessToken(Date.now(), new Date(newTokens.accessTokenExpiration).getTime());
                                }
                                else {
                                   log.debug("Failed to refresh the access token.  Received response with HTTP status code [" + res.statusCode + "]");
                                }
                             }
                             next();
                          });
            }
            else {
               // no refresh required yet, so just continue
               //log.debug("Access token is still good, no refresh necessary.");
               next();
            }
         }
      }
      else {
         next();
      }
   };
};

var computeTimeToRefreshAccessToken = function(accessTokenCreationTimeMillis, accessTokenExpirationTimeMillis) {
   var millisUntilAccessTokenRefresh = Math.round((accessTokenExpirationTimeMillis - accessTokenCreationTimeMillis) * 0.90);
   return new Date(accessTokenCreationTimeMillis + millisUntilAccessTokenRefresh);
};

module.exports.computeTimeToRefreshAccessToken = computeTimeToRefreshAccessToken;

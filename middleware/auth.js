var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var BasicStrategy = require('passport-http').BasicStrategy;
var ClientPasswordStrategy = require('passport-oauth2-client-password').Strategy;
var BearerStrategy = require('passport-http-bearer').Strategy;
var LocalAPIKeyStrategy = require('passport-localapikey-update').Strategy;
var config = require('../config');
var httpStatus = require('http-status');
var superagent = require('superagent');
var log = require('log4js').getLogger('esdr:middleware:auth');

module.exports = function(ClientModel, UserModel, TokenModel, FeedModel) {

   passport.use(new LocalStrategy({
                                     usernameField : 'email',
                                     passwordField : 'password'
                                  },
                                  function(email, password, done) {
                                     log.debug("Oauth to ESDR for login of user [" + email + "]");
                                     superagent
                                           .post(config.get("server:rootUrl") + "/oauth/token")
                                           .type('form')
                                           .send({
                                                    grant_type : 'password',
                                                    client_id : config.get("esdrClient:clientName"),
                                                    client_secret : config.get("esdrClient:clientSecret"),
                                                    username : email,
                                                    password : password
                                                 })
                                           .end(function(err, res) {
                                                   if (err) {
                                                      log.error("   ESDR oauth failed for user [" + email + "]: " + err);
                                                      return done(err, false);
                                                   }

                                                   try {
                                                      if (res.statusCode === httpStatus.OK) {
                                                         var tokenResponse = res.body;
                                                         var user = {
                                                            id : tokenResponse.userId,
                                                            lastLogin : new Date(),
                                                            accessToken : tokenResponse.access_token,
                                                            refreshToken : tokenResponse.refresh_token,
                                                            accessTokenExpiration : new Date(new Date().getTime() + (tokenResponse.expires_in * 1000))
                                                         };
                                                         return done(null, user);
                                                      }
                                                      else if (res.statusCode === httpStatus.UNAUTHORIZED ||
                                                               res.statusCode === httpStatus.FORBIDDEN) {
                                                         return done(null, false);
                                                      }
                                                      else {
                                                         log.error("LocalStrategy: ESDR oauth for user [" + email + "] failed due to unknown error.  HTTP status [" + res.statusCode + "]");
                                                         return done(null, false);
                                                      }
                                                   }
                                                   catch (e) {
                                                      log.error("LocalStrategy: Unexpected exception while trying to authenticate user [" + email + "] with ESDR: " + e);
                                                      return done(null, false);
                                                   }
                                                });
                                  }
   ));

   passport.serializeUser(function(user, done) {
      log.trace("serializing user " + user.id);
      done(null, user.id);
   });

   passport.deserializeUser(function(id, done) {
      UserModel.findById(id, function(err, user) {
         log.trace("deserializing user " + id);
         done(err, user);
      });
   });

   var authenticateClient = function(clientName, clientSecret, callback) {
      log.debug("auth.authenticateClient(" + clientName + "))");
      ClientModel.findByNameAndSecret(clientName, clientSecret, function(err, client) {
         log.debug("   in callback for ClientModel.findByNameAndSecret(" + clientName + ")");
         if (err) {
            return callback(err);
         }
         if (!client) {
            return callback(null, false);
         }
         // don't ever need to expose the secret
         delete client.clientSecret;

         return callback(null, client);
      });
   };

   /**
    * BasicStrategy & ClientPasswordStrategy
    *
    * These strategies are used to authenticate registered OAuth clients.  They are employed to protect the `token`
    * endpoint, which consumers use to obtain access tokens.  The OAuth 2.0 specification suggests that clients use the
    * HTTP Basic scheme to authenticate.  Use of the client password strategy allows clients to send the same
    * credentials in the request body (as opposed to the `Authorization` header).  While this approach is not
    * recommended by the specification, in practice it is quite common.
    */
   passport.use(new BasicStrategy(authenticateClient));
   passport.use(new ClientPasswordStrategy(authenticateClient));

   /**
    * BearerStrategy
    *
    * This strategy is used to authenticate users based on an access token (aka a bearer token).  The user must have
    * previously authorized a client application, which is issued an access token to make requests on behalf of the
    * authorizing user.
    */
   passport.use(new BearerStrategy(
         function(accessToken, done) {
            log.debug("in passport.use(new BearerStrategy(" + accessToken + "))");
            TokenModel.validateAccessToken(accessToken, function(err, token, message) {
               if (err) {
                  return done(err);
               }
               if (!token) {
                  return done(null, false, { message : message });
               }

               UserModel.findById(token.userId, function(err, user) {
                  if (err) {
                     return done(err);
                  }
                  if (!user) {
                     return done(null, false, { message : 'Unknown user' });
                  }

                  // don't ever need to expose the password
                  delete user.password;

                  var info = { scope : '*', token : token };
                  done(null, user, info);
               });
            });
         }
   ));

   /**
    * LocalAPIKeyStrategy
    *
    * This strategy is used to authenticate requests for feeds.
    */
   passport.use(new LocalAPIKeyStrategy(
         function(apiKey, done) {
            FeedModel.findByApiKey(apiKey, function(err1, feed) {
               if (err1) {
                  return done(err1);
               }
               if (!feed) {
                  return done(null, false, { message : 'Invalid feed API key' });
               }

               var user = {
                  id : feed.userId
               };

               var info = {
                  feed : feed,
                  isReadOnly : feed.apiKeyReadOnly == apiKey
               };

               return done(null, user, info);
            });
         }
   ));
};


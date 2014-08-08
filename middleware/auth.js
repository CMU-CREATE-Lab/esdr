var passport = require('passport');
var BasicStrategy = require('passport-http').BasicStrategy;
var ClientPasswordStrategy = require('passport-oauth2-client-password').Strategy;
var BearerStrategy = require('passport-http-bearer').Strategy;
var log = require('log4js').getLogger();

module.exports = function(ClientModel, UserModel, TokenModel) {

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

                  var info = { scope : '*' };
                  done(null, user, info);
               });
            });
         }
   ));
};


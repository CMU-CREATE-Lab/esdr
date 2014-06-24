var oauth2orize = require('oauth2orize');
var config = require('../config');
var log = require('log4js').getLogger();

module.exports = function(UserModel, RefreshTokenModel, generateNewTokens) {
   var server = oauth2orize.createServer();

   /**
    * Exchange user id and password for access tokens.
    *
    * The callback accepts the `client`, which is exchanging the user's name and password from the authorization request
    * for verification. If these values are validated, the application issues access and refresh tokens on behalf of the
    * user who authorized the code.
    */
   server.exchange(oauth2orize.exchange.password(function(client, username, password, scope, done) {
      log.debug("server.exchange(oauth2orize.exchange.password(" + JSON.stringify(client.clientId) + "," + username + "," + scope + "))");

      // We can assume at this point that the client has already been authenticated by passport, so there's no need to do
      // it again here.  Just proceed with authenticating the user and then generating the tokens if valid.
      UserModel.findByUsername(username, function(err, user) {
         if (err) {
            return done(err);
         }
         if (!user) {
            return done(null, false);
         }
         if (!user.isValidPassword(password)) {
            return done(null, false);
         }

         // Everything validated, generate and return the tokens
         generateNewTokens(user, client, function(err, tokenValues) {
            if (err) {
               return done(err);
            }
            done(null, tokenValues.access, tokenValues.refresh, { 'expires_in' : config.get('security:tokenLifeSecs') });
         });
      });
   }));

   /**
    * Exchange the refresh token for an access token.
    *
    * The callback accepts the `client`, which is exchanging the client's id from the token request for verification.
    * If this value is validated, the application issues access and refresh tokens on behalf of the client who
    * authorized the code.
    */
   server.exchange(oauth2orize.exchange.refreshToken(function(client, refreshToken, scope, done) {
      // We can assume at this point that the client has already been authenticated by passport, so there's no need to do
      // it again here.  Just proceed with finding the token and verifying it actually belongs to the client.
      log.debug("server.exchange(oauth2orize.exchange.refreshToken(" + JSON.stringify(client.clientId) + "," + refreshToken + "," + scope + "))");
      RefreshTokenModel.findOne({ token : refreshToken }, function(err, localRefreshToken) {
         if (err) {
            return done(err);
         }
         if (!localRefreshToken) {
            return done(null, false);
         }
         if (localRefreshToken.clientId !== client.clientId) {
            return done(null, false);
         }

         UserModel.findById(localRefreshToken.userId, function(err, user) {
            if (err) {
               return done(err);
            }
            if (!user) {
               return done(null, false);
            }

            // Everything validated, generate and return the tokens
            generateNewTokens(user, client, function(err, tokenValues) {
               if (err) {
                  return done(err);
               }
               done(null, tokenValues.access, tokenValues.refresh, { 'expires_in' : config.get('security:tokenLifeSecs') });
            });
         });
      });
   }));

   return server;
};

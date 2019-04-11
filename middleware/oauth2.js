const oauth2orize = require('oauth2orize');
const config = require('../config');
const log = require('log4js').getLogger('esdr:middleware:oauth2');

module.exports = function(UserModel, TokenModel) {
   const server = oauth2orize.createServer();

   /**
    * Exchange user id and password for access tokens.
    *
    * The callback accepts the `client`, which is exchanging the user's name and password from the authorization request
    * for verification. If these values are validated, the application issues access and refresh tokens on behalf of the
    * user who authorized the code.
    */
   server.exchange(oauth2orize.exchange.password(function(client, email, password, scope, done) {
      log.debug("server.exchange(oauth2orize.exchange.password(" + JSON.stringify(client.clientName) + "," + email + "," + scope + "))");

      // We can assume at this point that the client has already been authenticated by passport, so there's no need to do
      // it again here.  Just proceed with authenticating the user and then generating the tokens if valid.
      UserModel.findByEmailAndPassword(email, password, function(err, user) {
         if (err) {
            return done(err);
         }
         if (!user) {
            return done(null, false);
         }

         if (!user.isVerified) {
            return done(null, false);
         }

         // Everything validated, generate and return the tokens
         TokenModel.create(user.id, client.id, function(err, tokenValues) {
            if (err) {
               return done(err);
            }
            done(null, tokenValues.access, tokenValues.refresh, {
               userId : user.id,
               'expires_in' : config.get("security:tokenLifeSecs")
            });
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
      // it again here.
      log.debug("server.exchange(oauth2orize.exchange.refreshToken(" + JSON.stringify(client.clientName) + "," + refreshToken + "," + scope + "))");
      TokenModel.refreshToken(client.id, refreshToken, function(err, tokens) {
         if (err) {
            return done(err);
         }

         if (tokens) {
            return done(null, tokens.access, tokens.refresh, { 'expires_in' : config.get("security:tokenLifeSecs") });
         }

         return done(null, false);
      });
   }));

   return server;
};

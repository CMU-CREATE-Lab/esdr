const express = require('express');
const router = express.Router();
const passport = require('passport');

module.exports = function(oauthServer) {

   /**
    * Token endpoint
    *
    * `token` middleware handles client requests to exchange authorization grants
    * for access tokens.  Based on the grant type being exchanged, the OAuth2
    * exchange middleware will be invoked to handle the request.  Clients must
    * authenticate when making requests to this endpoint.
    */
   router.post('/token', [
      passport.authenticate(['basic', 'oauth2-client-password'], { session : false }),
      oauthServer.token(),
      oauthServer.errorHandler()
   ]);

   return router;
};

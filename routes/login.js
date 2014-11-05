var express = require('express');
var router = express.Router();
var passport = require('passport');
var httpStatus = require('http-status');
var computeTimeToRefreshAccessToken = require('../middleware/accessToken').computeTimeToRefreshAccessToken;
var log = require('log4js').getLogger('esdr:routes:login');
var config = require('../config');

module.exports = function(oauthServer) {

   router.get('/', function(req, res) {
      res.render('login', { title : "ESDR: Login"});
   });

   router.post('/', function(req, res, next) {
      passport.authenticate('local', function(err, user) {
         if (err) {
            return next(err);
         }
         if (!user) {
            return res.jsendClientError("Login failed", null, httpStatus.UNAUTHORIZED);
         }
         req.logIn(user, function(err) {
            if (err) {
               return next(err);
            }

            // set the session to expire at the same time as the access token
            req.session.cookie.expires = new Date(user.accessTokenExpiration);

            // calculate when to refresh the access token, and save it in the session (see accessTokens.js for explanation)
            req.session.accessTokenRefreshRequiredAfter = computeTimeToRefreshAccessToken(Date.now(), new Date(user.accessTokenExpiration).getTime());

            return res.jsendSuccess({
                                       email : user.email,
                                       accessToken : user.accessToken,
                                       accessTokenExpiration : user.accessTokenExpiration
                                    });
         });
      })(req, res, next);
   });


   return router;
};


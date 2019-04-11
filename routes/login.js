const express = require('express');
const router = express.Router();
const passport = require('passport');
const httpStatus = require('http-status');
const computeTimeToRefreshAccessToken = require('../middleware/accessToken').computeTimeToRefreshAccessToken;
const config = require('../config');

router.get('/', function(req, res) {
   res.render('login',
              {
                 title : "ESDR: Login",
                 apiRootUrl : config.get("esdr:apiRootUrl")
              });
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

module.exports = router;

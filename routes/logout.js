const express = require('express');
const router = express.Router();
const log = require('log4js').getLogger("esdr:routes:logout");

module.exports = function() {

   router.get('/', function(req, res) {
      if (log.isDebugEnabled() && req.user) {
         log.debug("Destroying session for user [" + req.user.id + "]");
      }
      req.session = null;
      // As of Passport v0.6, logout is async and requires a callback.
      // This is part of their larger change to avert session fixation attacks.
      req.logout(function() {
        res.redirect('/');
      });
   });

   return router;
};


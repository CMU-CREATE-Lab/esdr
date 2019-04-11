const express = require('express');
const router = express.Router();
const log = require('log4js').getLogger("esdr:routes:logout");

module.exports = function() {

   router.get('/', function(req, res) {
      if (log.isDebugEnabled() && req.user) {
         log.debug("Destroying session for user [" + req.user.id + "]");
      }
      req.session = null;
      req.logout();
      res.redirect('/');
   });

   return router;
};


var express = require('express');
var router = express.Router();
var config = require('../config');
var log = require('log4js').getLogger("esdr:routes:logout");

module.exports = function(TokenModel) {

   router.get('/', function(req, res) {
      if (req.user) {
         var userId = req.user.id;
         process.nextTick(function() {
            log.debug("Destroying tokens for user [" + userId + "]");
            TokenModel.remove(userId, config.get("esdrClient:id"), function(err, wasSuccessful) {
               if (err) {
                  log.error("Error while trying to destroy tokens for user [" + userId + "]: " + err);
               }
               else {
                  log.debug("Tokens destroyed for user [" + userId + "]: " + wasSuccessful);
               }
            });
         });
      }
      log.debug("Destroying session for user [" + userId + "]");
      req.session = null;
      req.logout();
      res.redirect('/');
   });

   return router;
};


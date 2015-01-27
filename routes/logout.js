var express = require('express');
var router = express.Router();
var config = require('../config');
var log = require('log4js').getLogger("esdr:routes:logout");

module.exports = function(TokenModel) {

   router.get('/', function(req, res) {
      if (req.user) {
         var userId = req.user.id;
         log.debug("Destroying session for user [" + userId + "]");

         // TODO: Destroying tokens should really only be done once the last session for that user is destroyed.
         // Use case: User logs into the site using two different browsers.  They'll both get the same access token,
         // but if she logs out on one browser, the other browser will still need the oauth tokens.  Revisit this later.
         //process.nextTick(function() {
         //   log.debug("Destroying tokens for user [" + userId + "]");
         //   TokenModel.remove(userId, config.get("esdrClient:id"), function(err, wasSuccessful) {
         //      if (err) {
         //         log.error("Error while trying to destroy tokens for user [" + userId + "]: " + err);
         //      }
         //      else {
         //         log.debug("Tokens destroyed for user [" + userId + "]: " + wasSuccessful);
         //      }
         //   });
         //});
      }
      req.session = null;
      req.logout();
      res.redirect('/');
   });

   return router;
};


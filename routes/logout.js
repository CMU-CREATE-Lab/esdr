var express = require('express');
var router = express.Router();
var log = require('log4js').getLogger("esdr:routes:logout");

module.exports = function(UserModel) {

   router.get('/', function(req, res) {
      if (req.user) {
         var userId = req.user.id;
         log.debug("Logout: destroying session for user [" + userId + "]");
         process.nextTick(function() {
            // todo
            log.debug("NEED TO DESTROY TOKEN FOR USER [" + userId + "]");
         });
      }
      req.logout();
      res.redirect('/');
   });

   return router;
};


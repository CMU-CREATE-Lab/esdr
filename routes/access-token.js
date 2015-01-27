var express = require('express');
var router = express.Router();
var httpStatus = require('http-status');
var config = require('../config');
var log = require('log4js').getLogger("esdr:routes:access-token");

module.exports = function(TokenModel) {

   router.get('/',
              function(req, res) {
                 if (req.isAuthenticated()) {
                    var userId = req.user.id;
                    var clientId = config.get("esdrClient:id");
                    TokenModel.findAccessTokenForUserAndClient(userId, clientId, function(err, result) {
                       if (err) {
                          var msg = "Error while trying to find access token [" + userId + "]";
                          log.error(msg + ": " + err);
                          return res.jsendServerError(msg);
                       }
                       else {
                          return res.jsendSuccess({
                                                     token : result ? result.accessToken : null
                                                  }, httpStatus.OK); // HTTP 200 OK
                       }
                    });
                 }
                 else {
                    return res.jsendClientError("Authentication required", null, httpStatus.UNAUTHORIZED); // HTTP 401 UNAUTHORIZED
                 }
              });

   return router;
};


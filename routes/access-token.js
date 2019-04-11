const express = require('express');
const router = express.Router();
const httpStatus = require('http-status');
const config = require('../config');
const log = require('log4js').getLogger("esdr:routes:access-token");

module.exports = function(TokenModel) {

   router.get('/',
              function(req, res) {
                 if (req.isAuthenticated()) {
                    const userId = req.user.id;
                    const clientId = config.get("esdrClient:id");
                    TokenModel.findAccessTokenForUserAndClient(userId, clientId, function(err, result) {
                       if (err) {
                          const msg = "Error while trying to find access token [" + userId + "]";
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


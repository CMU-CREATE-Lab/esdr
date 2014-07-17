var express = require('express');
var router = express.Router();
var passport = require('passport');
var log = require('log4js').getLogger();

module.exports = function(UserModel) {

   router.post('/',
               function(req, res) {
                  var newUser = req.body;
                  log.debug("Received POST to create user:" + JSON.stringify(newUser, null, 3));

                  UserModel.create(newUser,
                                   function(err, result) {
                                      if (err) {
                                         // some errors have an error type defined in the result
                                         if (result && result.errorType) {
                                            if (result.errorType == "validation") {
                                               return res.jsendClientError("Validation failure", err);
                                            }
                                            else if (result.errorType == "database" && err.code == "ER_DUP_ENTRY") {
                                               log.debug("Email [" + newUser.email + "] already in use!");
                                               return res.jsendClientError("Email already in use.", null, 409);  // HTTP 409 Conflict
                                            }
                                         }
                                         var message = "Error while trying to create user [" + newUser.email + "]";
                                         log.error(message + ": " + err);
                                         return res.jsendServerError(message);
                                      }

                                      log.debug("Created new user [" + newUser.email + "] with id [" + result.insertId + "] ");

                                      res.jsendSuccess({
                                                          email : newUser.email,
                                                          displayName : newUser.displayName
                                                       }, 201); // HTTP 201 Created
                                   });

               });

   // TODO: this is just a placeholder for testing...
   router.get('/',
              passport.authenticate('bearer', { session : false }),
              function(req, res) {
                 // req.authInfo is set using the `info` argument supplied by
                 // `BearerStrategy`.  It is typically used to indicate scope of the token,
                 // and used in access control checks.  For illustrative purposes, this
                 // example simply returns the scope in the response.
                 res.json({ id : req.user.id, email : req.user.email, scope : req.authInfo.scope })
              }
   );

   return router;
};

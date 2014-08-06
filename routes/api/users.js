var config = require('../../config');
var express = require('express');
var router = express.Router();
var passport = require('passport');
var ValidationError = require('../../lib/errors').ValidationError;
var DuplicateRecordError = require('../../lib/errors').DuplicateRecordError;
var log = require('log4js').getLogger();

module.exports = function(UserModel) {

   router.post('/',
               function(req, res) {
                  var newUser = req.body;
                  log.debug("Received POST to create user [" + (newUser && newUser.email ? newUser.email : null) + "]");

                  UserModel.create(newUser,
                                   function(err, result) {
                                      if (err) {
                                         if (err instanceof ValidationError) {
                                            return res.jsendClientError("Validation failure", err.data);
                                         }
                                         if (err instanceof DuplicateRecordError) {
                                            log.debug("Email [" + newUser.email + "] already in use!");
                                            return res.jsendClientError("Email already in use.", {email : newUser.email}, 409);  // HTTP 409 Conflict
                                         }

                                         var message = "Error while trying to create user [" + newUser.email + "]";
                                         log.error(message + ": " + err);
                                         return res.jsendServerError(message);
                                      }

                                      log.debug("Created new user [" + result.email + "] with id [" + result.insertId + "] ");

                                      var obj = {
                                         id : result.insertId,
                                         // include these because they might have been modified by the trimming in the call to create()
                                         email : result.email,
                                         displayName : result.displayName
                                      };
                                      // See whether we should return the verification token.  E.g., in most cases, we simply
                                      // want to email the verification token to the user, to ensure the email address is
                                      // correct and actually belongs to the person who created the account. But, when
                                      // testing, just return it here so I don't have to write tests that check an email
                                      // account :-)
                                      if (config.get("verificationToken:willReturnViaApi")) {
                                         obj.verificationToken = result.verificationToken
                                      }

                                      res.jsendSuccess(obj, 201); // HTTP 201 Created
                                   });

               });

   router.get('/:verificationToken/verify',
              function(req, res) {
                 UserModel.verify(req.params.verificationToken, function(err, result) {
                    if (err) {
                       var message = "Error while trying to verify user with verification token [" + req.params.verificationToken + "]";
                       log.error(message + ": " + err);
                       return res.jsendServerError(message);
                    }

                    if (result.isVerified) {
                       return res.jsendSuccess(result);
                    }

                    return res.jsendClientError("Invalid verification token", result, 400);
                 });
              }
   );

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

var express = require('express');
var router = express.Router();
var passport = require('passport');
var JaySchema = require('jayschema');
var UserSchema = require('../../models/json-schemas').UserSchema;
var log = require('log4js').getLogger();

var jsonValidator = new JaySchema();

module.exports = function(UserModel) {

   router.post('/',
               function(req, res) {
                  var userJson = req.body;
                  log.debug("Received POST to create user:" + JSON.stringify(userJson, null, 3));

                  // validate JSON (asynchronously)
                  jsonValidator.validate(userJson, UserSchema, function(err1) {
                     if (err1) {
                        return res.jsendClientError("Validation failure", err1);
                     }

                     // JSON is valid, so now see whether this username is already taken
                     UserModel.findByUsername(userJson.username, function(err2, user) {
                        if (err2) {
                           var message = "Error while trying to find user [" + userJson.username + "]";
                           log.error(message + ": " + err2);
                           return res.jsendServerError(message);
                        }

                        if (user && user.id) {
                           log.debug("Username [" + userJson.username + "] already in use!");
                           return res.jsendClientError("Username already in use.", null, 409);  // HTTP 409 Conflict
                        }
                        else {
                           var newUser = {
                              username : userJson.username,
                              password : userJson.password,
                              email : userJson.email
                           };
                           UserModel.create(newUser,
                                            function(err3, result) {
                                               if (err3) {
                                                  var message = "Error while trying to create user [" + userJson.username + "]";
                                                  log.error(message + ": " + err3);
                                                  return res.jsendServerError(message);
                                               }
                                               log.debug("Created new user [" + newUser.username + "] with id [" + result.insertId + "] ");

                                               res.jsendSuccess({
                                                                   username : newUser.username,
                                                                   email : newUser.email
                                                                }, 201); // HTTP 201 Created
                                            });

                        }
                     });
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
                 res.json({ id : req.user.id, username : req.user.username, scope : req.authInfo.scope })
              }
   );

   return router;
};

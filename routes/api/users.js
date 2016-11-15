var config = require('../../config');
var express = require('express');
var router = express.Router();
var passport = require('passport');
var Mailer = require('../../lib/mailer');
var ValidationError = require('../../lib/errors').ValidationError;
var DuplicateRecordError = require('../../lib/errors').DuplicateRecordError;
var httpStatus = require('http-status');
var log = require('log4js').getLogger('esdr:routes:api:users');

module.exports = function(UserModel, UserPropertiesModel) {

   /**
    * Creates the given user, optionally on behalf of the client specified in the Authorization header using Basic auth.
    * After the user is created, an email will be sent to the user (if configured to do so, depending on the current
    * Node runtime environment).  By default, the email will be sent from an ESDR email account, and will include an URL
    * in the ESDR web site which the user can use to verify her/his account.  Specifying the client is only necessary if
    * you wish to override the default sender email and verification link and use the email and link for the client
    * instead.
    *
    * The submitted JSON must use the following schema:
    *
    * {
    *    "email" : "EMAIL_ADDRESS",
    *    "password" : "PASSWORD"
    * }
    *
    * Possible JSend responses:
    * - Success 201: the user was created successfully
    * - Client Error 401: the client was specified, but failed authentication
    * - Client Error 409: a user with the same email already exists
    * - Client Error 422: the user was not specified or fails validation
    * - Server Error 500: an unexpected error occurred
    */
   router.post('/',
               function(req, res, next) {
                  var user = req.body;
                  if (user) {
                     var createUser = function(client) {
                        UserModel.create(user,
                                         function(err, result) {
                                            if (err) {
                                               if (err instanceof ValidationError) {
                                                  return res.jsendClientValidationError("Validation failure", err.data);  // HTTP 422 Unprocessable Entity
                                               }
                                               if (err instanceof DuplicateRecordError) {
                                                  log.debug("Email [" + user.email + "] already in use!");
                                                  return res.jsendClientError("Email already in use.", { email : user.email }, httpStatus.CONFLICT);  // HTTP 409 Conflict
                                               }

                                               var message = "Error while trying to create user [" + user.email + "]";
                                               log.error(message + ": " + err);
                                               return res.jsendServerError(message);
                                            }

                                            log.debug("Created new user [" + result.email + "] with id [" + result.insertId + "] ");

                                            var obj = {
                                               id : result.insertId,
                                               // include these because they might have been modified by the trimming in the call to UserModel.create()
                                               email : result.email,
                                               displayName : result.displayName
                                            };

                                            // See whether we should return the verification token.  In most cases, we simply want to
                                            // email the verification token to the user (see below), to ensure the email address is
                                            // correct and actually belongs to the person who created the account. But, when testing, just
                                            // return it here so I don't have to write tests that check an email account :-)
                                            if (config.get("verificationToken:willReturnViaApi")) {
                                               obj.verificationToken = result.verificationToken
                                            }

                                            // See whether we should email a link to the user to verify her/his account.
                                            if (config.get("verificationToken:willEmailToUser")) {
                                               Mailer.sendVerificationEmail(client, user.email, result.verificationToken);
                                            }

                                            return res.jsendSuccess(obj, httpStatus.CREATED); // HTTP 201 Created
                                         });

                     };

                     // see whether the caller specified the client by using the Authorization header
                     if (("authorization" in req.headers)) {
                        // try to authenticate the client
                        passport.authenticate('basic', function(err, client) {
                           if (err) {
                              var message = "Error while authenticating the client";
                              log.error(message + ": " + err);
                              return res.jsendServerError(message);
                           }

                           if (client) {
                              return createUser(client);
                           }

                           return res.jsendClientError("Authentication failed.", null, httpStatus.UNAUTHORIZED);  // HTTP 401 Unauthorized

                        })(req, res, next);
                     }
                     else {
                        return createUser();
                     }
                  }
                  else {
                     return res.jsendClientValidationError("user not specified.", null);  // HTTP 422 Unprocessable Entity
                  }
               });

   router.get('/:userId',
              passport.authenticate('bearer', { session : false }),
              function(req, res) {

                 if (req.params.userId == req.user.id) {
                    UserModel.filterFields(req.user, req.query.fields, function(err, user) {
                       if (err) {
                          var message = "Error while finding the user";
                          log.error(message + ": " + err);
                          return res.jsendServerError(message);
                       }

                       return res.jsendSuccess(user); // HTTP 200 OK
                    });
                 }
                 else {
                    return res.jsendClientError("Access denied.", null, httpStatus.FORBIDDEN);  // HTTP 403 FORBIDDEN
                 }
              }
   );

   router.put('/:userId/properties/:key',
              passport.authenticate('bearer', { session : false }),
              function(req, res) {

                 if (req.params.userId == req.user.id) {

                    // try setting the property
                    UserPropertiesModel.setProperty(req.authInfo.token.clientId, req.user.id, req.params['key'], req.body, function(err, property) {
                       if (err) {
                          if (err instanceof ValidationError) {
                             return res.jsendClientValidationError(err.message || "Validation failure", err.data);   // HTTP 422 Unprocessable Entity
                          }
                          if (typeof err.data !== 'undefined' &&
                              typeof err.data.code !== 'undefined' &&
                              typeof err.data.status !== 'undefined') {
                             return res.jsendPassThrough(err.data);
                          }

                          var message = "Error setting property";
                          log.error(message + ": " + err);
                          return res.jsendServerError(message);
                       }

                       return res.jsendSuccess(property); // HTTP 200 OK
                    });
                 }
                 else {
                    return res.jsendClientError("Access denied.", null, httpStatus.FORBIDDEN);  // HTTP 403 FORBIDDEN
                 }
              }
   );

   router.get('/:userId/properties/:key',
              passport.authenticate('bearer', { session : false }),
              function(req, res) {

                 if (req.params.userId == req.user.id) {
                    UserPropertiesModel.getProperty(req.authInfo.token.clientId, req.user.id, req.params['key'], function(err, property) {
                       if (err) {
                          if (err instanceof ValidationError) {
                             return res.jsendClientValidationError(err.message || "Validation failure", err.data);   // HTTP 422 Unprocessable Entity
                          }
                          if (typeof err.data !== 'undefined' &&
                              typeof err.data.code !== 'undefined' &&
                              typeof err.data.status !== 'undefined') {
                             return res.jsendPassThrough(err.data);
                          }

                          var message = "Error while finding property [" + req.params['key'] + "]";
                          log.error(message + ": " + err);
                          return res.jsendServerError(message);
                       }

                       if (property) {
                          return res.jsendSuccess(property); // HTTP 200 OK
                       }
                       else {
                          return res.jsendClientError("Unknown or invalid property", null, httpStatus.NOT_FOUND); // HTTP 404 Not Found
                       }
                    });
                 }
                 else {
                    return res.jsendClientError("Access denied.", null, httpStatus.FORBIDDEN);  // HTTP 403 FORBIDDEN
                 }
              }
   );

   router.get('/:userId/properties',
              passport.authenticate('bearer', { session : false }),
              function(req, res) {

                 if (req.params.userId == req.user.id) {
                    UserPropertiesModel.find(req.authInfo.token.clientId, req.user.id, req.query, function(err, properties) {
                       if (err) {
                          var message = "Error while finding the user properties";
                          log.error(message + ": " + err);
                          return res.jsendServerError(message);
                       }

                       return res.jsendSuccess(properties); // HTTP 200 OK
                    });
                 }
                 else {
                    return res.jsendClientError("Access denied.", null, httpStatus.FORBIDDEN);  // HTTP 403 FORBIDDEN
                 }
              }
   );

   router.delete('/:userId/properties',
                 passport.authenticate('bearer', { session : false }),
                 function(req, res) {

                    if (req.params.userId == req.user.id) {
                       UserPropertiesModel.deleteAll(req.authInfo.token.clientId, req.user.id, function(err, deleteResult) {
                          if (err) {
                             var message = "Error while deleting the user properties";
                             log.error(message + ": " + err);
                             return res.jsendServerError(message);
                          }

                          return res.jsendSuccess(deleteResult); // HTTP 200 OK
                       });
                    }
                    else {
                       return res.jsendClientError("Access denied.", null, httpStatus.FORBIDDEN);  // HTTP 403 FORBIDDEN
                    }
                 }
   );

   router.delete('/:userId/properties/:key',
                 passport.authenticate('bearer', { session : false }),
                 function(req, res) {

                    if (req.params.userId == req.user.id) {
                       UserPropertiesModel.deleteProperty(req.authInfo.token.clientId, req.user.id, req.params['key'], function(err, deleteResult) {
                          if (err) {
                             if (err instanceof ValidationError) {
                                return res.jsendClientValidationError(err.message || "Validation failure", err.data);   // HTTP 422 Unprocessable Entity
                             }
                             if (typeof err.data !== 'undefined' &&
                                 typeof err.data.code !== 'undefined' &&
                                 typeof err.data.status !== 'undefined') {
                                return res.jsendPassThrough(err.data);
                             }

                             var message = "Error while deleting property [" + req.params['key'] + "]";
                             log.error(message + ": " + err);
                             return res.jsendServerError(message);
                          }

                          return res.jsendSuccess(deleteResult); // HTTP 200 OK
                       });
                    }
                    else {
                       return res.jsendClientError("Access denied.", null, httpStatus.FORBIDDEN);  // HTTP 403 FORBIDDEN
                    }
                 }
   );

   return router;
};

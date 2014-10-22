var config = require('../../config');
var express = require('express');
var router = express.Router();
var passport = require('passport');
var Mailer = require('../../lib/mailer');
var ValidationError = require('../../lib/errors').ValidationError;
var DuplicateRecordError = require('../../lib/errors').DuplicateRecordError;
var httpStatus = require('http-status');
var log = require('log4js').getLogger();

module.exports = function(UserModel, ClientModel) {

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
                     var willAuthenticateClient = ("authorization" in req.headers);

                     var createUser = function(user, client) {
                        UserModel.create(user,
                                         function(err, result) {
                                            if (err) {
                                               if (err instanceof ValidationError) {
                                                  return res.jsendClientValidationError("Validation failure", err.data);  // HTTP 422 Unprocessable Entity
                                               }
                                               if (err instanceof DuplicateRecordError) {
                                                  log.debug("Email [" + user.email + "] already in use!");
                                                  return res.jsendClientError("Email already in use.", {email : user.email}, httpStatus.CONFLICT);  // HTTP 409 Conflict
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

                     if (willAuthenticateClient) {
                        // try to authenticate the client
                        passport.authenticate('basic', function(err, client) {
                           if (err) {
                              var message = "Error while authenticating to get the client";
                              log.error(message + ": " + err);
                              return res.jsendServerError(message);
                           }

                           if (client) {
                              return createUser(user, client);
                           }

                           return res.jsendClientError("Authentication failed.", null, httpStatus.UNAUTHORIZED);  // HTTP 401 Unauthorized

                        })(req, res, next);
                     }
                     else {
                        return createUser(user);
                     }
                  }
                  else {
                     return res.jsendClientValidationError("user not specified.", null);  // HTTP 422 Unprocessable Entity
                  }
               });

   // TODO: this is just a placeholder for testing...
   router.get('/',
              passport.authenticate('bearer', { session : false }),
              function(req, res) {
                 // req.authInfo is set using the `info` argument supplied by
                 // `BearerStrategy`.  It is typically used to indicate scope of the token,
                 // and used in access control checks.  For illustrative purposes, this
                 // example simply returns the user and authInfo in the response.
                 res.json({ user : req.user, authInfo : req.authInfo })
              }
   );

   return router;
};

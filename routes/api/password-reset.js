const config = require('../../config');
const express = require('express');
const router = express.Router();
const passport = require('passport');
const Mailer = require('../../lib/mailer');
const ValidationError = require('../../lib/errors').ValidationError;
const httpStatus = require('http-status');
const log = require('log4js').getLogger('esdr:routes:api:password-reset');

module.exports = function(UserModel) {

   /**
    * For requesting that password reset email be sent, optionally on behalf of the client specified in the
    * Authorization header using Basic auth.  By default, the email will be sent from an ESDR email account, and will
    * include an URL in the ESDR web site which the user can use to change his/her password. Specifying the client is
    * only necessary if you wish to override the default sender email and reset password URL and use the email and link
    * for the client instead.
    *
    * Requires a JSON body with the following schema:
    *
    * {
    *    "email" : "EMAIL_ADDRESS"
    * }
    */
   router.post('/',
               function(req, res, next) {
                  const userEmail = req.body.email;

                  if (userEmail) {

                     const sendPasswordResetEmail = function(client) {
                        log.debug("Received POST to send password reset email for user [" + userEmail + "]");

                        // try to create the reset password token
                        UserModel.createResetPasswordToken(userEmail, function(err, token) {
                           if (err) {
                              if (err instanceof ValidationError) {
                                 return res.jsendClientValidationError("Invalid email address.", { email : userEmail });  // HTTP 422 Unprocessable Entity
                              }
                              const message = "Error while trying create a reset password token request";
                              log.error(message + ": " + err);
                              return res.jsendServerError(message);
                           }

                           if (token) {

                              const obj = {
                                 email : userEmail
                              };
                              // See whether we should return the reset password token.  In most cases, we simply want to
                              // email the reset password token to the user (see below). But, when testing, just
                              // return it here so I don't have to write tests that check an email account :-)
                              if (config.get("resetPasswordToken:willReturnViaApi")) {
                                 obj.resetPasswordToken = token
                              }

                              if (config.get("resetPasswordToken:willEmailToUser")) {
                                 Mailer.sendPasswordResetEmail(client, userEmail, token);
                              }
                              return res.jsendSuccess(obj, httpStatus.CREATED);  // HTTP 201 Created
                           }

                           return res.jsendClientError("Unknown or invalid email address", { email : userEmail }, httpStatus.BAD_REQUEST);
                        });

                     };

                     // see whether the caller specified the client by using the Authorization header
                     if (("authorization" in req.headers)) {
                        // try to authenticate the client
                        passport.authenticate('basic', function(err, client) {
                           if (err) {
                              const message = "Error while authenticating the client";
                              log.error(message + ": " + err);
                              return res.jsendServerError(message);
                           }

                           if (client) {
                              return sendPasswordResetEmail(client);
                           }

                           return res.jsendClientError("Authentication failed.", null, httpStatus.UNAUTHORIZED);  // HTTP 401 Unauthorized

                        })(req, res, next);
                     }
                     else {
                        return sendPasswordResetEmail();
                     }
                  }
                  else {
                     return res.jsendClientValidationError("Email address not specified.", null);  // HTTP 422 Unprocessable Entity
                  }
               }
   );

   router.put('/',
              function(req, res) {
                 const password = req.body.password;
                 const token = req.body.token;

                 if (password) {
                    if (token) {
                       UserModel.setPassword(token, password, function(err, wasSuccessful) {
                          if (err) {
                             if (err instanceof ValidationError) {
                                return res.jsendClientValidationError("Validation failure", err.data);  // HTTP 422 Unprocessable Entity
                             }
                             const message = "Error while trying set the new password";
                             log.error(message + ": " + err);
                             return res.jsendServerError(message);
                          }

                          if (wasSuccessful) {
                             return res.jsendSuccess(null);
                          }

                          return res.jsendClientError("Unknown or invalid reset password token", null, httpStatus.BAD_REQUEST);  // HTTP 400 Bad Request
                       });
                    }
                    else {
                       return res.jsendClientValidationError("Reset password token not specified.", null);  // HTTP 422 Unprocessable Entity
                    }
                 }
                 else {
                    return res.jsendClientValidationError("Password not specified.", null);  // HTTP 422 Unprocessable Entity
                 }
              }
   );

   return router;
};

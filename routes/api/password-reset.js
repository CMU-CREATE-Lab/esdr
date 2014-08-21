var config = require('../../config');
var express = require('express');
var router = express.Router();
var passport = require('passport');
var Mailer = require('../../lib/mailer');
var ValidationError = require('../../lib/errors').ValidationError;
var log = require('log4js').getLogger();

module.exports = function(UserModel, ClientModel) {

   router.post('/',
               function(req, res) {
                  var userEmail = (req.body.user) ? req.body.user.email : null;
                  var theClient = req.body.client;

                  // The client is required--try to authenticate it
                  if (userEmail) {
                     if (theClient) {
                        ClientModel.findByNameAndSecret(theClient.clientName, theClient.clientSecret, function(err, client) {
                           if (err) {
                              return res.jsendServerError("Error while authenticating client [" + theClient.clientName + "]");
                           }
                           if (!client) {
                              return res.jsendClientError("Failed to authenticate client.", {clientName : theClient.clientName}, 401);  // HTTP 401 Unauthorized
                           }

                           // try to create the reset password token
                           UserModel.createResetPasswordToken(userEmail, function(err, token) {
                              if (err) {
                                 if (err instanceof ValidationError) {
                                    return res.jsendClientError("Invalid email address.", {email : userEmail}, 422);  // HTTP 422 Unprocessable Entity
                                 }
                                 var message = "Error while trying create a reset password token request";
                                 log.error(message + ": " + err);
                                 return res.jsendServerError(message);
                              }

                              if (token) {

                                 var obj = {
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
                                 return res.jsendSuccess(obj, 201);
                              }

                              return res.jsendClientError("Unknown email address", {email : userEmail}, 400);
                           });
                        });
                     }
                     else {
                        return res.jsendClientError("Client not specified.", null, 422);  // HTTP 422 Unprocessable Entity
                     }
                  }
                  else {
                     return res.jsendClientError("Email address not specified.", null, 422);  // HTTP 422 Unprocessable Entity
                  }
               }
   );

   router.put('/',
              function(req, res) {
                 var password = req.body.password;
                 var token = req.body.token;

                 if (password) {
                    if (token) {
                       UserModel.setPassword(token, password, function(err, wasSuccessful) {
                          if (err) {
                             if (err instanceof ValidationError) {
                                return res.jsendClientError("Validation failure", err.data, 422);  // HTTP 422 Unprocessable Entity
                             }
                             var message = "Error while trying set the new password";
                             log.error(message + ": " + err);
                             return res.jsendServerError(message);
                          }

                          if (wasSuccessful) {
                             return res.jsendSuccess(null, 200);
                          }

                          return res.jsendClientError("Unknown or invalid reset password token", null, 400);
                       });
                    }
                    else {
                       return res.jsendClientError("Reset password token not specified.", null, 422);  // HTTP 422 Unprocessable Entity
                    }
                 }
                 else {
                    return res.jsendClientError("Password not specified.", null, 422);  // HTTP 422 Unprocessable Entity
                 }
              }
   );

   return router;
};

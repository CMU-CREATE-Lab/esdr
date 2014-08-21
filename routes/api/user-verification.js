var config = require('../../config');
var express = require('express');
var router = express.Router();
var passport = require('passport');
var Mailer = require('../../lib/mailer');
var ValidationError = require('../../lib/errors').ValidationError;
var log = require('log4js').getLogger();

module.exports = function(UserModel, ClientModel) {

   /**
    * For requesting that the user verification email (sent upon account creation) be sent again.  Requires a JSON body
    * with the following schema:
    *
    * {
    * user: {
    *    email: USER_EMAIL_ADDRESS
    * },
    * client: {
    *    clientName: CLIENT_NAME,
    *    clientSecret: CLIENT_SECRET,
    *    displayName: CLIENT_DISPLAY_NAME,
    *    email: CLIENT_EMAIL_ADDRESS,
    *    verificationUrl: VERIFICATION_URL
    * }
    */
   router.post('/',
               function(req, res) {
                  var userEmail = (req.body.user) ? req.body.user.email : null;
                  var client = req.body.client;

                  if (userEmail) {
                     // if they specified the client, then try to authenticate
                     if (client) {
                        ClientModel.findByNameAndSecret(client.clientName, client.clientSecret, function(err1, theClient) {
                           if (err1) {
                              return res.jsendServerError("Error while authenticating client [" + client.clientName + "]");
                           }
                           if (!theClient) {
                              return res.jsendClientError("Failed to authenticate client.", {client : client}, 401);  // HTTP 401 Unauthorized
                           }

                           log.debug("Received POST to resend verification email for user [" + userEmail + "]");

                           UserModel.findByEmail(userEmail, function(err2, user) {
                              if (err2) {
                                 var message = "Error while trying to find user [" + userEmail + "] to resend verification token";
                                 log.error(message + ": " + err2);
                                 return res.jsendServerError(message);
                              }

                              if (user) {

                                 var obj = {
                                    email : user.email,
                                    isVerified : !!user.isVerified,
                                    verified : user.verified
                                 };
                                 // See whether we should return the verification token.  In most cases, we simply want to
                                 // email the verification token to the user (see below), to ensure the email address is
                                 // correct and actually belongs to the person who created the account. But, when testing, just
                                 // return it here so I don't have to write tests that check an email account :-)
                                 if (config.get("verificationToken:willReturnViaApi")) {
                                    obj.verificationToken = user.verificationToken
                                 }

                                 if (!user.isVerified && config.get("verificationToken:willEmailToUser")) {
                                    Mailer.sendVerificationEmail(client, user.email, user.verificationToken);
                                 }
                                 return res.jsendSuccess(obj, user.isVerified ? 200 : 201);
                              }

                              return res.jsendClientError("Unknown or invalid email address", {email : userEmail}, 400);
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

   /**
    * For verifying a verification token.  Expects a JSON body containing a "token" field with the verification token
    * as the value.
    */
   router.put('/',
              function(req, res) {
                 var verificationToken = req.body.token;
                 log.debug("Received PUT to verify token [" + verificationToken + "]");
                 if (verificationToken) {
                    UserModel.verify(verificationToken, function(err, result) {
                       if (err) {
                          var message = "Error while trying to verify user with verification token [" + verificationToken + "]";
                          log.error(message + ": " + err);
                          return res.jsendServerError(message);
                       }

                       if (result.isVerified) {
                          return res.jsendSuccess(result);
                       }

                       return res.jsendClientError("Invalid verification token", result, 400);
                    });
                 }
                 else {
                    return res.jsendClientError("Verification token not specified.", null, 422);  // HTTP 422 Unprocessable Entity
                 }
              }
   );

   return router;
};

var config = require('../../config');
var express = require('express');
var router = express.Router();
var passport = require('passport');
var Mailer = require('../../lib/mailer');
var ValidationError = require('../../lib/errors').ValidationError;
var httpStatus = require('http-status');
var log = require('log4js').getLogger();

module.exports = function(UserModel, ClientModel) {

   /**
    * For requesting that the user verification email (sent upon account creation) be sent again, optionally on behalf
    * of the client specified in the Authorization header using Basic auth.  By default, the email will be sent from an
    * ESDR email account, and will include an URL in the ESDR web site which the user can use to verify her/his account.
    * Specifying the client is only necessary if you wish to override the default sender email and verification link and
    * use the email and link for the client instead.
    *
    * Requires a JSON body with the following schema:
    *
    * {
    *    "email" : "EMAIL_ADDRESS"
    * }
    */
   router.post('/',
               function(req, res, next) {
                  var userEmail = req.body.email;

                  if (userEmail) {
                     var sendVerifcationEmail = function(client) {
                        log.debug("Received POST to resend verification email for user [" + userEmail + "]");

                        UserModel.findByEmail(userEmail, function(err, user) {
                           if (err) {
                              var message = "Error while trying to find user [" + userEmail + "] to resend verification token";
                              log.error(message + ": " + err);
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
                              return res.jsendSuccess(obj, user.isVerified ? httpStatus.OK : httpStatus.CREATED);
                           }

                           return res.jsendClientError("Unknown or invalid email address", {email : userEmail}, httpStatus.BAD_REQUEST);
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
                              return sendVerifcationEmail(client);
                           }

                           return res.jsendClientError("Authentication failed.", null, httpStatus.UNAUTHORIZED);  // HTTP 401 Unauthorized

                        })(req, res, next);
                     }
                     else {
                        return sendVerifcationEmail();
                     }
                  }
                  else {
                     return res.jsendClientValidationError("Email address not specified.", null);  // HTTP 422 Unprocessable Entity
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

                       return res.jsendClientError("Invalid verification token", result, httpStatus.BAD_REQUEST);
                    });
                 }
                 else {
                    return res.jsendClientValidationError("Verification token not specified.", null);  // HTTP 422 Unprocessable Entity
                 }
              }
   );

   return router;
};

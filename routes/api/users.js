var config = require('../../config');
var express = require('express');
var router = express.Router();
var passport = require('passport');
var Mailer = require('../../lib/mailer');
var ValidationError = require('../../lib/errors').ValidationError;
var DuplicateRecordError = require('../../lib/errors').DuplicateRecordError;
var log = require('log4js').getLogger();

module.exports = function(UserModel, ClientModel) {

   var sendVerificationEmail = function(client, user, verificationToken) {
      var sender = {
         name : client.displayName || config.get("mail:sender:name"),
         email : client.verificationEmail || config.get("mail:sender:email")
      };
      var recipientEmail = user.email;

      // build the verification URL
      var verificationUrl = client.verificationUrl || config.get("verificationToken:url");
      verificationUrl = verificationUrl.replace(/\:verificationToken/gi, verificationToken);

      // send the email later
      process.nextTick(function() {
         Mailer.sendVerificationEmail(sender, recipientEmail, verificationUrl, function(err, mailResult) {
            if (err) {
               log.error("Error sending verification email to [" + recipientEmail + "]: " + err);
            }
            else {
               log.info("Verification email sent to [" + recipientEmail + "].  Result: " + JSON.stringify(mailResult, null, 3));
            }
         });
      });
   };

   var createUser = function(res, user, client) {
      log.debug("Received POST to create user [" + (user && user.email ? user.email : null) + "]");

      UserModel.create(user,
                       function(err, result) {
                          if (err) {
                             if (err instanceof ValidationError) {
                                return res.jsendClientError("Validation failure", err.data);
                             }
                             if (err instanceof DuplicateRecordError) {
                                log.debug("Email [" + user.email + "] already in use!");
                                return res.jsendClientError("Email already in use.", {email : user.email}, 409);  // HTTP 409 Conflict
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
                             sendVerificationEmail(client, user, result.verificationToken);
                          }

                          return res.jsendSuccess(obj, 201); // HTTP 201 Created
                       });
   };

   var resendVerificationEmail = function(res, userEmail, client) {
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
               sendVerificationEmail(client, user, user.verificationToken);
            }
            return res.jsendSuccess(obj, user.isVerified ? 200 : 201);
         }

         return res.jsendClientError("Unknown or invalid email address", {email: userEmail}, 400);
      });
   };

   /**
    * Creates the given user on behalf of the given client (if any). After the user is created, an email will be sent
    * to the user (if configured to do so, depending on the current Node runtime environment).  By default, the email
    * will be sent from an ESDR email account, and will include an URL in the ESDR web site which the user can use to
    * verify her/his account.  Specifying the client is only necessary if you wish to override the default sender email
    * and verification link and use the email and link for the client instead.
    *
    * The submitted JSON must use the following schema:
    *
    * {
    *    "client" : {
    *       "clientName" : "CLIENT_ID",
    *       "clientSecret" : "CLIENT_SECRET"
    *    },
    *    "user" : {
    *       "email" : "EMAIL_ADDRESS",
    *       "password" : "PASSWORD"
    *    }
    * }
    *
    * Possible JSend responses:
    * - Success 201: the user was created successfully
    * - Client Error 400: the user was not specified or fails validation
    * - Client Error 401: the client was specified, but failed authentication
    * - Client Error 409: a user with the same email already exists
    * - Server Error 500: an unexpected error occurred
    */
   router.post('/',
               function(req, res) {
                  var user = req.body.user || {};
                  var client = req.body.client;

                  // if they specified the client, then try to authenticate
                  if (client) {
                     ClientModel.findByNameAndSecret(client.clientName, client.clientSecret, function(err, theClient) {
                        if (err) {
                           return res.jsendServerError("Error while authenticating client [" + client.clientName + "]");
                        }
                        if (!theClient) {
                           return res.jsendClientError("Failed to authenticate client.", {client : client}, 401);  // HTTP 409 Unauthorized
                        }

                        return createUser(res, user, theClient);
                     });
                  }
                  else {
                     return createUser(res, user, null);
                  }
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

   router.post('/:emailAddress/resendVerification',
               function(req, res) {
                  var client = req.body.client;

                  // if they specified the client, then try to authenticate
                  if (client) {
                     ClientModel.findByNameAndSecret(client.clientName, client.clientSecret, function(err, theClient) {
                        if (err) {
                           return res.jsendServerError("Error while authenticating client [" + client.clientName + "]");
                        }
                        if (!theClient) {
                           return res.jsendClientError("Failed to authenticate client.", {client : client}, 401);  // HTTP 409 Unauthorized
                        }

                        return resendVerificationEmail(res, req.params.emailAddress, theClient);
                     });
                  }
                  else {
                     return resendVerificationEmail(res, req.params.emailAddress, null);
                  }
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

var config = require('../config');
var nodemailer = require('nodemailer');
var smtpTransport = require('nodemailer-smtp-transport');
var log = require('log4js').getLogger();

// create reusable transporter object using SMTP transport
var transporter = nodemailer.createTransport(smtpTransport({
                                                              host : config.get("mail:smtp:host"),
                                                              port : config.get("mail:smtp:port"),
                                                              auth : {
                                                                 user : config.get("mail:smtp:login"),
                                                                 pass : config.get("mail:smtp:password")
                                                              }
                                                           }));

module.exports = {
   sendVerificationEmail : function(sender, recipientEmail, verificationUrl, callback) {
      log.debug("Sending verification email from: [" + sender.email + "] to [" + recipientEmail + "]");

      // build the email
      var mailOptions = {
         from : sender.name + " <" + sender.email + ">",             // sender address
         to : recipientEmail,                                        // list of receivers
         subject : 'Verify your account',                            // Subject line
         text : 'Please verify your account by opening this URL in your browser: ' + verificationUrl, // plaintext body
         html : 'Please <a href="' + verificationUrl + '">click this link</a> to verify your account.' // html body
      };

      // send mail with defined transport object
      transporter.sendMail(mailOptions, callback);
   },

   sendResetPasswordEmail : function(sender, recipientEmail, resetPasswordUrl, callback) {
      log.debug("Sending reset password email from: [" + sender.email + "] to [" + recipientEmail + "]");

      // build the email
      var mailOptions = {
         from : sender.name + " <" + sender.email + ">",             // sender address
         to : recipientEmail,                                        // list of receivers
         subject : 'Reset your password',                            // Subject line
         text : 'Please open this URL in your browser to reset your password: ' + resetPasswordUrl, // plaintext body
         html : 'Please <a href="' + resetPasswordUrl + '">click this link</a> to reset your password.' // html body
      };

      // send mail with defined transport object
      transporter.sendMail(mailOptions, callback);
   }
};
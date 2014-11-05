var express = require('express');
var router = express.Router();
var config = require('../config');

router.get('/', function(req, res) {
   res.render('password-reset',
              {
                 title : "ESDR: Reset Password",
                 apiRootUrl : config.get("esdr:apiRootUrl")
              }
   );
});

router.get('/:resetPasswordToken', function(req, res) {
   // since we'll be injecting the reset password token into JavaScript,
   // be paranoid and remove anything that's not a valid hex character
   var cleanedResetPasswordToken = (req.params.resetPasswordToken) ? req.params.resetPasswordToken.replace(/([^a-f0-9]+)/gi, '') : "";
   res.render('password-reset',
              {
                 title : "ESDR: Reset Password",
                 resetPasswordToken : cleanedResetPasswordToken,
                 apiRootUrl : config.get("esdr:apiRootUrl")
              }
   );
});

module.exports = router;

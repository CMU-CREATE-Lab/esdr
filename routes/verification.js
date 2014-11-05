var express = require('express');
var router = express.Router();
var config = require('../config');

router.get('/:verificationToken', function(req, res) {
   // since we'll be injecting the verification token into JavaScript,
   // be paranoid and remove anything that's not a valid hex character
   var cleanedVerificationToken = (req.params.verificationToken) ? req.params.verificationToken.replace(/([^a-f0-9]+)/gi, '') : "";
   res.render('verification',
              {
                 title : "ESDR: Verify Your Account",
                 verificationToken : cleanedVerificationToken,
                 apiRootUrl : config.get("esdr:apiRootUrl")
              }
   );
});

router.get('/', function(req, res) {
   res.render('verification',
              {
                 title : "ESDR: Resend Account Verification Email",
                 apiRootUrl : config.get("esdr:apiRootUrl")
              }
   );
});

module.exports = router;

var express = require('express');
var router = express.Router();

router.get('/', function(req, res) {
   res.render('index', { title : "ESDR"});
});

router.get('/verification/:verificationToken', function(req, res) {
   // since we'll be injecting the verification token into JavaScript,
   // be paranoid and remove anything that's not a valid hex character
   var cleanedVerificationToken = (req.params.verificationToken) ? req.params.verificationToken.replace(/([^a-f0-9]+)/gi, '') : "";
   res.render('verification', { title : "ESDR: Verify Your Account", verificationToken : cleanedVerificationToken});
});

module.exports = router;

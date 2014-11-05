var express = require('express');
var router = express.Router();
var config = require('../config');

router.get('/', function(req, res) {
   res.render('signup',
              {
                 title : "ESDR: Sign Up",
                 apiRootUrl : config.get("esdr:apiRootUrl")
              }
   );
});

module.exports = router;

const express = require('express');
const router = express.Router();
const config = require('../config');

router.get('/', function(req, res) {
   res.render('signup',
              {
                 title : "ESDR: Sign Up",
                 apiRootUrl : config.get("esdr:apiRootUrl")
              }
   );
});

module.exports = router;

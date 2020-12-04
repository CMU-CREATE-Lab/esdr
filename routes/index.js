const express = require('express');
const router = express.Router();
const config = require('../config');

router.get('/', function(req, res) {
   if (req.isAuthenticated()) {
      res.redirect('home');
   }
   else {
      res.render('index', {
         title : "ESDR",
         apiRootUrl : config.get("esdr:apiRootUrl")
      });
   }
});

module.exports = router;

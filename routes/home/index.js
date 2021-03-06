const express = require('express');
const router = express.Router();
const config = require('../../config');

router.get('/', function(req, res) {
   res.render('home/index', { title : "ESDR" });
});

router.get('/clients', function(req, res) {
   res.render('home/clients',
              {
                 title : "ESDR: Clients",
                 entity : "clients",
                 defaultResetPasswordUrl : config.get("esdrClient:resetPasswordUrl"),
                 defaultVerificationUrl : config.get("esdrClient:verificationUrl")
              });
});

// router.get('/products', function(req, res) {
//    res.render('home/products', { title : "ESDR: Products", entity : "products" });
// });
//
// router.get('/devices', function(req, res) {
//    res.render('home/devices', { title : "ESDR: Devices", entity : "devices" });
// });
//
// router.get('/feeds', function(req, res) {
//    res.render('home/feeds', { title : "ESDR: Feeds", entity : "feeds" });
// });

module.exports = router;

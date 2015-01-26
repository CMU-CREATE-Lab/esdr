var express = require('express');
var router = express.Router();

router.get('/', function(req, res) {
   res.render('home/index', { title : "ESDR"});
});

module.exports = router;

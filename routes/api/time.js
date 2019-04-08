var express = require('express');
var router = express.Router();
var httpStatus = require('http-status');

var NUM_CHECKSUM_BYTES = 4;

var computeChecksum = function(number) {
   // compute a checksum by summing the 4 bytes and then using only the lowest 8 bits
   var b = Buffer.alloc(4);
   b.writeInt32BE(number);

   var sum = 0;
   for (var i = 0; i < NUM_CHECKSUM_BYTES; i++) {
      sum += b.readUInt8(i);
   }

   return sum & 0xff;
};

router.get('/unix-time-seconds', function(req, res) {
   var unixTimeSecs = Math.round(Date.now() / 1000);

   var time = {
      unixTimeSecs : unixTimeSecs,
      checksum : computeChecksum(unixTimeSecs)
   };

   // make sure this response isn't cached
   res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
   res.header('Expires', '-1');
   res.header('Pragma', 'no-cache');

   // determine response format
   if (req.query && req.query.format == "text") {
      res.set('Content-Type', 'text/plain');
      res.send("unixTimeSecs=" + time.unixTimeSecs + ",checksum=" + time.checksum);
   }
   else {
      return res.jsendSuccess(time, httpStatus.OK); // HTTP 200 OK
   }

});

module.exports = router;

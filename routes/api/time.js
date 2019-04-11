const express = require('express');
const router = express.Router();
const httpStatus = require('http-status');

const NUM_CHECKSUM_BYTES = 4;

const computeChecksum = function(number) {
   // compute a checksum by summing the 4 bytes and then using only the lowest 8 bits
   const b = Buffer.alloc(4);
   b.writeInt32BE(number, 0);

   let sum = 0;
   for (let i = 0; i < NUM_CHECKSUM_BYTES; i++) {
      sum += b.readUInt8(i);
   }

   return sum & 0xff;
};

router.get('/unix-time-seconds', function(req, res) {
   const unixTimeSecs = Math.round(Date.now() / 1000);

   const time = {
      unixTimeSecs : unixTimeSecs,
      checksum : computeChecksum(unixTimeSecs)
   };

   // make sure this response isn't cached
   res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
   res.header('Expires', '-1');
   res.header('Pragma', 'no-cache');

   // determine response format
   if (req.query && req.query.format === "text") {
      res.set('Content-Type', 'text/plain');
      res.send("unixTimeSecs=" + time.unixTimeSecs + ",checksum=" + time.checksum);
   }
   else {
      return res.jsendSuccess(time, httpStatus.OK); // HTTP 200 OK
   }

});

module.exports = router;

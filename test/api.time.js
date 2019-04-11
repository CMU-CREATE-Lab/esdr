const should = require('should');
const httpStatus = require('http-status');
const superagent = require('superagent-ls');

const config = require('../config');

const ESDR_API_ROOT_URL = config.get("esdr:apiRootUrl");
const ESDR_TIME_API_URL = ESDR_API_ROOT_URL + "/time";

describe("REST API", function() {
   describe("Time", function() {
      describe("UNIX Time Seconds", function() {

         const computeChecksum = function(time) {
            const b = Buffer.alloc(4);
            b.writeInt32BE(time, 0);
            return 0xff & b.toJSON().data.reduce(
                  function(prev, cur) {
                     return prev + cur;
                  }, 0);
         };

         it("Should be able to get the current time as JSON", function(done) {
            superagent
                  .get(ESDR_TIME_API_URL + "/unix-time-seconds")
                  .end(function(err, res) {
                     should.not.exist(err);
                     should.exist(res);

                     res.should.have.property('status', httpStatus.OK);
                     res.should.have.property('body');
                     res.body.should.have.properties({
                                                        code : httpStatus.OK,
                                                        status : 'success'
                                                     });

                     res.body.should.have.property('data');
                     res.body.data.should.have.property('unixTimeSecs');
                     res.body.data.should.have.property('checksum', computeChecksum(res.body.data.unixTimeSecs));

                     // make sure the unixTimeSecs is within 1 second of the current time (just so the test doesn't fail
                     // if the server and test client compute current times that round to be different UTC seconds)
                     const currentTimeSecs = Math.round(Date.now() / 1000);
                     const isWithinOneSecond = Math.abs(currentTimeSecs - res.body.data.unixTimeSecs) <= 1;
                     isWithinOneSecond.should.be.true();

                     done();
                  });
         });

         it("Should be able to get the current time as text", function(done) {
            superagent
                  .get(ESDR_TIME_API_URL + "/unix-time-seconds?format=text")
                  .end(function(err, res) {
                     should.not.exist(err);
                     should.exist(res);

                     res.should.have.property('status', httpStatus.OK);
                     res.header.should.have.property('content-type', 'text/plain; charset=utf-8');
                     res.should.have.property('text');
                     const parts = res.text.split(',');
                     const time = parseInt(parts[0].split('=')[1]);
                     const checksum = parseInt(parts[1].split('=')[1]);
                     checksum.should.equal(computeChecksum(time));

                     // make sure the unixTimeSecs is within 1 second of the current time (just so the test doesn't fail
                     // if the server and test client compute current times that round to be different UTC seconds)
                     const currentTimeSecs = Math.round(Date.now() / 1000);
                     const isWithinOneSecond = Math.abs(currentTimeSecs - time) <= 1;
                     isWithinOneSecond.should.be.true();

                     done();
                  });
         });

      });   // End UTC Seconds
   });   // End Time
});   // End REST API
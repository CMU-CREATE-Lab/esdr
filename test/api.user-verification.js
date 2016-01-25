var should = require('should');
var flow = require('nimble');
var httpStatus = require('http-status');
var superagent = require('superagent-ls');
var requireNew = require('require-new');
var wipe = require('./fixture-helpers/wipe');
var setup = require('./fixture-helpers/setup');

var config = require('../config');

var ESDR_API_ROOT_URL = config.get("esdr:apiRootUrl");
var ESDR_USER_VERIFICATION_API_URL = ESDR_API_ROOT_URL + "/user-verification";

describe("REST API", function() {
   var client1 = requireNew('./fixtures/client1.json');
   var user1 = requireNew('./fixtures/user1.json');
   var user2 = requireNew('./fixtures/user2.json');

   before(function(initDone) {
      flow.series(
            [
               wipe.wipeAllData,
               function(done) {
                  setup.createClient(client1, done);
               },
               function(done) {
                  setup.createUser(user1, done);
               },
               function(done) {
                  setup.createUser(user2, done);
               }
            ],
            initDone
      );
   });

   describe("User Verification", function() {

      var testRequestVerificationToken = function(test) {
         var client = test.client || client1;
         it(test.description, function(done) {
            superagent
                  .post(ESDR_USER_VERIFICATION_API_URL)
                  .auth(client.clientName, client.clientSecret)
                  .send({ email : test.email })
                  .end(function(err, res) {
                     should.not.exist(err);
                     should.exist(res);

                     res.should.have.property('status', test.expectedHttpStatus);
                     res.should.have.property('body');
                     res.body.should.have.properties({
                                                        code : test.expectedHttpStatus,
                                                        status : test.expectedStatusText || 'success'
                                                     });

                     if (typeof test.expectedResponseData !== 'undefined') {
                        res.body.should.have.property('data');

                        if (typeof res.body.data.isVerified !== 'undefined') {
                           if (res.body.data.isVerified) {
                              res.body.data.verified.should.not.equal('0000-00-00 00:00:00');
                           }
                           else {
                              res.body.data.verified.should.equal('0000-00-00 00:00:00');
                           }
                        }

                        res.body.data.should.have.properties(test.expectedResponseData);
                     }

                     done();
                  });
         });
      };

      var testVerifyUser = function(test) {
         it(test.description, function(done) {
            superagent
                  .put(ESDR_USER_VERIFICATION_API_URL)
                  .send({ token : test.verificationToken })
                  .end(function(err, res) {
                     should.not.exist(err);
                     should.exist(res);

                     res.should.have.property('status', test.expectedHttpStatus);
                     res.should.have.property('body');
                     res.body.should.have.properties({
                                                        code : test.expectedHttpStatus,
                                                        status : test.expectedStatusText || 'success'
                                                     });
                     res.body.should.have.property('data');

                     res.body.data.should.have.properties(test.expectedResponseData);

                     done();
                  });
         });
      };

      testRequestVerificationToken({
                                      description : "Should be able to request that the verification token be sent " +
                                                    "again (after creation, before verification)",
                                      email : user1.email,
                                      expectedHttpStatus : httpStatus.CREATED,
                                      expectedResponseData : {
                                         email : user1.email,
                                         isVerified : false,
                                         verified : '0000-00-00 00:00:00',
                                         verificationToken : user1.verificationToken
                                      }
                                   });

      testVerifyUser({
                        description : "Should be able to verify a user",
                        verificationToken : user1.verificationToken,
                        expectedHttpStatus : httpStatus.OK,
                        expectedResponseData : {
                           isVerified : true
                        }
                     });

      testVerifyUser({
                        description : "Should be able to verify another user",
                        verificationToken : user2.verificationToken,
                        expectedHttpStatus : httpStatus.OK,
                        expectedResponseData : {
                           isVerified : true
                        }
                     });

      testRequestVerificationToken({
                                      description : "Should be able to request that the verification token be sent " +
                                                    "again (after creation, after verification)",
                                      email : user1.email,
                                      expectedHttpStatus : httpStatus.OK,
                                      expectedResponseData : {
                                         email : user1.email,
                                         isVerified : true,
                                         verificationToken : user1.verificationToken
                                      }
                                   });

      testRequestVerificationToken({
                                      description : "Should return the same thing if a request to send the " +
                                                    "verification token is made again",
                                      email : user1.email,
                                      expectedHttpStatus : httpStatus.OK,
                                      expectedResponseData : {
                                         email : user1.email,
                                         isVerified : true,
                                         verificationToken : user1.verificationToken
                                      }
                                   });

      it("A request for the verification token to be sent should not require client authentication", function(done) {
         superagent
               .post(ESDR_USER_VERIFICATION_API_URL)
               .send({ email : user1.email })
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
                  res.body.data.should.have.properties({
                                                          email : user1.email,
                                                          isVerified : true,
                                                          verificationToken : user1.verificationToken
                                                       });
                  res.body.data.should.have.property('isVerified');
                  res.body.data.verified.should.not.equal('0000-00-00 00:00:00');

                  done();
               });

      });

      testRequestVerificationToken({
                                      description : "A request for the verification token to be sent should fail if " +
                                                    "the client authentication is invalid",
                                      email : user1.email,
                                      client : {
                                         clientName : client1.clientName,
                                         clientSecret : "bogus"
                                      },
                                      expectedHttpStatus : httpStatus.UNAUTHORIZED,
                                      expectedStatusText : 'error'
                                   });

      it("Verification should fail for a missing verification token", function(done) {
         superagent
               .put(ESDR_USER_VERIFICATION_API_URL)
               .end(function(err, res) {
                  should.not.exist(err);
                  should.exist(res);

                  res.should.have.property('status', httpStatus.UNPROCESSABLE_ENTITY);
                  res.should.have.property('body');
                  res.body.should.have.properties({
                                                     code : httpStatus.UNPROCESSABLE_ENTITY,
                                                     status : 'error'
                                                  });
                  res.body.should.have.property('data', null);

                  done();
               });
      });

      testVerifyUser({
                        description : "Verification should fail for a bogus verification token",
                        verificationToken : "bogus",
                        expectedHttpStatus : httpStatus.BAD_REQUEST,
                        expectedStatusText : 'error',
                        expectedResponseData : {
                           isVerified : false
                        }
                     });

      testRequestVerificationToken({
                                      description : "Should fail when requesting that the verification token be sent " +
                                                    "again for an unknown user",
                                      email : 'unknown@unknown.com',
                                      client : client1,
                                      expectedHttpStatus : httpStatus.BAD_REQUEST,
                                      expectedStatusText : 'error',
                                      expectedResponseData : {
                                         email : 'unknown@unknown.com'
                                      }
                                   });

      testRequestVerificationToken({
                                      description : "Should fail when requesting that the verification token be sent " +
                                                    "again but the email address is not given",
                                      client : client1,
                                      expectedHttpStatus : httpStatus.UNPROCESSABLE_ENTITY,
                                      expectedStatusText : 'error'
                                   });

   });   // End User Verification
});   // End REST API
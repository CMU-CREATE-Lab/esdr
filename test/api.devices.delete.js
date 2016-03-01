var should = require('should');
var flow = require('nimble');
var httpStatus = require('http-status');
var superagent = require('superagent-ls');
var requireNew = require('require-new');
var wipe = require('./fixture-helpers/wipe');
var setup = require('./fixture-helpers/setup');
var createAuthorizationHeader = require('./fixture-helpers/test-utils').createAuthorizationHeader;

var config = require('../config');

var ESDR_API_ROOT_URL = config.get("esdr:apiRootUrl");
var ESDR_DEVICES_API_URL = ESDR_API_ROOT_URL + "/devices";

describe("REST API", function() {
   var user1 = requireNew('./fixtures/user1.json');
   var user2 = requireNew('./fixtures/user2.json');
   var product1 = requireNew('./fixtures/product1.json');
   var device1User1 = requireNew('./fixtures/device1.json');
   var device1User2 = requireNew('./fixtures/device1.json');
   var device2User1 = requireNew('./fixtures/device2.json');
   var feed1 = requireNew('./fixtures/feed1.json');
   var feed2 = requireNew('./fixtures/feed2.json');
   var feed3 = requireNew('./fixtures/feed3.json');

   before(function(initDone) {
      flow.series(
            [
               wipe.wipeAllData,
               function(done) {
                  setup.createUser(user1, done);
               },
               function(done) {
                  setup.createUser(user2, done);
               },
               function(done) {
                  setup.verifyUser(user1, done);
               },
               function(done) {
                  setup.verifyUser(user2, done);
               },
               function(done) {
                  setup.authentcateUser(user1, done);
               },
               function(done) {
                  setup.authentcateUser(user2, done);
               },
               function(done) {
                  product1.creatorUserId = user1.id;
                  setup.createProduct(product1, done);
               },
               function(done) {
                  device1User1.userId = user1.id;
                  device1User1.productId = product1.id;
                  setup.createDevice(device1User1, done);
               },
               function(done) {
                  device1User2.userId = user2.id;
                  device1User2.productId = product1.id;
                  setup.createDevice(device1User2, done);
               },
               function(done) {
                  device2User1.userId = user1.id;
                  device2User1.productId = product1.id;
                  setup.createDevice(device2User1, done);
               },
               function(done) {
                  feed1.userId = user1.id;
                  feed1.deviceId = device2User1.id;
                  feed1.productId = product1.id;
                  feed1.channelSpecs = product1.defaultChannelSpecs;
                  setup.createFeed(feed1, done);
               },
               function(done) {
                  feed2.userId = user1.id;
                  feed2.deviceId = device2User1.id;
                  feed2.productId = product1.id;
                  feed2.channelSpecs = product1.defaultChannelSpecs;
                  setup.createFeed(feed2, done);
               },
               function(done) {
                  feed3.userId = user1.id;
                  feed3.deviceId = device2User1.id;
                  feed3.productId = product1.id;
                  feed3.channelSpecs = product1.defaultChannelSpecs;
                  setup.createFeed(feed3, done);
               }

            ],
            initDone
      );
   });

   describe("Devices", function() {

      describe("Delete", function() {

         var executeDelete = function(test, done) {
            superagent
                  .del(test.url)
                  .set(typeof test.headers === 'undefined' ? {} : test.headers)
                  .end(function(err, res) {
                     should.not.exist(err);
                     should.exist(res);

                     if (test.willDebug) {
                        console.log(JSON.stringify(res.body, null, 3));
                     }

                     res.should.have.property('status', test.expectedHttpStatus);

                     res.should.have.property('body');
                     if (test.hasEmptyBody) {
                        res.body.should.be.empty();
                     }
                     else {
                        res.body.should.have.properties({
                                                           code : test.expectedHttpStatus,
                                                           status : test.expectedStatusText
                                                        });

                        if (typeof test.expectedResponseData !== 'undefined') {
                           if (test.expectedResponseData == null) {
                              res.body.should.have.property('data', null);
                           }
                           else {
                              res.body.should.have.property('data');
                              res.body.data.should.have.properties(test.expectedResponseData);
                           }
                        }
                     }

                     if (typeof test.additionalTests === 'function') {
                        test.additionalTests(err, res, done);
                     }
                     else {
                        done();
                     }
                  });
         };

         describe("No Authentication", function() {
            it("Shouldn't be able to delete a device without authentication", function(done) {
               executeDelete({
                                url : ESDR_DEVICES_API_URL + "/" + device1User1.id,
                                expectedHttpStatus : httpStatus.UNAUTHORIZED,
                                expectedStatusText : 'error',
                                hasEmptyBody : true
                             }, done);
            });
         });   // End No Authentication

         describe("OAuth2 authentication", function() {

            it("Shouldn't be able to delete a device with an invalid ID", function(done) {
               executeDelete({
                                url : ESDR_DEVICES_API_URL + "/" + 0,
                                headers : createAuthorizationHeader(user1.accessToken),
                                expectedHttpStatus : httpStatus.NOT_FOUND,
                                expectedStatusText : 'error',
                                expectedResponseData : { id : 0 }
                             }, done);
            });

            it("Shouldn't be able to delete a device with an invalid access token", function(done) {
               executeDelete({
                                url : ESDR_DEVICES_API_URL + "/" + device1User1.id,
                                headers : createAuthorizationHeader("bogus"),
                                expectedHttpStatus : httpStatus.UNAUTHORIZED,
                                expectedStatusText : 'error',
                                hasEmptyBody : true
                             }, done);
            });

            it("Should be able to delete a device with authentication by the owning user", function(done) {
               executeDelete({
                                url : ESDR_DEVICES_API_URL + "/" + device1User1.id,
                                headers : createAuthorizationHeader(user1.accessToken),
                                expectedHttpStatus : httpStatus.OK,
                                expectedStatusText : 'success',
                                expectedResponseData : { id : device1User1.id }
                             }, done);
            });

            it("Shouldn't be able to delete the same device again", function(done) {
               executeDelete({
                                url : ESDR_DEVICES_API_URL + "/" + device1User1.id,
                                headers : createAuthorizationHeader(user1.accessToken),
                                expectedHttpStatus : httpStatus.NOT_FOUND,
                                expectedStatusText : 'error',
                                expectedResponseData : { id : device1User1.id }
                             }, done);
            });

            it("Shouldn't be able to delete a device owned by a different user", function(done) {
               executeDelete({
                                url : ESDR_DEVICES_API_URL + "/" + device1User2.id,
                                headers : createAuthorizationHeader(user1.accessToken),
                                expectedHttpStatus : httpStatus.FORBIDDEN,
                                expectedStatusText : 'error',
                                expectedResponseData : { id : device1User2.id }
                             }, done);
            });

            it("Shouldn't be able to delete a device which has feeds associated with it", function(done) {
               executeDelete({
                                url : ESDR_DEVICES_API_URL + "/" + device2User1.id,
                                headers : createAuthorizationHeader(user1.accessToken),
                                expectedHttpStatus : httpStatus.CONFLICT,
                                expectedStatusText : 'error',
                                expectedResponseData : { id : device2User1.id },
                                additionalTests : function(originalError, origianalResponse, done) {
                                   should.not.exist(originalError);
                                   should.exist(origianalResponse);

                                   // make sure the response gives the IDs of the dependent feeds
                                   origianalResponse.should.have.property('body');
                                   origianalResponse.body.should.have.property('data');
                                   origianalResponse.body.data.should.have.property('feedIds', [feed1.id, feed2.id, feed3.id]);

                                   done();
                                }
                             }, done);
            });

            it("Should be able to delete a device after deleting its dependent feeds", function(done) {
               // delete the feeds
               flow.series([
                              function(done) {
                                 setup.deleteFeed(feed1.id, done)
                              },
                              function(done) {
                                 setup.deleteFeed(feed2.id, done)
                              },
                              function(done) {
                                 setup.deleteFeed(feed3.id, done)
                              }
                           ],
                           function() {
                              executeDelete({
                                               url : ESDR_DEVICES_API_URL + "/" + device2User1.id,
                                               headers : createAuthorizationHeader(user1.accessToken),
                                               expectedHttpStatus : httpStatus.OK,
                                               expectedStatusText : 'success',
                                               expectedResponseData : { id : device2User1.id }
                                            }, done);
                           });
            });


         });   // End OAuth2 authentication
      });   // End Delete

   });   // End Devices
});   // End REST API
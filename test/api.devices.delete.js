const should = require('should');
const flow = require('nimble');
const httpStatus = require('http-status');
const superagent = require('superagent-ls');
const requireNew = require('require-new');
const wipe = require('./fixture-helpers/wipe');
const setup = require('./fixture-helpers/setup');
const createAuthorizationHeader = require('./fixture-helpers/test-utils').createAuthorizationHeader;

const config = require('../config');

const ESDR_API_ROOT_URL = config.get("esdr:apiRootUrl");
const ESDR_DEVICES_API_URL = ESDR_API_ROOT_URL + "/devices";

describe("REST API", function() {
   const client1 = requireNew('./fixtures/client1.json');
   const client2 = requireNew('./fixtures/client2.json');
   const user1 = requireNew('./fixtures/user1.json');
   const user2 = requireNew('./fixtures/user2.json');
   let user1Client2 = null;
   const product1 = requireNew('./fixtures/product1.json');
   const device1User1 = requireNew('./fixtures/device1.json');
   const device1User2 = requireNew('./fixtures/device1.json');
   const device2User1 = requireNew('./fixtures/device2.json');
   const device3 = requireNew('./fixtures/device3.json');
   const device4 = requireNew('./fixtures/device4.json');
   const feed1 = requireNew('./fixtures/feed1.json');
   const feed2 = requireNew('./fixtures/feed2.json');
   const feed3 = requireNew('./fixtures/feed3.json');

   before(function(initDone) {
      flow.series(
            [
               wipe.wipeAllData,
               function(done) {
                  setup.createClient(client1, done);
               },
               function(done) {
                  setup.createClient(client2, done);
               },
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
                  setup.authenticateUserWithClient(user1, client1, done);
               },
               function(done) {
                  // authenticate the same user with a different client
                  user1Client2 = JSON.parse(JSON.stringify(user1));
                  setup.authenticateUserWithClient(user1Client2, client2, done);
               },
               function(done) {
                  setup.authenticateUser(user2, done);
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
                  device3.userId = user1.id;
                  device3.productId = product1.id;
                  setup.createDevice(device3, done);
               },
               function(done) {
                  device4.userId = user1.id;
                  device4.productId = product1.id;
                  setup.createDevice(device4, done);
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

         const executeDelete = function(test, done) {
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

         const verifyDeviceIsDeleted = function(deviceId, user, done) {
            superagent
                  .get(ESDR_DEVICES_API_URL + "/" + deviceId)
                  .set(createAuthorizationHeader(user.accessToken))
                  .end(function(err, res) {
                     should.not.exist(err);
                     should.exist(res);

                     res.should.have.property('status', httpStatus.NOT_FOUND);
                     res.should.have.property('body');
                     res.body.should.have.properties({
                                                        code : httpStatus.NOT_FOUND,
                                                        status : 'error'
                                                     });

                     done();
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

            it("Shouldn't be able to delete a device with an invalid ID (0)", function(done) {
               executeDelete({
                                url : ESDR_DEVICES_API_URL + "/" + 0,
                                headers : createAuthorizationHeader(user1.accessToken),
                                expectedHttpStatus : httpStatus.NOT_FOUND,
                                expectedStatusText : 'error',
                                expectedResponseData : null
                             }, done);
            });

            it("Shouldn't be able to delete a device with an invalid ID (negative int)", function(done) {
               executeDelete({
                                url : ESDR_DEVICES_API_URL + "/" + (-30),
                                headers : createAuthorizationHeader(user1.accessToken),
                                expectedHttpStatus : httpStatus.NOT_FOUND,
                                expectedStatusText : 'error',
                                expectedResponseData : null
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
                                expectedResponseData : { id : device1User1.id },
                                additionalTests : function(originalError, origianalResponse, done) {
                                   // make sure the feed no longer exists
                                   verifyDeviceIsDeleted(device1User1.id, user1, done);
                                }
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
                                               expectedResponseData : { id : device2User1.id },
                                               additionalTests : function(originalError, origianalResponse, done) {
                                                  // make sure the feed no longer exists
                                                  verifyDeviceIsDeleted(device2User1.id, user1, done);
                                               }
                                            }, done);
                           });
            });

            describe("Cascading Delete of Device Properties", function() {
               const setProperty = function(deviceId, accessToken, propertyKey, propertyValue, callback, willDebug) {
                  superagent
                        .put(ESDR_DEVICES_API_URL + "/" + deviceId + "/properties/" + propertyKey)
                        .set(createAuthorizationHeader(accessToken))
                        .send(propertyValue)
                        .end(function(err, res) {
                           should.not.exist(err);
                           should.exist(res);

                           if (willDebug) {
                              console.log(JSON.stringify(res.body, null, 3));
                           }

                           res.should.have.property('status', httpStatus.OK);
                           res.should.have.property('body');
                           res.body.should.have.properties({
                                                              code : httpStatus.OK,
                                                              status : 'success'
                                                           });
                           res.body.should.have.property('data');

                           const expectedResponse = {};
                           expectedResponse[propertyKey] = propertyValue.value;
                           res.body.data.should.have.properties(expectedResponse);

                           callback();
                        });
               };

               const getProperty = function(deviceId, accessToken, propertyKey, callback, willDebug, expectedValue) {
                  superagent
                        .get(ESDR_DEVICES_API_URL + "/" + deviceId + "/properties/" + propertyKey)
                        .set(createAuthorizationHeader(accessToken))
                        .end(function(err, res) {
                           should.not.exist(err);
                           should.exist(res);

                           if (willDebug) {
                              console.log(JSON.stringify(res.body, null, 3));
                           }

                           res.should.have.property('status', httpStatus.OK);
                           res.should.have.property('body');
                           res.body.should.have.properties({
                                                              code : httpStatus.OK,
                                                              status : 'success'
                                                           });

                           res.body.should.have.property('data');

                           if (typeof expectedValue !== 'undefined') {
                              const expectedResponse = {};
                              expectedResponse[propertyKey] = expectedValue;
                              res.body.data.should.have.properties(expectedResponse);
                           }

                           callback();
                        });
               };

               before(function(initDone) {
                  flow.series([
                                 // set a property on device 3 with client 1
                                 function(done) {
                                    setProperty(device3.id,
                                                user1.accessToken,
                                                'foo',
                                                { type : 'int', value : 42 },
                                                done);
                                 },
                                 // verify the property is set
                                 function(done) {
                                    getProperty(device3.id, user1.accessToken, 'foo', done, false, 42);
                                 },
                                 // set a property on device 3 with client 2
                                 function(done) {
                                    setProperty(device3.id,
                                                user1Client2.accessToken,
                                                'bar',
                                                { type : 'string', value : 'forty-two' },
                                                done);
                                 },
                                 // verify the property is set
                                 function(done) {
                                    getProperty(device3.id, user1Client2.accessToken, 'bar', done, false, 'forty-two');
                                 },
                                 // set a property on device 4 with client 1
                                 function(done) {
                                    setProperty(device4.id,
                                                user1.accessToken,
                                                'baz',
                                                { type : 'double', value : 42.42 },
                                                done);
                                 },
                                 // verify the property is set
                                 function(done) {
                                    getProperty(device4.id, user1.accessToken, 'baz', done, false, 42.42);
                                 }

                              ], initDone);
               });

               it("Should be able to delete a device having device properties, and the cascading delete will delete the device's properties too", function(done) {
                  executeDelete({
                                   url : ESDR_DEVICES_API_URL + "/" + device3.id,
                                   headers : createAuthorizationHeader(user1.accessToken),
                                   expectedHttpStatus : httpStatus.OK,
                                   expectedStatusText : 'success',
                                   expectedResponseData : { id : device3.id },
                                   additionalTests : function(originalError, origianalResponse, done) {
                                      // make sure the device no longer exists
                                      verifyDeviceIsDeleted(device3.id, user1, function() {
                                         // make sure the property for device4 didn't get deleted
                                         getProperty(device4.id, user1.accessToken, 'baz', done, false, 42.42);
                                      });
                                   }
                                }, done);
               });
            });   // Cascading Delete of Device Properties

         });   // End OAuth2 authentication
      });   // End Delete

   });   // End Devices
});   // End REST API
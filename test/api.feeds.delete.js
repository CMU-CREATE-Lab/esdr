var should = require('should');
var flow = require('nimble');
var httpStatus = require('http-status');
var superagent = require('superagent-ls');
var requireNew = require('require-new');
var wipe = require('./fixture-helpers/wipe');
var setup = require('./fixture-helpers/setup');
var createAuthorizationHeader = require('./fixture-helpers/test-utils').createAuthorizationHeader;
var fs = require('fs');
var path = require('path');

var config = require('../config');

var ESDR_API_ROOT_URL = config.get("esdr:apiRootUrl");
var ESDR_FEEDS_API_URL = ESDR_API_ROOT_URL + "/feeds";

describe("REST API", function() {
   var client1 = requireNew('./fixtures/client1.json');
   var client2 = requireNew('./fixtures/client2.json');
   var user1 = requireNew('./fixtures/user1.json');
   var user2 = requireNew('./fixtures/user2.json');
   var user1Client2 = null;
   var product1 = requireNew('./fixtures/product1.json');
   var product2 = requireNew('./fixtures/product2.json');
   var device1 = requireNew('./fixtures/device1.json');
   var device2 = requireNew('./fixtures/device2.json');
   var device3 = requireNew('./fixtures/device3.json');
   var feed1 = requireNew('./fixtures/feed1.json');                        // public,  user 1, product 1, device 1
   var feed2 = requireNew('./fixtures/feed2.json');                        // private, user 1, product 1, device 1
   var feed3 = requireNew('./fixtures/feed3.json');                        // public,  user 1, product 2, device 2
   var feed4 = requireNew('./fixtures/feed4.json');                        // private, user 1, product 2, device 2
   var feed5 = requireNew('./fixtures/feed5.json');                        // public,  user 2, product 1, device 3
   var feed6 = requireNew('./fixtures/feed6.json');                        // private, user 2, product 1, device 3
   var feed7 = requireNew('./fixtures/feed-custom-channelSpecs.json');     // private, user 1, product 1, device 1
   var feed8 = requireNew('./fixtures/feed-null-channelSpecs.json');       // private, user 1, product 1, device 1

   var feedUpload1 = {
      request : requireNew('./fixtures/feed-upload1-request.json'),
      response : requireNew('./fixtures/feed-upload1-response.json')
   };
   var feedUpload5 = {
      request : requireNew('./fixtures/feed-upload5-request.json'),
      response : requireNew('./fixtures/feed-upload5-response.json')
   };

   before(function(initDone) {
      var doUpload = function(upload, done) {
         superagent
               .put(ESDR_FEEDS_API_URL + "/" + upload.feed.id)
               .set(createAuthorizationHeader(upload.user.accessToken))
               .send(upload.uploadRequestResponse.request)
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
                  res.body.data.should.have.properties(upload.uploadRequestResponse.response.data);

                  done();
               });
      };

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
                  setup.verifyUser(user1, done);
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
                  setup.createUser(user2, done);
               },
               function(done) {
                  setup.verifyUser(user2, done);
               },
               function(done) {
                  setup.authenticateUser(user2, done);
               },
               function(done) {
                  product1.creatorUserId = user1.id;
                  setup.createProduct(product1, done);
               },
               function(done) {
                  product2.creatorUserId = user1.id;
                  setup.createProduct(product2, done);
               },
               function(done) {
                  device1.userId = user1.id;
                  device1.productId = product1.id;
                  setup.createDevice(device1, done);
               },
               function(done) {
                  device2.userId = user1.id;
                  device2.productId = product2.id;
                  setup.createDevice(device2, done);
               },
               function(done) {
                  device3.userId = user2.id;
                  device3.productId = product1.id;
                  setup.createDevice(device3, done);
               },
               function(done) {
                  feed1.userId = user1.id;
                  feed1.deviceId = device1.id;
                  feed1.productId = product1.id;
                  feed1.channelSpecs = product1.defaultChannelSpecs;
                  setup.createFeed(feed1, done);
               },
               function(done) {
                  feed2.userId = user1.id;
                  feed2.deviceId = device1.id;
                  feed2.productId = product1.id;
                  feed2.channelSpecs = product1.defaultChannelSpecs;
                  setup.createFeed(feed2, done);
               },
               function(done) {
                  feed3.userId = user1.id;
                  feed3.deviceId = device2.id;
                  feed3.productId = product2.id;
                  feed3.channelSpecs = product2.defaultChannelSpecs;
                  setup.createFeed(feed3, done);
               },
               function(done) {
                  feed4.userId = user1.id;
                  feed4.deviceId = device2.id;
                  feed4.productId = product2.id;
                  feed4.channelSpecs = product2.defaultChannelSpecs;
                  setup.createFeed(feed4, done);
               },
               function(done) {
                  feed5.userId = user2.id;
                  feed5.deviceId = device3.id;
                  feed5.productId = product1.id;
                  feed5.channelSpecs = product1.defaultChannelSpecs;
                  setup.createFeed(feed5, done);
               },
               function(done) {
                  feed6.userId = user2.id;
                  feed6.deviceId = device3.id;
                  feed6.productId = product1.id;
                  feed6.channelSpecs = product1.defaultChannelSpecs;
                  setup.createFeed(feed6, done);
               },
               function(done) {
                  feed7.userId = user1.id;
                  feed7.deviceId = device1.id;
                  feed7.productId = product1.id;
                  feed7.channelSpecs = JSON.stringify(feed7.channelSpecs);
                  setup.createFeed(feed7, done);
               },
               function(done) {
                  feed8.userId = user1.id;
                  feed8.deviceId = device1.id;
                  feed8.productId = product1.id;
                  feed8.channelSpecs = product1.defaultChannelSpecs;
                  setup.createFeed(feed8, done);
               },
               function(done) {
                  doUpload({
                              feed : feed1,
                              user : user1,
                              uploadRequestResponse : feedUpload1
                           }, done);
               },
               function(done) {
                  doUpload({
                              feed : feed2,
                              user : user1,
                              uploadRequestResponse : feedUpload5
                           }, done);
               }
            ],
            initDone
      );
   });

   describe("Feeds", function() {
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
                        test.additionalTests(done);
                     }
                     else {
                        done();
                     }
                  });
         };

         var verifyFeedIsDeleted = function(feedId, user, done) {
            superagent
                  .get(ESDR_FEEDS_API_URL + "/" + feedId)
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

                     // make sure the feed directory doesn't exist anymore
                     var dirPath = path.join(config.get("datastore:dataDirectory"), String(user.id), "feed_" + feedId);
                     (function() {
                        fs.statSync(dirPath)
                     }).should.throw(Error);

                     done();
                  });
         };

         describe("No Authentication", function() {
            it("Shouldn't be able to delete a public feed without authentication", function(done) {
               executeDelete({
                                url : ESDR_FEEDS_API_URL + "/" + feed1.id,
                                expectedHttpStatus : httpStatus.UNAUTHORIZED,
                                expectedStatusText : 'error',
                                hasEmptyBody : true
                             }, done);
            });
            it("Shouldn't be able to delete a private feed without authentication", function(done) {
               executeDelete({
                                url : ESDR_FEEDS_API_URL + "/" + feed2.id,
                                expectedHttpStatus : httpStatus.UNAUTHORIZED,
                                expectedStatusText : 'error',
                                hasEmptyBody : true
                             }, done);
            });
         });   // End No Authentication

         describe("API Key Authentication", function() {

            describe("Feed API Key in the request header", function() {
               it("Shouldn't be able to delete a feed referencing it by read-write API key", function(done) {
                  executeDelete({
                                   url : ESDR_FEEDS_API_URL + "/" + feed1.id,
                                   headers : { FeedApiKey : feed1.apiKey },
                                   expectedHttpStatus : httpStatus.UNAUTHORIZED,
                                   expectedStatusText : 'error',
                                   hasEmptyBody : true
                                }, done);
               });
               it("Shouldn't be able to delete a feed referencing it by read-only API key", function(done) {
                  executeDelete({
                                   url : ESDR_FEEDS_API_URL + "/" + feed1.id,
                                   headers : { FeedApiKey : feed1.apiKeyReadOnly },
                                   expectedHttpStatus : httpStatus.UNAUTHORIZED,
                                   expectedStatusText : 'error',
                                   hasEmptyBody : true
                                }, done);
               });
            });   // End Feed API Key in the request header

            describe("Feed API Key in the URL", function() {
               it("Shouldn't be able to delete a feed referencing it by read-write API key", function(done) {
                  executeDelete({
                                   url : ESDR_FEEDS_API_URL + "/" + feed1.apiKey,
                                   expectedHttpStatus : httpStatus.UNAUTHORIZED,
                                   expectedStatusText : 'error',
                                   hasEmptyBody : true
                                }, done);
               });
               it("Shouldn't be able to delete a feed referencing it by read-only API key", function(done) {
                  executeDelete({
                                   url : ESDR_FEEDS_API_URL + "/" + feed1.apiKeyReadOnly,
                                   expectedHttpStatus : httpStatus.UNAUTHORIZED,
                                   expectedStatusText : 'error',
                                   hasEmptyBody : true
                                }, done);
               });
            });   // End Feed API Key in the URL

         });   // End API Key Authentication

         describe("OAuth2 authentication", function() {

            it("Should be able to delete a public feed with authentication by the owning user", function(done) {
               executeDelete({
                                willDebug:true,
                                url : ESDR_FEEDS_API_URL + "/" + feed1.id,
                                headers : createAuthorizationHeader(user1.accessToken),
                                expectedHttpStatus : httpStatus.OK,
                                expectedStatusText : 'success',
                                expectedResponseData : { id : feed1.id },
                                additionalTests : function(done) {
                                   // make sure the feed no longer exists
                                   verifyFeedIsDeleted(feed1.id, user1, done);
                                }
                             }, done);
            });

            it("Shouldn't be able to delete the same public feed again", function(done) {
               executeDelete({
                                url : ESDR_FEEDS_API_URL + "/" + feed1.id,
                                headers : createAuthorizationHeader(user1.accessToken),
                                expectedHttpStatus : httpStatus.NOT_FOUND,
                                expectedStatusText : 'error',
                                expectedResponseData : { id : feed1.id }
                             }, done);
            });

            it("Should be able to delete a private feed with authentication by the owning user", function(done) {
               executeDelete({
                                url : ESDR_FEEDS_API_URL + "/" + feed2.id,
                                headers : createAuthorizationHeader(user1.accessToken),
                                expectedHttpStatus : httpStatus.OK,
                                expectedStatusText : 'success',
                                expectedResponseData : { id : feed2.id },
                                additionalTests : function(done) {
                                   // make sure the feed no longer exists
                                   verifyFeedIsDeleted(feed2.id, user1, done);
                                }
                             }, done);
            });

            it("Shouldn't be able to delete the same private feed again", function(done) {
               executeDelete({
                                url : ESDR_FEEDS_API_URL + "/" + feed2.id,
                                headers : createAuthorizationHeader(user1.accessToken),
                                expectedHttpStatus : httpStatus.NOT_FOUND,
                                expectedStatusText : 'error',
                                expectedResponseData : { id : feed2.id }
                             }, done);
            });

            it("Shouldn't be able to delete a public feed owned by a different user", function(done) {
               executeDelete({
                                url : ESDR_FEEDS_API_URL + "/" + feed5.id,
                                headers : createAuthorizationHeader(user1.accessToken),
                                expectedHttpStatus : httpStatus.FORBIDDEN,
                                expectedStatusText : 'error',
                                expectedResponseData : { id : feed5.id }
                             }, done);
            });

            it("Shouldn't be able to delete a private feed owned by a different user", function(done) {
               executeDelete({
                                url : ESDR_FEEDS_API_URL + "/" + feed5.id,
                                headers : createAuthorizationHeader(user1.accessToken),
                                expectedHttpStatus : httpStatus.FORBIDDEN,
                                expectedStatusText : 'error',
                                expectedResponseData : { id : feed5.id }
                             }, done);
            });

            it("Shouldn't be able to delete a public feed with an invalid access token", function(done) {
               executeDelete({
                                url : ESDR_FEEDS_API_URL + "/" + feed5.id,
                                headers : createAuthorizationHeader("bogus"),
                                expectedHttpStatus : httpStatus.UNAUTHORIZED,
                                expectedStatusText : 'error',
                                hasEmptyBody : true
                             }, done);
            });

            it("Shouldn't be able to delete a private feed with an invalid access token", function(done) {
               executeDelete({
                                url : ESDR_FEEDS_API_URL + "/" + feed5.id,
                                headers : createAuthorizationHeader("bogus"),
                                expectedHttpStatus : httpStatus.UNAUTHORIZED,
                                expectedStatusText : 'error',
                                hasEmptyBody : true
                             }, done);
            });

            it("Shouldn't be able to delete a feed with an invalid ID (int)", function(done) {
               executeDelete({
                                url : ESDR_FEEDS_API_URL + "/" + 0,
                                headers : createAuthorizationHeader(user1.accessToken),
                                expectedHttpStatus : httpStatus.NOT_FOUND,
                                expectedStatusText : 'error',
                                expectedResponseData : null
                             }, done);
            });

            it("Shouldn't be able to delete a feed with an invalid ID (negative int)", function(done) {
               executeDelete({
                                url : ESDR_FEEDS_API_URL + "/" + -30,
                                headers : createAuthorizationHeader(user1.accessToken),
                                expectedHttpStatus : httpStatus.NOT_FOUND,
                                expectedStatusText : 'error',
                                expectedResponseData : null
                             }, done);
            });

            it("Shouldn't be able to delete a feed with an invalid ID (string)", function(done) {
               executeDelete({
                                url : ESDR_FEEDS_API_URL + "/" + "bogus",
                                headers : createAuthorizationHeader(user1.accessToken),
                                expectedHttpStatus : httpStatus.NOT_FOUND,
                                expectedStatusText : 'error',
                                expectedResponseData : null
                             }, done);
            });
            describe("Cascading Delete of Feed Properties", function() {
               var setProperty = function(feedId, accessToken, propertyKey, propertyValue, callback, willDebug) {
                  superagent
                        .put(ESDR_FEEDS_API_URL + "/" + feedId + "/properties/" + propertyKey)
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

                           var expectedResponse = {};
                           expectedResponse[propertyKey] = propertyValue.value;
                           res.body.data.should.have.properties(expectedResponse);

                           callback();
                        });
               };

               var getProperty = function(feedId, accessToken, propertyKey, callback, willDebug, expectedValue) {
                  superagent
                        .get(ESDR_FEEDS_API_URL + "/" + feedId + "/properties/" + propertyKey)
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
                              var expectedResponse = {};
                              expectedResponse[propertyKey] = expectedValue;
                              res.body.data.should.have.properties(expectedResponse);
                           }

                           callback();
                        });
               };

               before(function(initDone) {
                  flow.series([
                                 // set a property on feed 3 with client 1
                                 function(done) {
                                    setProperty(feed3.id,
                                                user1.accessToken,
                                                'foo',
                                                { type : 'int', value : 42 },
                                                done);
                                 },
                                 // verify the property is set
                                 function(done) {
                                    getProperty(feed3.id, user1.accessToken, 'foo', done, false, 42);
                                 },
                                 // set a property on feed 3 with client 2
                                 function(done) {
                                    setProperty(feed3.id,
                                                user1Client2.accessToken,
                                                'bar',
                                                { type : 'string', value : 'forty-two' },
                                                done);
                                 },
                                 // verify the property is set
                                 function(done) {
                                    getProperty(feed3.id, user1Client2.accessToken, 'bar', done, false, 'forty-two');
                                 },
                                 // set a property on feed 4 with client 1
                                 function(done) {
                                    setProperty(feed4.id,
                                                user1.accessToken,
                                                'baz',
                                                { type : 'double', value : 42.42 },
                                                done);
                                 },
                                 // verify the property is set
                                 function(done) {
                                    getProperty(feed4.id, user1.accessToken, 'baz', done, false, 42.42);
                                 }

                              ], initDone);
               });

               it("Should be able to delete a feed having feed properties, and the cascading delete will delete the feed's properties too", function(done) {
                  executeDelete({
                                   url : ESDR_FEEDS_API_URL + "/" + feed3.id,
                                   headers : createAuthorizationHeader(user1.accessToken),
                                   expectedHttpStatus : httpStatus.OK,
                                   expectedStatusText : 'success',
                                   expectedResponseData : { id : feed3.id },
                                   additionalTests : function(done) {
                                      // make sure the feed no longer exists
                                      verifyFeedIsDeleted(feed3.id, user1, function(){
                                         // make sure the property for feed4 didn't get deleted
                                         getProperty(feed4.id, user1.accessToken, 'baz', done, false, 42.42);
                                      });
                                   }
                                }, done);
               });
            });   // Cascading Delete of Feed Properties

         });   // End OAuth2 authentication
      });   // End Delete
   });   // End Feeds
});   // End REST API
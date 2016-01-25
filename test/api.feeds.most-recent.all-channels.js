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
var ESDR_FEEDS_API_URL = ESDR_API_ROOT_URL + "/feeds";
var UNKNOWN_FEED_API_KEY = "012345678901234567890123456789012345678901234567890123456789abcd";

describe("REST API", function() {
   var user1 = requireNew('./fixtures/user1.json');
   var user2 = requireNew('./fixtures/user2.json');
   var product1 = requireNew('./fixtures/product1.json');
   var device1 = requireNew('./fixtures/device1.json');
   var feed1 = requireNew('./fixtures/feed1.json');   // public,  user 1, product 1, device 1
   var feed2 = requireNew('./fixtures/feed2.json');   // private, user 1, product 1, device 1

   var feedUpload1 = {
      request : requireNew('./fixtures/feed-upload1-request.json'),
      response : requireNew('./fixtures/feed-upload1-response.json')
   };

   var feedUpload2 = {
      request : requireNew('./fixtures/feed-upload2-request.json'),
      response : requireNew('./fixtures/feed-upload2-response.json')
   };

   var feedUpload3 = {
      request : requireNew('./fixtures/feed-upload3-request.json'),
      response : requireNew('./fixtures/feed-upload3-response.json')
   };

   var feedUpload4 = {
      request : requireNew('./fixtures/feed-upload4-request.json'),
      response : requireNew('./fixtures/feed-upload4-response.json')
   };

   var feedUpload5 = {
      request : requireNew('./fixtures/feed-upload5-request.json'),
      response : requireNew('./fixtures/feed-upload5-response.json')
   };

   var feedUpload6 = {
      request : requireNew('./fixtures/feed-upload6-request.json'),
      response : requireNew('./fixtures/feed-upload6-response.json')
   };

   var feedUpload7 = {
      request : requireNew('./fixtures/feed-upload7-request.json'),
      response : requireNew('./fixtures/feed-upload7-response.json')
   };

   var feedUpload8 = {
      request : requireNew('./fixtures/feed-upload8-request.json'),
      response : requireNew('./fixtures/feed-upload8-response.json')
   };

   var feed1MostRecentData = requireNew('./fixtures/most-recent-all-channels-feed1-response-data.json');
   var feed2MostRecentData = requireNew('./fixtures/most-recent-all-channels-feed2-response-data.json');

   before(function(initDone) {
      var doUpload = function(feed, feedUplaod, done) {
         superagent
               .put(ESDR_FEEDS_API_URL + "/" + feed.apiKey)
               .send(feedUplaod.request)
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
                  res.body.data.should.have.properties(feedUplaod.response.data);

                  done();
               });
      };

      flow.series(
            [
               wipe.wipeAllData,
               function(done) {
                  setup.createUser(user1, done);
               },
               function(done) {
                  setup.verifyUser(user1, done);
               },
               function(done) {
                  setup.authentcateUser(user1, done);
               },
               function(done) {
                  setup.createUser(user2, done);
               },
               function(done) {
                  setup.verifyUser(user2, done);
               },
               function(done) {
                  setup.authentcateUser(user2, done);
               },
               function(done) {
                  product1.creatorUserId = user1.id;
                  setup.createProduct(product1, done);
               },
               function(done) {
                  device1.userId = user1.id;
                  device1.productId = product1.id;
                  setup.createDevice(device1, done);
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
                  doUpload(feed1, feedUpload1, done);
               },
               function(done) {
                  doUpload(feed1, feedUpload2, done);
               },
               function(done) {
                  doUpload(feed1, feedUpload3, done);
               },
               function(done) {
                  doUpload(feed1, feedUpload4, done);
               },
               function(done) {
                  doUpload(feed2, feedUpload5, done);
               },
               function(done) {
                  doUpload(feed2, feedUpload6, done);
               },
               function(done) {
                  doUpload(feed2, feedUpload7, done);
               },
               function(done) {
                  doUpload(feed2, feedUpload8, done);
               }
            ],
            initDone
      );
   });

   describe.only("Feeds.Foo", function() {
      describe("Get Most Recent Data Sample", function() {
         var executeTest = function(test) {
            it(test.description, function(done) {
               superagent
                     .get(typeof test.url === 'function' ? test.url() : test.url)
                     .set(typeof test.headers === 'undefined' ? {} : (typeof test.headers === 'function' ? test.headers() : test.headers))
                     .end(function(err, res) {
                        should.not.exist(err);
                        should.exist(res);

                        if (test.willDebug) {
                           console.log(JSON.stringify(res.body, null, 3));
                        }

                        res.should.have.property('status', test.expectedHttpStatus);
                        if (!test.hasEmptyBody) {

                           res.should.have.property('body');

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

                        done();
                     });
            });
         };

         describe("No authentication", function() {

            [
               {
                  description : "Should be able to get most recent data samples for a public feed without authentication",
                  url : function() {
                     return ESDR_FEEDS_API_URL + "/" + feed1.id + "/most-recent";
                  },
                  expectedHttpStatus : httpStatus.OK,
                  expectedStatusText : 'success',
                  expectedResponseData : feed1MostRecentData
               },
               {
                  description : "Should fail to get most recent data samples for a private feed without authentication",
                  url : function() {
                     return ESDR_FEEDS_API_URL + "/" + feed2.id + "/most-recent";
                  },
                  expectedHttpStatus : httpStatus.UNAUTHORIZED,
                  expectedStatusText : 'error',
                  expectedResponseData : null
               },
               {
                  description : "Should fail to get most recent data samples for a feed with an invalid ID (valid ID plus extra non-numeric characters appended)",
                  url : function() {
                     return ESDR_FEEDS_API_URL + "/" + feed1.id + "abc" + "/most-recent";
                  },
                  expectedHttpStatus : httpStatus.NOT_FOUND,
                  expectedStatusText : 'error',
                  expectedResponseData : null
               }
            ].forEach(executeTest);

         });   // End No authentication

         describe("OAuth2 authentication", function() {

            [
               {
                  description : "Should be able to get most recent data samples for a public feed with valid authentication",
                  url : function() {
                     return ESDR_FEEDS_API_URL + "/" + feed1.id + "/most-recent";
                  },
                  headers : function() {
                     return createAuthorizationHeader(user1.accessToken);
                  },
                  expectedHttpStatus : httpStatus.OK,
                  expectedStatusText : 'success',
                  expectedResponseData : feed1MostRecentData
               },
               {
                  description : "Should be able to get most recent data samples for a public feed with valid authentication, but for the wrong user",
                  url : function() {
                     return ESDR_FEEDS_API_URL + "/" + feed1.id + "/most-recent";
                  },
                  headers : function() {
                     return createAuthorizationHeader(user2.accessToken);
                  },
                  expectedHttpStatus : httpStatus.OK,
                  expectedStatusText : 'success',
                  expectedResponseData : feed1MostRecentData
               },
               {
                  description : "Should be able to get most recent data samples for a public feed with invalid authentication",
                  url : function() {
                     return ESDR_FEEDS_API_URL + "/" + feed1.id + "/most-recent";
                  },
                  headers : function() {
                     return createAuthorizationHeader("bogus");
                  },
                  expectedHttpStatus : httpStatus.OK,
                  expectedStatusText : 'success',
                  expectedResponseData : feed1MostRecentData
               },
               {
                  description : "Should be able to get most recent data samples for a private feed with valid authentication",
                  url : function() {
                     return ESDR_FEEDS_API_URL + "/" + feed2.id + "/most-recent";
                  },
                  headers : function() {
                     return createAuthorizationHeader(user1.accessToken);
                  },
                  expectedHttpStatus : httpStatus.OK,
                  expectedStatusText : 'success',
                  expectedResponseData : feed2MostRecentData
               },
               {
                  description : "Should fail to get most recent data samples for a private feed with valid authentication, but for the wrong user",
                  url : function() {
                     return ESDR_FEEDS_API_URL + "/" + feed2.id + "/most-recent";
                  },
                  headers : function() {
                     return createAuthorizationHeader(user2.accessToken);
                  },
                  expectedHttpStatus : httpStatus.FORBIDDEN,
                  expectedStatusText : 'error',
                  expectedResponseData : null
               },
               {
                  description : "Should fail to get most recent data samples for a private feed with invalid authentication",
                  url : function() {
                     return ESDR_FEEDS_API_URL + "/" + feed2.id + "/most-recent";
                  },
                  headers : function() {
                     return createAuthorizationHeader("bogus");
                  },
                  expectedHttpStatus : httpStatus.FORBIDDEN,
                  expectedStatusText : 'error',
                  expectedResponseData : null
               }
            ].forEach(executeTest);

         });   // End OAuth2 authentication

         describe("API Key Authentication", function() {

            describe("Feed API Key in the request header", function() {

               [].forEach(executeTest);

            });   // End Feed API Key in the request header

            describe("Feed API Key in the URL", function() {

               [].forEach(executeTest);

            });   // End Feed API Key in the URL

         });   // End API Key Authentication

      });   // End Get Most Recent Data Sample
   });   // End Feeds
});   // End REST API
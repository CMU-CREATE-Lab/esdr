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
const ESDR_FEEDS_API_URL = ESDR_API_ROOT_URL + "/feeds";
const UNKNOWN_FEED_API_KEY = "012345678901234567890123456789012345678901234567890123456789abcd";

describe("REST API", function() {
   const user1 = requireNew('./fixtures/user1.json');
   const user2 = requireNew('./fixtures/user2.json');
   const product1 = requireNew('./fixtures/product1.json');
   const device1 = requireNew('./fixtures/device1.json');
   const feed1 = requireNew('./fixtures/feed1.json');   // public,  user 1, product 1, device 1
   const feed2 = requireNew('./fixtures/feed2.json');   // private, user 1, product 1, device 1

   const feedUpload1 = {
      request : requireNew('./fixtures/feed-upload1-request.json'),
      response : requireNew('./fixtures/feed-upload1-response.json')
   };

   const feedUpload2 = {
      request : requireNew('./fixtures/feed-upload2-request.json'),
      response : requireNew('./fixtures/feed-upload2-response.json')
   };

   const feedUpload3 = {
      request : requireNew('./fixtures/feed-upload3-request.json'),
      response : requireNew('./fixtures/feed-upload3-response.json')
   };

   const feedUpload4 = {
      request : requireNew('./fixtures/feed-upload4-request.json'),
      response : requireNew('./fixtures/feed-upload4-response.json')
   };

   const feedUpload5 = {
      request : requireNew('./fixtures/feed-upload5-request.json'),
      response : requireNew('./fixtures/feed-upload5-response.json')
   };

   const feedUpload6 = {
      request : requireNew('./fixtures/feed-upload6-request.json'),
      response : requireNew('./fixtures/feed-upload6-response.json')
   };

   const feedUpload7 = {
      request : requireNew('./fixtures/feed-upload7-request.json'),
      response : requireNew('./fixtures/feed-upload7-response.json')
   };

   const feedUpload8 = {
      request : requireNew('./fixtures/feed-upload8-request.json'),
      response : requireNew('./fixtures/feed-upload8-response.json')
   };

   const feed1InfoData = requireNew('./fixtures/get-info-feed1-response-data.json');
   const feed2InfoData = requireNew('./fixtures/get-info-feed2-response-data.json');

   before(function(initDone) {
      const doUpload = function(feed, feedUplaod, done) {
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
                  setup.authenticateUser(user1, done);
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

   describe("Feeds", function() {
      describe("Get Info (JSON)", function() {
         const executeTest = function(test) {
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

                                 if (typeof test.getExpectedDynamicResponseData === 'function') {
                                    res.body.data.should.have.properties(test.getExpectedDynamicResponseData());
                                 }
                                 if (typeof test.apiKeyIsExpectedToBeMissing !== 'undefined') {
                                    if (test.apiKeyIsExpectedToBeMissing) {
                                       res.body.data.should.not.have.property('apiKey');
                                    }
                                    else {
                                       res.body.data.should.have.property('apiKey');
                                    }

                                    if (test.apiKeyReadOnlyIsExpectedToBeMissing) {
                                       res.body.data.should.not.have.property('apiKeyReadOnly');
                                    }
                                    else {
                                       res.body.data.should.have.property('apiKeyReadOnly');
                                    }
                                 }
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
                  description : "Should be able to get info for a public feed without authentication",
                  url : function() {
                     return ESDR_FEEDS_API_URL + "/" + feed1.id;
                  },
                  expectedHttpStatus : httpStatus.OK,
                  expectedStatusText : 'success',
                  expectedResponseData : feed1InfoData,
                  getExpectedDynamicResponseData : function() {
                     return {
                        id : feed1.id,
                        userId : feed1.userId,
                        productId : feed1.productId,
                        deviceId : feed1.deviceId,
                        apiKeyReadOnly : feed1.apiKeyReadOnly
                     }
                  },
                  apiKeyIsExpectedToBeMissing : true,
                  apiKeyReadOnlyIsExpectedToBeMissing : false
               },
               {
                  description : "Should fail to get info for a private feed without authentication",
                  url : function() {
                     return ESDR_FEEDS_API_URL + "/" + feed2.id;
                  },
                  expectedHttpStatus : httpStatus.UNAUTHORIZED,
                  expectedStatusText : 'error',
                  expectedResponseData : null
               }
            ].forEach(executeTest);

         });   // End No authentication

         describe("OAuth2 authentication", function() {

            [
               {
                  description : "Should be able to get info for a public feed with valid authentication",
                  url : function() {
                     return ESDR_FEEDS_API_URL + "/" + feed1.id;
                  },
                  headers : function() {
                     return createAuthorizationHeader(user1.accessToken);
                  },
                  expectedHttpStatus : httpStatus.OK,
                  expectedStatusText : 'success',
                  expectedResponseData : feed1InfoData,
                  getExpectedDynamicResponseData : function() {
                     return {
                        id : feed1.id,
                        userId : feed1.userId,
                        productId : feed1.productId,
                        deviceId : feed1.deviceId,
                        apiKey : feed1.apiKey,
                        apiKeyReadOnly : feed1.apiKeyReadOnly
                     }
                  },
                  apiKeyIsExpectedToBeMissing : false,
                  apiKeyReadOnlyIsExpectedToBeMissing : false
               },
               {
                  description : "Should be able to get info for a public feed with valid authentication, but for the wrong user",
                  url : function() {
                     return ESDR_FEEDS_API_URL + "/" + feed1.id;
                  },
                  headers : function() {
                     return createAuthorizationHeader(user2.accessToken);
                  },
                  expectedHttpStatus : httpStatus.OK,
                  expectedStatusText : 'success',
                  expectedResponseData : feed1InfoData,
                  getExpectedDynamicResponseData : function() {
                     return {
                        id : feed1.id,
                        userId : feed1.userId,
                        productId : feed1.productId,
                        deviceId : feed1.deviceId,
                        apiKeyReadOnly : feed1.apiKeyReadOnly
                     }
                  },
                  apiKeyIsExpectedToBeMissing : true,
                  apiKeyReadOnlyIsExpectedToBeMissing : false
               },
               {
                  description : "Should be able to get info for a public feed with invalid authentication",
                  url : function() {
                     return ESDR_FEEDS_API_URL + "/" + feed1.id;
                  },
                  headers : function() {
                     return createAuthorizationHeader("bogus");
                  },
                  expectedHttpStatus : httpStatus.OK,
                  expectedStatusText : 'success',
                  expectedResponseData : feed1InfoData,
                  getExpectedDynamicResponseData : function() {
                     return {
                        id : feed1.id,
                        userId : feed1.userId,
                        productId : feed1.productId,
                        deviceId : feed1.deviceId,
                        apiKeyReadOnly : feed1.apiKeyReadOnly
                     }
                  },
                  apiKeyIsExpectedToBeMissing : true,
                  apiKeyReadOnlyIsExpectedToBeMissing : false
               },
               {
                  description : "Should be able to get info for a private feed with valid authentication",
                  url : function() {
                     return ESDR_FEEDS_API_URL + "/" + feed2.id;
                  },
                  headers : function() {
                     return createAuthorizationHeader(user1.accessToken);
                  },
                  expectedHttpStatus : httpStatus.OK,
                  expectedStatusText : 'success',
                  expectedResponseData : feed2InfoData,
                  getExpectedDynamicResponseData : function() {
                     return {
                        id : feed2.id,
                        userId : feed2.userId,
                        productId : feed2.productId,
                        deviceId : feed2.deviceId,
                        apiKey : feed2.apiKey,
                        apiKeyReadOnly : feed2.apiKeyReadOnly
                     }
                  },
                  apiKeyIsExpectedToBeMissing : false,
                  apiKeyReadOnlyIsExpectedToBeMissing : false
               },
               {
                  description : "Should fail to get info for a private feed with valid authentication, but for the wrong user",
                  url : function() {
                     return ESDR_FEEDS_API_URL + "/" + feed2.id;
                  },
                  headers : function() {
                     return createAuthorizationHeader(user2.accessToken);
                  },
                  expectedHttpStatus : httpStatus.FORBIDDEN,
                  expectedStatusText : 'error',
                  expectedResponseData : null
               },
               {
                  description : "Should fail to get info for a private feed with invalid authentication",
                  url : function() {
                     return ESDR_FEEDS_API_URL + "/" + feed2.id;
                  },
                  headers : function() {
                     return createAuthorizationHeader("bogus");
                  },
                  expectedHttpStatus : httpStatus.FORBIDDEN,
                  expectedStatusText : 'error',
                  expectedResponseData : null
               },
               {
                  description : "Should fail to get info for a feed with an invalid ID (valid ID plus extra non-numeric characters appended)",
                  url : function() {
                     return ESDR_FEEDS_API_URL + "/" + feed1.id + "abc";
                  },
                  expectedHttpStatus : httpStatus.NOT_FOUND,
                  expectedStatusText : 'error',
                  expectedResponseData : null
               }
            ].forEach(executeTest);

         });   // End OAuth2 authentication

         describe("API Key Authentication", function() {

            describe("Feed API Key in the request header", function() {

               [
                  {
                     description : "Should be able to get info for a public feed with valid read-write authentication",
                     url : function() {
                        return ESDR_FEEDS_API_URL + "/" + feed1.id;
                     },
                     headers : function() {
                        return { FeedApiKey : feed1.apiKey }
                     },
                     expectedHttpStatus : httpStatus.OK,
                     expectedStatusText : 'success',
                     expectedResponseData : feed1InfoData,
                     getExpectedDynamicResponseData : function() {
                        return {
                           id : feed1.id,
                           userId : feed1.userId,
                           productId : feed1.productId,
                           deviceId : feed1.deviceId,
                           apiKey : feed1.apiKey,
                           apiKeyReadOnly : feed1.apiKeyReadOnly
                        }
                     },
                     apiKeyIsExpectedToBeMissing : false,
                     apiKeyReadOnlyIsExpectedToBeMissing : false
                  },
                  {
                     description : "Should be able to get info for a public feed with valid read-only authentication",
                     url : function() {
                        return ESDR_FEEDS_API_URL + "/" + feed1.id;
                     },
                     headers : function() {
                        return { FeedApiKey : feed1.apiKeyReadOnly }
                     },
                     expectedHttpStatus : httpStatus.OK,
                     expectedStatusText : 'success',
                     expectedResponseData : feed1InfoData,
                     getExpectedDynamicResponseData : function() {
                        return {
                           id : feed1.id,
                           userId : feed1.userId,
                           productId : feed1.productId,
                           deviceId : feed1.deviceId,
                           apiKeyReadOnly : feed1.apiKeyReadOnly
                        }
                     },
                     apiKeyIsExpectedToBeMissing : true,
                     apiKeyReadOnlyIsExpectedToBeMissing : false
                  },
                  {
                     description : "Should be able to get info for a public feed with valid read-write authentication, but for the wrong feed",
                     url : function() {
                        return ESDR_FEEDS_API_URL + "/" + feed1.id;
                     },
                     headers : function() {
                        return { FeedApiKey : feed2.apiKey }
                     },
                     expectedHttpStatus : httpStatus.OK,
                     expectedStatusText : 'success',
                     expectedResponseData : feed1InfoData,
                     getExpectedDynamicResponseData : function() {
                        return {
                           id : feed1.id,
                           userId : feed1.userId,
                           productId : feed1.productId,
                           deviceId : feed1.deviceId,
                           apiKeyReadOnly : feed1.apiKeyReadOnly
                        }
                     },
                     apiKeyIsExpectedToBeMissing : true,
                     apiKeyReadOnlyIsExpectedToBeMissing : false
                  },
                  {
                     description : "Should be able to get info for a public feed with valid read-only authentication, but for the wrong feed",
                     url : function() {
                        return ESDR_FEEDS_API_URL + "/" + feed1.id;
                     },
                     headers : function() {
                        return { FeedApiKey : feed2.apiKeyReadOnly }
                     },
                     expectedHttpStatus : httpStatus.OK,
                     expectedStatusText : 'success',
                     expectedResponseData : feed1InfoData,
                     getExpectedDynamicResponseData : function() {
                        return {
                           id : feed1.id,
                           userId : feed1.userId,
                           productId : feed1.productId,
                           deviceId : feed1.deviceId,
                           apiKeyReadOnly : feed1.apiKeyReadOnly
                        }
                     },
                     apiKeyIsExpectedToBeMissing : true,
                     apiKeyReadOnlyIsExpectedToBeMissing : false
                  },
                  {
                     description : "Should be able to get info for a private feed with valid read-write authentication",
                     url : function() {
                        return ESDR_FEEDS_API_URL + "/" + feed2.id;
                     },
                     headers : function() {
                        return { FeedApiKey : feed2.apiKey }
                     },
                     expectedHttpStatus : httpStatus.OK,
                     expectedStatusText : 'success',
                     expectedResponseData : feed2InfoData,
                     getExpectedDynamicResponseData : function() {
                        return {
                           id : feed2.id,
                           userId : feed2.userId,
                           productId : feed2.productId,
                           deviceId : feed2.deviceId,
                           apiKey : feed2.apiKey,
                           apiKeyReadOnly : feed2.apiKeyReadOnly
                        }
                     },
                     apiKeyIsExpectedToBeMissing : false,
                     apiKeyReadOnlyIsExpectedToBeMissing : false
                  },
                  {
                     description : "Should be able to get info for a private feed with valid read-only authentication",
                     url : function() {
                        return ESDR_FEEDS_API_URL + "/" + feed2.id;
                     },
                     headers : function() {
                        return { FeedApiKey : feed2.apiKeyReadOnly }
                     },
                     expectedHttpStatus : httpStatus.OK,
                     expectedStatusText : 'success',
                     expectedResponseData : feed2InfoData,
                     getExpectedDynamicResponseData : function() {
                        return {
                           id : feed2.id,
                           userId : feed2.userId,
                           productId : feed2.productId,
                           deviceId : feed2.deviceId,
                           apiKeyReadOnly : feed2.apiKeyReadOnly
                        }
                     },
                     apiKeyIsExpectedToBeMissing : true,
                     apiKeyReadOnlyIsExpectedToBeMissing : false
                  },
                  {
                     description : "Should fail to get info for a private feed with invalid authentication",
                     url : function() {
                        return ESDR_FEEDS_API_URL + "/" + feed2.id;
                     },
                     headers : function() {
                        return { FeedApiKey : "bogus" }
                     },
                     expectedHttpStatus : httpStatus.FORBIDDEN,
                     expectedStatusText : 'error',
                     expectedResponseData : null
                  },
                  {
                     description : "Should fail to get info for a private feed with valid read-write authentication, but for the wrong feed",
                     url : function() {
                        return ESDR_FEEDS_API_URL + "/" + feed2.id;
                     },
                     headers : function() {
                        return { FeedApiKey : feed1.apiKey }
                     },
                     expectedHttpStatus : httpStatus.FORBIDDEN,
                     expectedStatusText : 'error',
                     expectedResponseData : null
                  },
                  {
                     description : "Should fail to get info for a private feed with valid read-only authentication, but for the wrong feed",
                     url : function() {
                        return ESDR_FEEDS_API_URL + "/" + feed2.id;
                     },
                     headers : function() {
                        return { FeedApiKey : feed1.apiKeyReadOnly }
                     },
                     expectedHttpStatus : httpStatus.FORBIDDEN,
                     expectedStatusText : 'error',
                     expectedResponseData : null
                  }
               ].forEach(executeTest);

            });   // End Feed API Key in the request header

            describe("Feed API Key in the URL", function() {

               [
                  {
                     description : "Should be able to get info for a public feed with valid read-write authentication",
                     url : function() {
                        return ESDR_FEEDS_API_URL + "/" + feed1.apiKey;
                     },
                     expectedHttpStatus : httpStatus.OK,
                     expectedStatusText : 'success',
                     expectedResponseData : feed1InfoData,
                     getExpectedDynamicResponseData : function() {
                        return {
                           id : feed1.id,
                           userId : feed1.userId,
                           productId : feed1.productId,
                           deviceId : feed1.deviceId,
                           apiKey : feed1.apiKey,
                           apiKeyReadOnly : feed1.apiKeyReadOnly
                        }
                     },
                     apiKeyIsExpectedToBeMissing : false,
                     apiKeyReadOnlyIsExpectedToBeMissing : false
                  },
                  {
                     description : "Should be able to get info for a public feed with valid read-only authentication",
                     url : function() {
                        return ESDR_FEEDS_API_URL + "/" + feed1.apiKeyReadOnly;
                     },
                     expectedHttpStatus : httpStatus.OK,
                     expectedStatusText : 'success',
                     expectedResponseData : feed1InfoData,
                     getExpectedDynamicResponseData : function() {
                        return {
                           id : feed1.id,
                           userId : feed1.userId,
                           productId : feed1.productId,
                           deviceId : feed1.deviceId,
                           apiKeyReadOnly : feed1.apiKeyReadOnly
                        }
                     },
                     apiKeyIsExpectedToBeMissing : true,
                     apiKeyReadOnlyIsExpectedToBeMissing : false
                  },
                  {
                     description : "Should be able to get info for a private feed with valid read-write authentication",
                     url : function() {
                        return ESDR_FEEDS_API_URL + "/" + feed2.apiKey;
                     },
                     expectedHttpStatus : httpStatus.OK,
                     expectedStatusText : 'success',
                     expectedResponseData : feed2InfoData,
                     getExpectedDynamicResponseData : function() {
                        return {
                           id : feed2.id,
                           userId : feed2.userId,
                           productId : feed2.productId,
                           deviceId : feed2.deviceId,
                           apiKey : feed2.apiKey,
                           apiKeyReadOnly : feed2.apiKeyReadOnly
                        }
                     },
                     apiKeyIsExpectedToBeMissing : false,
                     apiKeyReadOnlyIsExpectedToBeMissing : false
                  },
                  {
                     description : "Should be able to get info for a private feed with valid read-only authentication",
                     url : function() {
                        return ESDR_FEEDS_API_URL + "/" + feed2.apiKeyReadOnly;
                     },
                     expectedHttpStatus : httpStatus.OK,
                     expectedStatusText : 'success',
                     expectedResponseData : feed2InfoData,
                     getExpectedDynamicResponseData : function() {
                        return {
                           id : feed2.id,
                           userId : feed2.userId,
                           productId : feed2.productId,
                           deviceId : feed2.deviceId,
                           apiKeyReadOnly : feed2.apiKeyReadOnly
                        }
                     },
                     apiKeyIsExpectedToBeMissing : true,
                     apiKeyReadOnlyIsExpectedToBeMissing : false
                  },
                  {
                     description : "Should fail to get info for a feed with invalid authentication",
                     url : function() {
                        return ESDR_FEEDS_API_URL + "/" + UNKNOWN_FEED_API_KEY;
                     },
                     expectedHttpStatus : httpStatus.NOT_FOUND,
                     expectedStatusText : 'error',
                     expectedResponseData : null
                  }
               ].forEach(executeTest);

            });   // End Feed API Key in the URL

         });   // End API Key Authentication

      });   // End Get Info (JSON)

      describe("Get Info (CSV)", function() {
         const executeTest = function(test) {
            it(test.description, function(done) {
               superagent
                     .get(typeof test.url === 'function' ? test.url() : test.url)
                     .set(typeof test.headers === 'undefined' ? {} : (typeof test.headers === 'function' ? test.headers() : test.headers))
                     .end(function(err, res) {
                        should.not.exist(err);
                        should.exist(res);

                        res.should.have.property('status', test.expectedHttpStatus);
                        if (!test.hasEmptyResponseText) {
                           res.should.have.property('text');

                           if (test.willDebug) {
                              console.log(JSON.stringify(res.text, null, 3));
                           }

                           if (typeof test.getExpectedDynamicResponseData === 'function') {
                              const expectedResponseData = test.getExpectedDynamicResponseData();
                              res.text.should.equal(expectedResponseData);
                           }
                        }

                        if (!test.hasEmptyResponseBody) {
                           res.should.have.property('body');

                           if (test.willDebug) {
                              console.log(JSON.stringify(res.body, null, 3));
                           }

                           res.body.should.have.properties({
                                                              code : test.expectedHttpStatus,
                                                              status : test.expectedStatusText
                                                           });

                           if (test.expectedResponseData == null) {
                              res.body.should.have.property('data', null);
                           }
                           else {
                              res.body.should.have.property('data');
                              res.body.data.should.have.properties(test.expectedResponseData);
                           }
                        }

                        done();
                     });
            });
         };

         describe("No authentication", function() {
            [
               {
                  description : "Should be able to get info for a public feed without authentication",
                  url : function() {
                     return ESDR_FEEDS_API_URL + "/" + feed1.id + '/?format=csv&fields=id,name,deviceId,productId,userId,apiKey,apiKeyReadOnly,exposure,isPublic,isMobile,latitude,longitude,channelSpecs,channelBounds';
                  },
                  hasEmptyResponseBody : true,
                  hasEmptyResponseText : false,
                  expectedHttpStatus : httpStatus.OK,
                  getExpectedDynamicResponseData : function() {
                     return "id,name,deviceId,productId,userId,apiKeyReadOnly,exposure,isPublic,isMobile,latitude,longitude\n" +
                            [feed1.id,
                             feed1.name,
                             feed1.deviceId,
                             feed1.productId,
                             feed1.userId,
                             feed1.apiKeyReadOnly,
                             feed1.exposure,
                             feed1.isPublic,
                             feed1.isMobile,
                             feed1.latitude,
                             feed1.longitude,
                            ].join(',') + "\n"
                  },
               },
               {
                  description : "Should fail to get info for a private feed without authentication",
                  url : function() {
                     return ESDR_FEEDS_API_URL + "/" + feed2.id + '/?format=csv';
                  },
                  hasEmptyResponseBody : false,
                  hasEmptyResponseText : true,
                  expectedHttpStatus : httpStatus.UNAUTHORIZED,
                  expectedStatusText : 'error',
                  expectedResponseData : null,
               }
            ].forEach(executeTest);
         });   // End No authentication

         describe("OAuth2 authentication", function() {
            [
               {
                  description : "Should be able to get info for a public feed with valid authentication",
                  url : function() {
                     return ESDR_FEEDS_API_URL + "/" + feed1.id + '/?format=csv&fields=id,name,deviceId,productId,userId,apiKey,apiKeyReadOnly,exposure,isPublic,isMobile,latitude,longitude,channelSpecs,channelBounds';
                  },
                  headers : function() {
                     return createAuthorizationHeader(user1.accessToken);
                  },
                  hasEmptyResponseBody : true,
                  hasEmptyResponseText : false,
                  expectedHttpStatus : httpStatus.OK,
                  getExpectedDynamicResponseData : function() {
                     return "id,name,deviceId,productId,userId,apiKey,apiKeyReadOnly,exposure,isPublic,isMobile,latitude,longitude\n" +
                            [feed1.id,
                             feed1.name,
                             feed1.deviceId,
                             feed1.productId,
                             feed1.userId,
                             feed1.apiKey,
                             feed1.apiKeyReadOnly,
                             feed1.exposure,
                             feed1.isPublic,
                             feed1.isMobile,
                             feed1.latitude,
                             feed1.longitude,
                            ].join(',') + "\n"
                  },
               },
               {
                  description : "Should be able to get info for a public feed with valid authentication, but for the wrong user",
                  url : function() {
                     return ESDR_FEEDS_API_URL + "/" + feed1.id + '/?format=csv&fields=id,name,deviceId,productId,userId,apiKey,apiKeyReadOnly,exposure,isPublic,isMobile,latitude,longitude,channelSpecs,channelBounds';
                  },
                  headers : function() {
                     return createAuthorizationHeader(user2.accessToken);
                  },
                  hasEmptyResponseBody : true,
                  hasEmptyResponseText : false,
                  expectedHttpStatus : httpStatus.OK,
                  getExpectedDynamicResponseData : function() {
                     return "id,name,deviceId,productId,userId,apiKeyReadOnly,exposure,isPublic,isMobile,latitude,longitude\n" +
                            [feed1.id,
                             feed1.name,
                             feed1.deviceId,
                             feed1.productId,
                             feed1.userId,
                             feed1.apiKeyReadOnly,
                             feed1.exposure,
                             feed1.isPublic,
                             feed1.isMobile,
                             feed1.latitude,
                             feed1.longitude,
                            ].join(',') + "\n"
                  }
               },
               {
                  description : "Should be able to get info for a public feed with invalid authentication",
                  url : function() {
                     return ESDR_FEEDS_API_URL + "/" + feed1.id + '/?format=csv&fields=id,name,deviceId,productId,userId,apiKey,apiKeyReadOnly,exposure,isPublic,isMobile,latitude,longitude,channelSpecs,channelBounds';
                  },
                  headers : function() {
                     return createAuthorizationHeader("bogus");
                  },
                  hasEmptyResponseBody : true,
                  hasEmptyResponseText : false,
                  expectedHttpStatus : httpStatus.OK,
                  getExpectedDynamicResponseData : function() {
                     return "id,name,deviceId,productId,userId,apiKeyReadOnly,exposure,isPublic,isMobile,latitude,longitude\n" +
                            [feed1.id,
                             feed1.name,
                             feed1.deviceId,
                             feed1.productId,
                             feed1.userId,
                             feed1.apiKeyReadOnly,
                             feed1.exposure,
                             feed1.isPublic,
                             feed1.isMobile,
                             feed1.latitude,
                             feed1.longitude,
                            ].join(',') + "\n"
                  },
               },
               {
                  description : "Should be able to get info for a private feed with valid authentication",
                  url : function() {
                     return ESDR_FEEDS_API_URL + "/" + feed2.id + '/?format=csv&fields=id,name,deviceId,productId,userId,apiKey,apiKeyReadOnly,exposure,isPublic,isMobile,latitude,longitude,channelSpecs,channelBounds';
                  },
                  headers : function() {
                     return createAuthorizationHeader(user1.accessToken);
                  },
                  hasEmptyResponseBody : true,
                  hasEmptyResponseText : false,
                  expectedHttpStatus : httpStatus.OK,
                  getExpectedDynamicResponseData : function() {
                     return "id,name,deviceId,productId,userId,apiKey,apiKeyReadOnly,exposure,isPublic,isMobile,latitude,longitude\n" +
                            [feed2.id,
                             feed2.name,
                             feed2.deviceId,
                             feed2.productId,
                             feed2.userId,
                             feed2.apiKey,
                             feed2.apiKeyReadOnly,
                             feed2.exposure,
                             feed2.isPublic,
                             feed2.isMobile,
                             feed2.latitude,
                             feed2.longitude,
                            ].join(',') + "\n"
                  },
               },
               {
                  description : "Should fail to get info for a private feed with valid authentication, but for the wrong user",
                  url : function() {
                     return ESDR_FEEDS_API_URL + "/" + feed2.id + '/?format=csv&fields=id,name,deviceId,productId,userId,apiKey,apiKeyReadOnly,exposure,isPublic,isMobile,latitude,longitude,channelSpecs,channelBounds';
                  },
                  headers : function() {
                     return createAuthorizationHeader(user2.accessToken);
                  },
                  hasEmptyResponseBody : false,
                  hasEmptyResponseText : true,
                  expectedHttpStatus : httpStatus.FORBIDDEN,
                  expectedStatusText : 'error',
                  expectedResponseData : null
               },
               {
                  description : "Should fail to get info for a private feed with invalid authentication",
                  url : function() {
                     return ESDR_FEEDS_API_URL + "/" + feed2.id + '/?format=csv&fields=id,name,deviceId,productId,userId,apiKey,apiKeyReadOnly,exposure,isPublic,isMobile,latitude,longitude,channelSpecs,channelBounds';
                  },
                  headers : function() {
                     return createAuthorizationHeader("bogus");
                  },
                  hasEmptyResponseBody : false,
                  hasEmptyResponseText : true,
                  expectedHttpStatus : httpStatus.FORBIDDEN,
                  expectedStatusText : 'error',
                  expectedResponseData : null
               },
               {
                  description : "Should fail to get info for a feed with an invalid ID (valid ID plus extra non-numeric characters appended)",
                  url : function() {
                     return ESDR_FEEDS_API_URL + "/" + feed2.id + 'abc' + '/?format=csv&fields=id,name,deviceId,productId,userId,apiKey,apiKeyReadOnly,exposure,isPublic,isMobile,latitude,longitude,channelSpecs,channelBounds';
                  },
                  headers : function() {
                     return createAuthorizationHeader("bogus");
                  },
                  hasEmptyResponseBody : false,
                  hasEmptyResponseText : true,
                  expectedHttpStatus : httpStatus.NOT_FOUND,
                  expectedStatusText : 'error',
                  expectedResponseData : null
               },
            ].forEach(executeTest);
         });   // End OAuth2 authentication

         describe("API Key Authentication", function() {
            describe("Feed API Key in the request header", function() {
               [
                  {
                     description : "Should be able to get info for a public feed with valid read-write authentication",
                     url : function() {
                        return ESDR_FEEDS_API_URL + "/" + feed1.id + '/?format=csv&fields=id,name,deviceId,productId,userId,apiKey,apiKeyReadOnly,exposure,isPublic,isMobile,latitude,longitude,channelSpecs,channelBounds';
                     },
                     headers : function() {
                        return { FeedApiKey : feed1.apiKey }
                     },
                     hasEmptyResponseBody : true,
                     hasEmptyResponseText : false,
                     expectedHttpStatus : httpStatus.OK,
                     getExpectedDynamicResponseData : function() {
                        return "id,name,deviceId,productId,userId,apiKey,apiKeyReadOnly,exposure,isPublic,isMobile,latitude,longitude\n" +
                               [feed1.id,
                                feed1.name,
                                feed1.deviceId,
                                feed1.productId,
                                feed1.userId,
                                feed1.apiKey,
                                feed1.apiKeyReadOnly,
                                feed1.exposure,
                                feed1.isPublic,
                                feed1.isMobile,
                                feed1.latitude,
                                feed1.longitude,
                               ].join(',') + "\n"
                     },
                  },
                  {
                     description : "Should be able to get info for a public feed with valid read-only authentication",
                     url : function() {
                        return ESDR_FEEDS_API_URL + "/" + feed1.id + '/?format=csv&fields=id,name,deviceId,productId,userId,apiKey,apiKeyReadOnly,exposure,isPublic,isMobile,latitude,longitude,channelSpecs,channelBounds';
                     },
                     headers : function() {
                        return { FeedApiKey : feed1.apiKeyReadOnly }
                     },
                     hasEmptyResponseBody : true,
                     hasEmptyResponseText : false,
                     expectedHttpStatus : httpStatus.OK,
                     getExpectedDynamicResponseData : function() {
                        return "id,name,deviceId,productId,userId,apiKeyReadOnly,exposure,isPublic,isMobile,latitude,longitude\n" +
                               [feed1.id,
                                feed1.name,
                                feed1.deviceId,
                                feed1.productId,
                                feed1.userId,
                                feed1.apiKeyReadOnly,
                                feed1.exposure,
                                feed1.isPublic,
                                feed1.isMobile,
                                feed1.latitude,
                                feed1.longitude,
                               ].join(',') + "\n"
                     },
                  },
                  {
                     description : "Should be able to get info for a public feed with valid read-write authentication, but for the wrong feed",
                     url : function() {
                        return ESDR_FEEDS_API_URL + "/" + feed1.id + '/?format=csv&fields=id,name,deviceId,productId,userId,apiKey,apiKeyReadOnly,exposure,isPublic,isMobile,latitude,longitude,channelSpecs,channelBounds';
                     },
                     headers : function() {
                        return { FeedApiKey : feed2.apiKey }
                     },
                     hasEmptyResponseBody : true,
                     hasEmptyResponseText : false,
                     expectedHttpStatus : httpStatus.OK,
                     getExpectedDynamicResponseData : function() {
                        return "id,name,deviceId,productId,userId,apiKeyReadOnly,exposure,isPublic,isMobile,latitude,longitude\n" +
                               [feed1.id,
                                feed1.name,
                                feed1.deviceId,
                                feed1.productId,
                                feed1.userId,
                                feed1.apiKeyReadOnly,
                                feed1.exposure,
                                feed1.isPublic,
                                feed1.isMobile,
                                feed1.latitude,
                                feed1.longitude,
                               ].join(',') + "\n"
                     },
                  },
                  {
                     description : "Should be able to get info for a public feed with valid read-only authentication, but for the wrong feed",
                     url : function() {
                        return ESDR_FEEDS_API_URL + "/" + feed1.id + '/?format=csv&fields=id,name,deviceId,productId,userId,apiKey,apiKeyReadOnly,exposure,isPublic,isMobile,latitude,longitude,channelSpecs,channelBounds';
                     },
                     headers : function() {
                        return { FeedApiKey : feed2.apiKeyReadOnly }
                     },
                     hasEmptyResponseBody : true,
                     hasEmptyResponseText : false,
                     expectedHttpStatus : httpStatus.OK,
                     getExpectedDynamicResponseData : function() {
                        return "id,name,deviceId,productId,userId,apiKeyReadOnly,exposure,isPublic,isMobile,latitude,longitude\n" +
                               [feed1.id,
                                feed1.name,
                                feed1.deviceId,
                                feed1.productId,
                                feed1.userId,
                                feed1.apiKeyReadOnly,
                                feed1.exposure,
                                feed1.isPublic,
                                feed1.isMobile,
                                feed1.latitude,
                                feed1.longitude,
                               ].join(',') + "\n"
                     },
                  },
                  {
                     description : "Should be able to get info for a private feed with valid read-write authentication",
                     url : function() {
                        return ESDR_FEEDS_API_URL + "/" + feed2.id + '/?format=csv&fields=id,name,deviceId,productId,userId,apiKey,apiKeyReadOnly,exposure,isPublic,isMobile,latitude,longitude,channelSpecs,channelBounds';
                     },
                     headers : function() {
                        return { FeedApiKey : feed2.apiKey }
                     },
                     hasEmptyResponseBody : true,
                     hasEmptyResponseText : false,
                     expectedHttpStatus : httpStatus.OK,
                     getExpectedDynamicResponseData : function() {
                        return "id,name,deviceId,productId,userId,apiKey,apiKeyReadOnly,exposure,isPublic,isMobile,latitude,longitude\n" +
                               [feed2.id,
                                feed2.name,
                                feed2.deviceId,
                                feed2.productId,
                                feed2.userId,
                                feed2.apiKey,
                                feed2.apiKeyReadOnly,
                                feed2.exposure,
                                feed2.isPublic,
                                feed2.isMobile,
                                feed2.latitude,
                                feed2.longitude,
                               ].join(',') + "\n"
                     },
                  },
                  {
                     description : "Should be able to get info for a private feed with valid read-only authentication",
                     url : function() {
                        return ESDR_FEEDS_API_URL + "/" + feed2.id + '/?format=csv&fields=id,name,deviceId,productId,userId,apiKey,apiKeyReadOnly,exposure,isPublic,isMobile,latitude,longitude,channelSpecs,channelBounds';
                     },
                     headers : function() {
                        return { FeedApiKey : feed2.apiKeyReadOnly }
                     },
                     hasEmptyResponseBody : true,
                     hasEmptyResponseText : false,
                     expectedHttpStatus : httpStatus.OK,
                     getExpectedDynamicResponseData : function() {
                        return "id,name,deviceId,productId,userId,apiKeyReadOnly,exposure,isPublic,isMobile,latitude,longitude\n" +
                               [feed2.id,
                                feed2.name,
                                feed2.deviceId,
                                feed2.productId,
                                feed2.userId,
                                feed2.apiKeyReadOnly,
                                feed2.exposure,
                                feed2.isPublic,
                                feed2.isMobile,
                                feed2.latitude,
                                feed2.longitude,
                               ].join(',') + "\n"
                     },
                  },
                  {
                     description : "Should fail to get info for a private feed with invalid authentication",
                     url : function() {
                        return ESDR_FEEDS_API_URL + "/" + feed2.id + '/?format=csv&fields=id,name,deviceId,productId,userId,apiKey,apiKeyReadOnly,exposure,isPublic,isMobile,latitude,longitude,channelSpecs,channelBounds';
                     },
                     headers : function() {
                        return { FeedApiKey : "bogus" }
                     },
                     hasEmptyResponseBody : false,
                     hasEmptyResponseText : true,
                     expectedHttpStatus : httpStatus.FORBIDDEN,
                     expectedStatusText : 'error',
                     expectedResponseData : null
                  },
                  {
                     description : "Should fail to get info for a private feed with valid read-write authentication, but for the wrong feed",
                     url : function() {
                        return ESDR_FEEDS_API_URL + "/" + feed2.id + '/?format=csv&fields=id,name,deviceId,productId,userId,apiKey,apiKeyReadOnly,exposure,isPublic,isMobile,latitude,longitude,channelSpecs,channelBounds';
                     },
                     headers : function() {
                        return { FeedApiKey : feed1.apiKey }
                     },
                     hasEmptyResponseBody : false,
                     hasEmptyResponseText : true,
                     expectedHttpStatus : httpStatus.FORBIDDEN,
                     expectedStatusText : 'error',
                     expectedResponseData : null
                  },
                  {
                     description : "Should fail to get info for a private feed with valid read-only authentication, but for the wrong feed",
                     url : function() {
                        return ESDR_FEEDS_API_URL + "/" + feed2.id + '/?format=csv&fields=id,name,deviceId,productId,userId,apiKey,apiKeyReadOnly,exposure,isPublic,isMobile,latitude,longitude,channelSpecs,channelBounds';
                     },
                     headers : function() {
                        return { FeedApiKey : feed1.apiKeyReadOnly }
                     },
                     hasEmptyResponseBody : false,
                     hasEmptyResponseText : true,
                     expectedHttpStatus : httpStatus.FORBIDDEN,
                     expectedStatusText : 'error',
                     expectedResponseData : null
                  },
               ].forEach(executeTest);
            });   // End Feed API Key in the request header

            describe("Feed API Key in the URL", function() {
               [
                  {
                     description : "Should be able to get info for a public feed with valid read-write authentication",
                     url : function() {
                        return ESDR_FEEDS_API_URL + "/" + feed1.apiKey + '/?format=csv&fields=id,name,deviceId,productId,userId,apiKey,apiKeyReadOnly,exposure,isPublic,isMobile,latitude,longitude,channelSpecs,channelBounds';
                     },
                     hasEmptyResponseBody : true,
                     hasEmptyResponseText : false,
                     expectedHttpStatus : httpStatus.OK,
                     getExpectedDynamicResponseData : function() {
                        return "id,name,deviceId,productId,userId,apiKey,apiKeyReadOnly,exposure,isPublic,isMobile,latitude,longitude\n" +
                               [feed1.id,
                                feed1.name,
                                feed1.deviceId,
                                feed1.productId,
                                feed1.userId,
                                feed1.apiKey,
                                feed1.apiKeyReadOnly,
                                feed1.exposure,
                                feed1.isPublic,
                                feed1.isMobile,
                                feed1.latitude,
                                feed1.longitude,
                               ].join(',') + "\n"
                     },
                  },
                  {
                     description : "Should be able to get info for a public feed with valid read-only authentication",
                     url : function() {
                        return ESDR_FEEDS_API_URL + "/" + feed1.apiKeyReadOnly + '/?format=csv&fields=id,name,deviceId,productId,userId,apiKey,apiKeyReadOnly,exposure,isPublic,isMobile,latitude,longitude,channelSpecs,channelBounds';
                     },
                     hasEmptyResponseBody : true,
                     hasEmptyResponseText : false,
                     expectedHttpStatus : httpStatus.OK,
                     getExpectedDynamicResponseData : function() {
                        return "id,name,deviceId,productId,userId,apiKeyReadOnly,exposure,isPublic,isMobile,latitude,longitude\n" +
                               [feed1.id,
                                feed1.name,
                                feed1.deviceId,
                                feed1.productId,
                                feed1.userId,
                                feed1.apiKeyReadOnly,
                                feed1.exposure,
                                feed1.isPublic,
                                feed1.isMobile,
                                feed1.latitude,
                                feed1.longitude,
                               ].join(',') + "\n"
                     },
                  },
                  {
                     description : "Should be able to get info for a private feed with valid read-write authentication",
                     url : function() {
                        return ESDR_FEEDS_API_URL + "/" + feed2.apiKey + '/?format=csv&fields=id,name,deviceId,productId,userId,apiKey,apiKeyReadOnly,exposure,isPublic,isMobile,latitude,longitude,channelSpecs,channelBounds';
                     },
                     hasEmptyResponseBody : true,
                     hasEmptyResponseText : false,
                     expectedHttpStatus : httpStatus.OK,
                     getExpectedDynamicResponseData : function() {
                        return "id,name,deviceId,productId,userId,apiKey,apiKeyReadOnly,exposure,isPublic,isMobile,latitude,longitude\n" +
                               [feed2.id,
                                feed2.name,
                                feed2.deviceId,
                                feed2.productId,
                                feed2.userId,
                                feed2.apiKey,
                                feed2.apiKeyReadOnly,
                                feed2.exposure,
                                feed2.isPublic,
                                feed2.isMobile,
                                feed2.latitude,
                                feed2.longitude,
                               ].join(',') + "\n"
                     },
                  },
                  {
                     description : "Should be able to get info for a private feed with valid read-only authentication",
                     url : function() {
                        return ESDR_FEEDS_API_URL + "/" + feed2.apiKeyReadOnly + '/?format=csv&fields=id,name,deviceId,productId,userId,apiKey,apiKeyReadOnly,exposure,isPublic,isMobile,latitude,longitude,channelSpecs,channelBounds';
                     },
                     hasEmptyResponseBody : true,
                     hasEmptyResponseText : false,
                     expectedHttpStatus : httpStatus.OK,
                     getExpectedDynamicResponseData : function() {
                        return "id,name,deviceId,productId,userId,apiKeyReadOnly,exposure,isPublic,isMobile,latitude,longitude\n" +
                               [feed2.id,
                                feed2.name,
                                feed2.deviceId,
                                feed2.productId,
                                feed2.userId,
                                feed2.apiKeyReadOnly,
                                feed2.exposure,
                                feed2.isPublic,
                                feed2.isMobile,
                                feed2.latitude,
                                feed2.longitude,
                               ].join(',') + "\n"
                     },
                  },
                  {
                     description : "Should fail to get info for a private feed with valid read-write authentication, but for the wrong feed",
                     url : function() {
                        return ESDR_FEEDS_API_URL + "/" + UNKNOWN_FEED_API_KEY + '/?format=csv&fields=id,name,deviceId,productId,userId,apiKey,apiKeyReadOnly,exposure,isPublic,isMobile,latitude,longitude,channelSpecs,channelBounds';
                     },
                     hasEmptyResponseBody : false,
                     hasEmptyResponseText : true,
                     expectedHttpStatus : httpStatus.NOT_FOUND,
                     expectedStatusText : 'error',
                     expectedResponseData : null
                  },
               ].forEach(executeTest);
            });   // End Feed API Key in the URL
         });   // End API Key Authentication

      });   // End Get Info (CSV)

   });   // End Feeds
});   // End REST API

const should = require('should');
const flow = require('nimble');
const httpStatus = require('http-status');
const requireNew = require('require-new');
const wipe = require('./fixture-helpers/wipe');
const setup = require('./fixture-helpers/setup');
const executeUploadTest = require('./fixture-helpers/test-utils').executeUploadTest;

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

   const invalidChannelName1 = {
      request : requireNew('./fixtures/feed-upload-invalid-channel-name-1-request.json'),
      response : requireNew('./fixtures/feed-upload-invalid-channel-name-1-response.json')
   }

   const invalidChannelName2 = {
      request : requireNew('./fixtures/feed-upload-invalid-channel-name-2-request.json'),
      response : requireNew('./fixtures/feed-upload-invalid-channel-name-2-response.json')
   }

   const invalidChannelName3 = {
      request : requireNew('./fixtures/feed-upload-invalid-channel-name-3-request.json'),
      response : requireNew('./fixtures/feed-upload-invalid-channel-name-3-response.json')
   }

   const invalidChannelName4 = {
      request : requireNew('./fixtures/feed-upload-invalid-channel-name-4-request.json'),
      response : requireNew('./fixtures/feed-upload-invalid-channel-name-4-response.json')
   }

   before(function(initDone) {
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
               }
            ],
            initDone
      );
   });

   describe("Feeds", function() {
      describe("Upload", function() {
         describe("To /feeds method", function() {
            describe("API Key Authentication", function() {
               describe("Feed API Key in the URL", function() {

                  [
                     {
                        description : "Should be able to upload empty data to a public feed using the feed's apiKey to authenticate",
                        url : function() {
                           return ESDR_FEEDS_API_URL + "/" + feed1.apiKey;
                        },
                        dataToUpload : {},
                        expectedHttpStatus : httpStatus.OK,
                        expectedStatusText : 'success',
                        expectedResponseData : {
                           channelBounds : {},
                           importedBounds : {}
                        }
                     },
                     {
                        description : "Should be able to upload empty data to a private feed using the feed's apiKey to authenticate",
                        url : function() {
                           return ESDR_FEEDS_API_URL + "/" + feed2.apiKey;
                        },
                        dataToUpload : {},
                        expectedHttpStatus : httpStatus.OK,
                        expectedStatusText : 'success',
                        expectedResponseData : {
                           channelBounds : {},
                           importedBounds : {}
                        }
                     },
                     {
                        description : "Should be able to upload to a public feed using the feed's apiKey to authenticate",
                        url : function() {
                           return ESDR_FEEDS_API_URL + "/" + feed1.apiKey;
                        },
                        dataToUpload : feedUpload1.request,
                        expectedHttpStatus : httpStatus.OK,
                        expectedStatusText : 'success',
                        expectedResponseData : feedUpload1.response.data
                     },
                     {
                        description : "Should be able to upload to a private feed using the feed's apiKey to authenticate",
                        url : function() {
                           return ESDR_FEEDS_API_URL + "/" + feed2.apiKey;
                        },
                        dataToUpload : feedUpload5.request,
                        expectedHttpStatus : httpStatus.OK,
                        expectedStatusText : 'success',
                        expectedResponseData : feedUpload5.response.data
                     },
                     {
                        description : "Should be able to upload more data to a public feed using the feed's apiKey to authenticate",
                        url : function() {
                           return ESDR_FEEDS_API_URL + "/" + feed1.apiKey;
                        },
                        dataToUpload : feedUpload2.request,
                        expectedHttpStatus : httpStatus.OK,
                        expectedStatusText : 'success',
                        expectedResponseData : feedUpload2.response.data
                     },
                     {
                        description : "Should be able to upload more data to a private feed using the feed's apiKey to authenticate",
                        url : function() {
                           return ESDR_FEEDS_API_URL + "/" + feed2.apiKey;
                        },
                        dataToUpload : feedUpload6.request,
                        expectedHttpStatus : httpStatus.OK,
                        expectedStatusText : 'success',
                        expectedResponseData : feedUpload6.response.data
                     },
                     {
                        description : "Should be able to upload data for a single channel to a public feed (this one will affect the min/max times)",
                        url : function() {
                           return ESDR_FEEDS_API_URL + "/" + feed1.apiKey;
                        },
                        dataToUpload : feedUpload3.request,
                        expectedHttpStatus : httpStatus.OK,
                        expectedStatusText : 'success',
                        expectedResponseData : feedUpload3.response.data
                     },
                     {
                        description : "Should be able to upload data for a single channel to a private feed (this one will affect the min/max times)",
                        url : function() {
                           return ESDR_FEEDS_API_URL + "/" + feed2.apiKey;
                        },
                        dataToUpload : feedUpload7.request,
                        expectedHttpStatus : httpStatus.OK,
                        expectedStatusText : 'success',
                        expectedResponseData : feedUpload7.response.data
                     },

                     {
                        description : "Should be able to upload data for a single channel to a public feed (this one won't affect the min/max times)",
                        url : function() {
                           return ESDR_FEEDS_API_URL + "/" + feed1.apiKey;
                        },
                        dataToUpload : feedUpload4.request,
                        expectedHttpStatus : httpStatus.OK,
                        expectedStatusText : 'success',
                        expectedResponseData : feedUpload4.response.data
                     },
                     {
                        description : "Should be able to upload data for a single channel to a private feed (this one won't affect the min/max times)",
                        url : function() {
                           return ESDR_FEEDS_API_URL + "/" + feed2.apiKey;
                        },
                        dataToUpload : feedUpload8.request,
                        expectedHttpStatus : httpStatus.OK,
                        expectedStatusText : 'success',
                        expectedResponseData : feedUpload8.response.data
                     },
                     {
                        description : "Should fail to upload to a public feed using the read-only apiKey to authenticate",
                        url : function() {
                           return ESDR_FEEDS_API_URL + "/" + feed1.apiKeyReadOnly;
                        },
                        dataToUpload : {},
                        expectedHttpStatus : httpStatus.FORBIDDEN,
                        expectedStatusText : 'error',
                        expectedResponseData : null
                     },
                     {
                        description : "Should fail to upload to a private feed using the read-only apiKey to authenticate",
                        url : function() {
                           return ESDR_FEEDS_API_URL + "/" + feed2.apiKeyReadOnly;
                        },
                        dataToUpload : {},
                        expectedHttpStatus : httpStatus.FORBIDDEN,
                        expectedStatusText : 'error',
                        expectedResponseData : null
                     },
                     {
                        description : "Should fail to upload using an invalid feed apiKey to authenticate",
                        url : function() {
                           return ESDR_FEEDS_API_URL + "/" + "bogus";
                        },
                        dataToUpload : {},
                        expectedHttpStatus : httpStatus.NOT_FOUND,
                        expectedStatusText : 'error',
                        expectedResponseData : null
                     },
                     {
                        description : "Should fail to upload using a valid but unknown feed apiKey to authenticate",
                        url : function() {
                           return ESDR_FEEDS_API_URL + "/" + UNKNOWN_FEED_API_KEY;
                        },
                        dataToUpload : {},
                        expectedHttpStatus : httpStatus.NOT_FOUND,
                        expectedStatusText : 'error',
                        expectedResponseData : null
                     },
                     {
                        description : "Should fail to upload to a feed if one or more channel names is invalid",
                        url : function() {
                           return ESDR_FEEDS_API_URL + "/" + feed1.apiKey;
                        },
                        dataToUpload : invalidChannelName1.request,
                        expectedHttpStatus : httpStatus.UNPROCESSABLE_ENTITY,
                        expectedStatusText : 'error',
                        expectedResponseData : invalidChannelName1.response,
                     },
                     {
                        description : "Should fail to upload to a feed if one or more channel names is invalid",
                        url : function() {
                           return ESDR_FEEDS_API_URL + "/" + feed1.apiKey;
                        },
                        dataToUpload : invalidChannelName2.request,
                        expectedHttpStatus : httpStatus.UNPROCESSABLE_ENTITY,
                        expectedStatusText : 'error',
                        expectedResponseData : invalidChannelName2.response,
                     },
                     {
                        description : "Should fail to upload to a feed if one or more channel names is invalid",
                        url : function() {
                           return ESDR_FEEDS_API_URL + "/" + feed1.apiKey;
                        },
                        dataToUpload : invalidChannelName3.request,
                        expectedHttpStatus : httpStatus.UNPROCESSABLE_ENTITY,
                        expectedStatusText : 'error',
                        expectedResponseData : invalidChannelName3.response,
                     },
                     {
                        description : "Should fail to upload to a feed if one or more channel names is invalid",
                        url : function() {
                           return ESDR_FEEDS_API_URL + "/" + feed1.apiKey;
                        },
                        dataToUpload : invalidChannelName4.request,
                        expectedHttpStatus : httpStatus.UNPROCESSABLE_ENTITY,
                        expectedStatusText : 'error',
                        expectedResponseData : invalidChannelName4.response,
                     }
                  ].forEach(executeUploadTest);

               });   // End Feed API Key in the URL
            });   // End API Key Authentication
         });   // End To /feeds method
      });   // End Upload
   });   // End Feeds
});   // End REST API

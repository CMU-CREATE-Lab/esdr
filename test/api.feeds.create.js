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
const ESDR_FEEDS_API_URL = ESDR_API_ROOT_URL + "/feeds";

describe("REST API", function() {
   const user1 = requireNew('./fixtures/user1.json');
   const user2 = requireNew('./fixtures/user2.json');
   const product1 = requireNew('./fixtures/product1.json');
   const product2 = requireNew('./fixtures/product2.json');
   const device1User1 = requireNew('./fixtures/device1.json');
   const device2User1 = requireNew('./fixtures/device2.json');
   const device2User2 = requireNew('./fixtures/device3.json');
   const feed1 = requireNew('./fixtures/feed1.json');
   const feed2 = requireNew('./fixtures/feed2.json');
   const feed3 = requireNew('./fixtures/feed3.json');
   const feed4 = requireNew('./fixtures/feed4.json');
   const feed5 = requireNew('./fixtures/feed5.json');
   const feed6 = requireNew('./fixtures/feed6.json');
   const feedCustomChannelSpecs = requireNew('./fixtures/feed-custom-channelSpecs.json');
   const feedNullChannelSpecs = requireNew('./fixtures/feed-null-channelSpecs.json');
   const feedMissingRequiredFields = requireNew('./fixtures/feed-missing-required-fields.json');
   const feedInvalidFields = requireNew('./fixtures/feed-invalid-fields.json');

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
                  product1.creatorUserId = user1['id'];
                  setup.createProduct(product1, done);
               },
               function(done) {
                  product2.creatorUserId = user1['id'];
                  setup.createProduct(product2, done);
               },
               function(done) {
                  device1User1.userId = user1['id'];
                  device1User1.productId = product1['id'];
                  setup.createDevice(device1User1, done);
               },
               function(done) {
                  device2User1.userId = user1['id'];
                  device2User1.productId = product2['id'];
                  setup.createDevice(device2User1, done);
               },
               function(done) {
                  device2User2.userId = user2['id'];
                  device2User2.productId = product1['id'];
                  setup.createDevice(device2User2, done);
               }
            ],
            initDone
      );
   });

   describe("Feeds", function() {
      describe("Create", function() {
         const creationTests = [
            {
               description : "Should be able to create a new (public) feed",
               accessToken : function() {
                  return user1['accessToken']
               },
               device : device1User1,
               feed : feed1,
               user : user1,
               expectedHttpStatus : httpStatus.CREATED,
               expectedStatusText : 'success',
               additionalTests : function(originalErr, originalRes, done) {
                  // verify that the feed got the product's defaultChannelSpecs...
                  superagent
                        .get(ESDR_FEEDS_API_URL + "/" + feed1['id'] + "?fields=channelSpecs")
                        .set(createAuthorizationHeader(user1['accessToken']))
                        .end(function(err, res) {
                           should.not.exist(err);
                           should.exist(res);

                           res.should.have.property('status', httpStatus.OK);
                           res.should.have.property('body');
                           res.body.should.have.properties({
                                                              code : httpStatus.OK,
                                                              status : "success"
                                                           });
                           res.body.should.have.property('data');
                           res.body.data.should.have.property('channelSpecs', JSON.parse(product1['defaultChannelSpecs']));

                           done();
                        });
               }
            },
            {
               description : "Should be able to create an additional feed (private) for a device",
               accessToken : function() {
                  return user1['accessToken']
               },
               device : device1User1,
               feed : feed2,
               user : user1,
               expectedHttpStatus : httpStatus.CREATED,
               expectedStatusText : 'success'
            },
            {
               description : "Should be able to create a new (public) feed for a different device and product",
               accessToken : function() {
                  return user1['accessToken']
               },
               device : device2User1,
               feed : feed3,
               user : user1,
               expectedHttpStatus : httpStatus.CREATED,
               expectedStatusText : 'success'
            },
            {
               description : "Should be able to create an additional feed (private) for a different device and product",
               accessToken : function() {
                  return user1['accessToken']
               },
               device : device2User1,
               feed : feed4,
               user : user1,
               expectedHttpStatus : httpStatus.CREATED,
               expectedStatusText : 'success'
            },
            {
               description : "Should be able to create a new (public) feed, for a different user",
               accessToken : function() {
                  return user2['accessToken']
               },
               device : device2User2,
               feed : feed5,
               user : user2,
               expectedHttpStatus : httpStatus.CREATED,
               expectedStatusText : 'success'
            },
            {
               description : "Should be able to create a new (private) feed, for a different user",
               accessToken : function() {
                  return user2['accessToken']
               },
               device : device2User2,
               feed : feed6,
               user : user2,
               expectedHttpStatus : httpStatus.CREATED,
               expectedStatusText : 'success'
            },
            {
               description : "Should be able to create a new feed with a null channelSpecs (will use Product's defaultChannelSpecs)",
               accessToken : function() {
                  return user1['accessToken']
               },
               device : device1User1,
               feed : feedNullChannelSpecs,
               user : user1,
               expectedHttpStatus : httpStatus.CREATED,
               expectedStatusText : 'success',
               additionalTests : function(originalErr, originalRes, done) {
                  // verify that the feed got the product's defaultChannelSpecs...
                  superagent
                        .get(ESDR_FEEDS_API_URL + "/" + feedNullChannelSpecs['id'] + "?fields=channelSpecs")
                        .set(createAuthorizationHeader(user1['accessToken']))
                        .end(function(err, res) {
                           should.not.exist(err);
                           should.exist(res);

                           res.should.have.property('status', httpStatus.OK);
                           res.should.have.property('body');
                           res.body.should.have.properties({
                                                              code : httpStatus.OK,
                                                              status : "success"
                                                           });
                           res.body.should.have.property('data');
                           res.body.data.should.have.property('channelSpecs', JSON.parse(product1['defaultChannelSpecs']));

                           done();
                        });
               }
            },
            {
               description : "Should be able to create a new feed with a custom channelSpecs (different from the Product's defaultChannelSpecs)",
               accessToken : function() {
                  return user1['accessToken']
               },
               device : device1User1,
               feed : feedCustomChannelSpecs,
               user : user1,
               expectedHttpStatus : httpStatus.CREATED,
               expectedStatusText : 'success',
               additionalTests : function(originalErr, originalRes, done) {
                  superagent
                        .get(ESDR_FEEDS_API_URL + "/" + feedCustomChannelSpecs['id'] + "?fields=channelSpecs")
                        .set(createAuthorizationHeader(user1['accessToken']))
                        .end(function(err, res) {
                           should.not.exist(err);
                           should.exist(res);

                           res.should.have.property('status', httpStatus.OK);
                           res.should.have.property('body');
                           res.body.should.have.properties({
                                                              code : httpStatus.OK,
                                                              status : "success"
                                                           });
                           res.body.should.have.property('data');
                           res.body.data.should.have.property('channelSpecs', feedCustomChannelSpecs['channelSpecs']);

                           done();
                        });
               }
            },
            {
               description : "Should fail to create a new feed for a bogus device",
               accessToken : function() {
                  return user1['accessToken']
               },
               device : { id : -1 },
               feed : feed1,
               user : user1,
               expectedHttpStatus : httpStatus.NOT_FOUND,
               expectedStatusText : 'error',
               expectedResponseData : null
            },
            {
               description : "Should fail to create a new feed for a device owned by a different user",
               accessToken : function() {
                  return user2['accessToken']
               },
               device : device1User1,
               feed : feed2,
               user : user2,
               expectedHttpStatus : httpStatus.FORBIDDEN,
               expectedStatusText : 'error',
               expectedResponseData : null
            },
            {
               description : "Should fail to create a new feed if the OAuth2 token is invalid",
               accessToken : function() {
                  return "bogus"
               },
               device : device1User1,
               feed : feed2,
               user : user1,
               expectedHttpStatus : httpStatus.UNAUTHORIZED,
               expectedStatusText : 'error',
               hasEmptyBody : true
            }
         ];

         creationTests.forEach(function(test) {
            it(test.description, function(done) {
               superagent
                     .post(ESDR_DEVICES_API_URL + "/" + test.device['id'] + "/feeds")
                     .set(createAuthorizationHeader(test['accessToken']))
                     .send(test.feed)
                     .end(function(err, res) {
                        should.not.exist(err);
                        should.exist(res);

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

                           if (test.expectedHttpStatus === httpStatus.CREATED) {
                              res.body.data.should.have.property('id');
                              res.body.data.should.have.property('apiKey');
                              res.body.data.should.have.property('apiKeyReadOnly');

                              // remember the database ID, productId, deviceId, and userId
                              test.feed['id'] = res.body.data['id'];
                              test.feed.productId = test.device.productId;
                              test.feed.deviceId = test.device['id'];
                              test.feed.userId = test.user['id'];
                              test.feed.apiKey = res.body.data.apiKey;
                              test.feed.apiKeyReadOnly = res.body.data.apiKeyReadOnly;
                           }
                        }

                        if (typeof test.additionalTests === 'function') {
                           test.additionalTests(err, res, done);
                        }
                        else {
                           done();
                        }
                     });
            });
         });

         const creationValidationTests = [
            {
               description : "Should fail to create a feed if required fields are missing",
               accessToken : function() {
                  return user1['accessToken']
               },
               device : device1User1,
               feed : feedMissingRequiredFields,
               getExpectedValidationItems : function() {
                  return [
                     {
                        "keyword" : "required",
                        "dataPath" : "",
                        "schemaPath" : "#/required",
                        "params" : {
                           "missingProperty" : "name"
                        }
                     },
                     {
                        "keyword" : "required",
                        "dataPath" : "",
                        "schemaPath" : "#/required",
                        "params" : {
                           "missingProperty" : "exposure"
                        }
                     }
                  ];
               }
            },
            {
               description : "Should fail to create a new feed if the feed is null",
               accessToken : function() {
                  return user1['accessToken']
               },
               device : device1User1,
               feed : null,
               getExpectedValidationItems : function() {
                  return [
                     {
                        "keyword" : "required",
                        "dataPath" : "",
                        "schemaPath" : "#/required",
                        "params" : {
                           "missingProperty" : "name"
                        }
                     },
                     {
                        "keyword" : "required",
                        "dataPath" : "",
                        "schemaPath" : "#/required",
                        "params" : {
                           "missingProperty" : "exposure"
                        }
                     }
                  ];
               }
            },
            {
               description : "Should fail to create a feed if fields are invalid",
               accessToken : function() {
                  return user1['accessToken']
               },
               device : device1User1,
               feed : feedInvalidFields,
               getExpectedValidationItems : function() {
                  return [
                     {
                        "keyword" : "maxLength",
                        "dataPath" : ".name",
                        "schemaPath" : "#/properties/name/maxLength"
                     },
                     {
                        "keyword" : "enum",
                        "dataPath" : ".exposure",
                        "schemaPath" : "#/properties/exposure/enum"
                     },
                     {
                        "keyword" : "type",
                        "dataPath" : ".latitude",
                        "schemaPath" : "#/properties/latitude/type",
                        "params" : {
                           "type" : "number,null"
                        }
                     },
                     {
                        "keyword" : "maximum",
                        "dataPath" : ".longitude",
                        "schemaPath" : "#/properties/longitude/maximum"
                     }
                  ];
               }
            }
         ];

         creationValidationTests.forEach(function(test) {
            it(test.description, function(done) {
               superagent
                     .post(ESDR_DEVICES_API_URL + "/" + test.device['id'] + "/feeds")
                     .set(createAuthorizationHeader(test['accessToken']))
                     .send(test.feed)
                     .end(function(err, res) {
                        should.not.exist(err);
                        should.exist(res);

                        res.should.have.property('status', httpStatus.UNPROCESSABLE_ENTITY);
                        res.should.have.property('body');
                        res.body.should.have.properties({
                                                           code : httpStatus.UNPROCESSABLE_ENTITY,
                                                           status : 'error'
                                                        });

                        const expectedValidationItems = test.getExpectedValidationItems();
                        res.body.should.have.property('data');
                        res.body.data.errors.should.have.length(expectedValidationItems.length);
                        res.body.data.errors.forEach(function(validationItem, index) {
                           validationItem.should.have.properties(expectedValidationItems[index]);
                        });

                        done();
                     });
            });
         });

      });   // End Create

   });   // End Feeds
});   // End REST API

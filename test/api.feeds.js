var should = require('should');
var flow = require('nimble');
var httpStatus = require('http-status');
var superagent = require('superagent-ls');
var requireNew = require('require-new');
var wipe = require('./fixture-helpers/wipe');
var setup = require('./fixture-helpers/setup');

var config = require('../config');

var ESDR_API_ROOT_URL = config.get("esdr:apiRootUrl");
var ESDR_DEVICES_API_URL = ESDR_API_ROOT_URL + "/devices";
var ESDR_FEEDS_API_URL = ESDR_API_ROOT_URL + "/feeds";

describe("REST API", function() {
   var user1 = requireNew('./fixtures/user1.json');
   var user2 = requireNew('./fixtures/user2.json');
   var product1 = requireNew('./fixtures/product1.json');
   var device1User1 = requireNew('./fixtures/device1.json');
   var feed1a = requireNew('./fixtures/feed1a.json');
   var feed1b = requireNew('./fixtures/feed1b.json');
   var feed1c = requireNew('./fixtures/feed1c.json');
   var feedNullChannelSpecs = requireNew('./fixtures/feed-null-channelSpecs.json');
   var feedMissingRequiredFields = requireNew('./fixtures/feed-missing-required-fields.json');
   var feedInvalidFields = requireNew('./fixtures/feed-invalid-fields.json');

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
                  device1User1.userId = user1.id;
                  device1User1.productId = product1.id;
                  setup.createDevice(device1User1, done);
               }
            ],
            initDone
      );
   });

   describe.only("Feeds", function() {
      var createAuthorizationHeader = function(accessToken) {
         var token = typeof accessToken === 'function' ? accessToken() : accessToken;
         var authorization;
         if (typeof token !== 'undefined' && token != null) {
            authorization = {
               Authorization : "Bearer " + token
            };
         }

         return authorization;
      };

      describe("Create", function() {
         var creationTests = [
            {
               description : "Should be able to create a new feed",
               accessToken : function() {
                  return user1.accessToken
               },
               device : device1User1,
               feed : feed1a,
               user : user1,
               expectedHttpStatus : httpStatus.CREATED,
               expectedStatusText : 'success'
            },
            {
               description : "Should be able to create an additional feed for a device",
               accessToken : function() {
                  return user1.accessToken
               },
               device : device1User1,
               feed : feed1b,
               user : user1,
               expectedHttpStatus : httpStatus.CREATED,
               expectedStatusText : 'success'
            },
            {
               description : "Should be able to create a new feed with a null channelSpecs (will use Product's defaultChannelSpecs)",
               accessToken : function() {
                  return user1.accessToken
               },
               device : device1User1,
               feed : feedNullChannelSpecs,
               user : user1,
               expectedHttpStatus : httpStatus.CREATED,
               expectedStatusText : 'success'
            },
            {
               description : "Should be able to create a new feed with a custom channelSpecs (different from the Product's defaultChannelSpecs)",
               accessToken : function() {
                  return user1.accessToken
               },
               device : device1User1,
               feed : feed1c,
               user : user1,
               expectedHttpStatus : httpStatus.CREATED,
               expectedStatusText : 'success'
            },
            {
               description : "Should fail to create a new feed for a bogus device",
               accessToken : function() {
                  return user1.accessToken
               },
               device : { id : -1 },
               feed : feed1a,
               user : user1,
               expectedHttpStatus : httpStatus.NOT_FOUND,
               expectedStatusText : 'error',
               expectedResponseData : null
            },
            {
               description : "Should fail to create a new feed for a device owned by a different user",
               accessToken : function() {
                  return user2.accessToken
               },
               device : device1User1,
               feed : feed1b,
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
               feed : feed1b,
               user : user1,
               expectedHttpStatus : httpStatus.UNAUTHORIZED,
               expectedStatusText : 'error',
               hasEmptyBody : true
            }
         ];

         creationTests.forEach(function(test) {
            it(test.description, function(done) {
               superagent
                     .post(ESDR_DEVICES_API_URL + "/" + test.device.id + "/feeds")
                     .set(createAuthorizationHeader(test.accessToken))
                     .send(test.feed)
                     .end(function(err, res) {
                        should.not.exist(err);
                        should.exist(res);

                        res.should.have.property('status', test.expectedHttpStatus);
                        if (!test.hasEmptyBody) {
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

                           if (test.expectedHttpStatus == httpStatus.CREATED) {
                              res.body.data.should.have.property('id');
                              res.body.data.should.have.property('apiKey');
                              res.body.data.should.have.property('apiKeyReadOnly');

                              // remember the database ID, productId, deviceId, and userId
                              test.feed.id = res.body.data.id;
                              test.feed.productId = test.device.productId;
                              test.feed.deviceId = test.device.id;
                              test.feed.userId = test.user.id;
                              test.feed.apiKey = res.body.data.apiKey;
                              test.feed.apiKeyReadOnly = res.body.data.apiKeyReadOnly;
                           }
                        }

                        done();
                     });
            });
         });

         var creationValidationTests = [
            {
               description : "Should fail to create a feed if required fields are missing",
               accessToken : function() {
                  return user1.accessToken
               },
               device : device1User1,
               feed : feedMissingRequiredFields,
               getExpectedValidationItems : function() {
                  return [
                     {
                        instanceContext : '#',
                        constraintName : 'required',
                        constraintValue : global.db.feeds.jsonSchema.required,
                        kind : 'ObjectValidationError'
                     }
                  ];
               }
            },
            {
               description : "Should fail to create a new feed if the feed is null",
               accessToken : function() {
                  return user1.accessToken
               },
               device : device1User1,
               feed : null,
               getExpectedValidationItems : function() {
                  return [
                     {
                        instanceContext : '#',
                        constraintName : 'required',
                        constraintValue : global.db.feeds.jsonSchema.required,
                        kind : 'ObjectValidationError'
                     }
                  ];
               }
            },
            {
               description : "Should fail to create a feed if fields are invalid",
               accessToken : function() {
                  return user1.accessToken
               },
               device : device1User1,
               feed : feedInvalidFields,
               getExpectedValidationItems : function() {
                  return [
                     {
                        instanceContext : '#/name',
                        constraintName : 'maxLength',
                        constraintValue : global.db.feeds.jsonSchema.properties.name.maxLength,
                        kind : 'StringValidationError'
                     },
                     {
                        instanceContext : '#/exposure',
                        constraintName : 'enum',
                        constraintValue : global.db.feeds.jsonSchema.properties.exposure.enum
                     },
                     {
                        instanceContext : '#/latitude',
                        constraintName : 'type',
                        constraintValue : global.db.feeds.jsonSchema.properties.latitude.type
                     },
                     {
                        instanceContext : '#/longitude',
                        constraintName : 'maximum',
                        constraintValue : global.db.feeds.jsonSchema.properties.longitude.maximum,
                        kind : 'NumericValidationError'
                     }
                  ];
               }
            }
         ];

         creationValidationTests.forEach(function(test) {
            it(test.description, function(done) {
               superagent
                     .post(ESDR_DEVICES_API_URL + "/" + test.device.id + "/feeds")
                     .set(createAuthorizationHeader(test.accessToken))
                     .send(test.feed)
                     .end(function(err, res) {
                        should.not.exist(err);
                        should.exist(res);

                        res.should.have.property('status', httpStatus.UNPROCESSABLE_ENTITY);
                        res.body.should.have.properties({
                                                           code : httpStatus.UNPROCESSABLE_ENTITY,
                                                           status : 'error'
                                                        });

                        var expectedValidationItems = test.getExpectedValidationItems();
                        res.body.should.have.property('data');
                        res.body.data.should.have.length(expectedValidationItems.length);
                        res.body.data.forEach(function(validationItem, index) {
                           validationItem.should.have.properties(expectedValidationItems[index]);
                        });

                        done();
                     });
            });
         });

      });   // End Create

      describe("Find", function() {
         // TODO: verify that feed with undefined channel specs got the Products channel specs
         // TODO: verify that feed with null channel specs got the Products channel specs
         // TODO: verify that feed with custom channel specs DIDN'T get the Products channel specs

      });   // End Find
   });   // End Feeds
});   // End REST API
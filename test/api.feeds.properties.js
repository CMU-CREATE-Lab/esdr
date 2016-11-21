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
var ESDR_FEEDS_API_URL = ESDR_API_ROOT_URL + "/feeds/";
var BOGUS_FEED_ID = 1;

var createValue = function(type, value) {
   return {
      type : type,
      value : value
   };
};

var setProperty = function(feedId, accessToken, propertyKey, propertyValue, callback, willDebug) {
   superagent
         .put(ESDR_FEEDS_API_URL + feedId + "/properties/" + propertyKey)
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
         .get(ESDR_FEEDS_API_URL + feedId + "/properties/" + propertyKey)
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

var getProperties = function(feedId, accessToken, queryString, callback, willDebug, expectedResponse) {
   superagent
         .get(ESDR_FEEDS_API_URL + feedId + "/properties" + queryString)
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

            if (typeof expectedResponse !== 'undefined') {
               res.body.data.should.have.properties(expectedResponse);
            }

            callback();
         });
};

var deletePropertiesForFeed = function(feedId, accessToken, callback, expectedNumPropertiesDeleted) {
   superagent
         .del(ESDR_FEEDS_API_URL + feedId + "/properties")
         .set(createAuthorizationHeader(accessToken))
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

            if (typeof expectedNumPropertiesDeleted !== 'undefined') {
               res.body.data.should.have.property('propertiesDeleted', expectedNumPropertiesDeleted);
            }

            callback();
         });
};

var deletePropertyForFeed = function(feedId, accessToken, key, callback, expectedNumPropertiesDeleted) {
   superagent
         .del(ESDR_FEEDS_API_URL + feedId + "/properties/" + key)
         .set(createAuthorizationHeader(accessToken))
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

            if (typeof expectedNumPropertiesDeleted !== 'undefined') {
               res.body.data.should.have.property('propertiesDeleted', expectedNumPropertiesDeleted);
            }

            callback();
         });
};

describe("REST API", function() {
   var client1 = requireNew('./fixtures/client1.json');
   var client2 = requireNew('./fixtures/client2.json');
   var user1 = requireNew('./fixtures/user1.json');
   var user2 = requireNew('./fixtures/user2.json');
   var user1Client2 = null;
   var user2Client2 = null;
   var product1 = requireNew('./fixtures/product1.json');
   var product2 = requireNew('./fixtures/product2.json');
   var device1 = requireNew('./fixtures/device1.json');
   var device2 = requireNew('./fixtures/device2.json');
   var device3 = requireNew('./fixtures/device3.json');
   var feed1 = requireNew('./fixtures/feed1.json');                        // public,  user 1, product 1, device 1
   var feed2 = requireNew('./fixtures/feed2.json');                        // private, user 1, product 1, device 1
   var feed3 = requireNew('./fixtures/feed3.json');                        // public,  user 2, product 2, device 2
   var feed4 = requireNew('./fixtures/feed4.json');                        // private, user 2, product 2, device 2

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
                  setup.authenticateUserWithClient(user2, client1, done);
               },
               function(done) {
                  // authenticate the same user with a different client
                  user2Client2 = JSON.parse(JSON.stringify(user2));
                  setup.authenticateUserWithClient(user2Client2, client2, done);
               },
               function(done) {
                  product1.creatorUserId = user1.id;
                  setup.createProduct(product1, done);
               },
               function(done) {
                  product2.creatorUserId = user2.id;
                  setup.createProduct(product2, done);
               },
               function(done) {
                  device1.userId = user1.id;
                  device1.productId = product1.id;
                  setup.createDevice(device1, done);
               },
               function(done) {
                  device2.userId = user2.id;
                  device2.productId = product2.id;
                  setup.createDevice(device2, done);
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
                  feed3.userId = user2.id;
                  feed3.deviceId = device2.id;
                  feed3.productId = product2.id;
                  feed3.channelSpecs = product2.defaultChannelSpecs;
                  setup.createFeed(feed3, done);
               },
               function(done) {
                  feed4.userId = user2.id;
                  feed4.deviceId = device2.id;
                  feed4.productId = product2.id;
                  feed4.channelSpecs = product2.defaultChannelSpecs;
                  setup.createFeed(feed4, done);
               }
            ],
            initDone
      );
   });

   describe("Feeds", function() {
      describe("FeedProperties", function() {
         describe("Set Property", function() {

            describe("No Authentication", function() {
               it("Should fail to set a property with no OAuth2 token specified", function(done) {
                  superagent
                        .put(ESDR_FEEDS_API_URL + feed1.id + "/properties/foo")
                        .send(createValue('int', 42))
                        .end(function(err, res) {
                           should.not.exist(err);
                           should.exist(res);

                           res.should.have.property('status', httpStatus.UNAUTHORIZED);

                           done();
                        });
               });
            });   // No Authentication

            describe("OAuth2 Authentication", function() {
               describe("Invalid Authentication", function() {
                  it("Should fail to set a property with an invalid OAuth2 token specified", function(done) {
                     superagent
                           .put(ESDR_FEEDS_API_URL + feed1.id + "/properties/foo")
                           .set(createAuthorizationHeader("bogus"))
                           .send(createValue('int', 42))
                           .end(function(err, res) {
                              should.not.exist(err);
                              should.exist(res);

                              res.should.have.property('status', httpStatus.UNAUTHORIZED);

                              done();
                           });
                  });
                  it("Should fail to set a property with an OAuth2 token for a different user", function(done) {
                     superagent
                           .put(ESDR_FEEDS_API_URL + feed1.id + "/properties/foo")
                           .set(createAuthorizationHeader(user2.accessToken))
                           .send(createValue('int', 42))
                           .end(function(err, res) {
                              should.not.exist(err);
                              should.exist(res);

                              res.should.have.property('status', httpStatus.FORBIDDEN);

                              done();
                           });
                  });
               });   // Invalid Authentication
               describe("Valid Authentication", function() {
                  describe("Success", function() {
                     var testSetProperty = function(test) {
                        it(test.description, function(done) {
                           var feedId = (typeof test.feed === 'function') ? test.feed().id : test.feed.id;

                           setProperty(feedId,
                                       test.accessToken,
                                       test.propertyKey,
                                       test.propertyValue,
                                       function() {
                                          // now try to fetch the property through the API to verify it was set correctly
                                          getProperty(
                                                feedId,
                                                test.accessToken,
                                                test.propertyKey,
                                                function() {
                                                   if (typeof test.additionalTests === 'function') {
                                                      test.additionalTests(done);
                                                   }
                                                   else {
                                                      done();
                                                   }
                                                },
                                                test.willDebug,
                                                test.propertyValue.value
                                          );
                                       },
                                       test.willDebug);
                        });
                     };

                     var createTest = function(description, key, value, type, willDebug) {
                        return {
                           description : description,
                           feed : feed1,
                           accessToken : function() {
                              return user1.accessToken
                           },
                           propertyKey : key,
                           propertyValue : createValue(type, value),
                           willDebug : !!willDebug
                        }
                     };

                     var shapeShifterInt = 42;
                     var shapeShifterDouble = 42.00042;
                     var shapeShifterString = "please to make englishes";
                     var shapeShifterJson = { foo : "bar", isTest : true, num : 3.14159 };
                     var shapeShifterBoolean = true;

                     var shapeshifterTypes = {
                        int : shapeShifterInt,
                        double : shapeShifterDouble,
                        string : shapeShifterString,
                        json : shapeShifterJson,
                        boolean : shapeShifterBoolean
                     };

                     var createTypeSwitchTest = function(fromTypeName, toTypeName) {
                        var propertyValue = {};
                        propertyValue[toTypeName] = shapeshifterTypes[toTypeName];

                        return createTest(
                              "Type switch test: " + fromTypeName + " --> " + toTypeName,
                              'shapeshifter',
                              shapeshifterTypes[toTypeName],
                              toTypeName
                        );
                     };

                     [
                        createTest("Should be able to set an integer property", 'int_1', 42, 'int'),
                        createTest("Should be able to set the same integer property to 0", 'int_1', 0, 'int'),
                        createTest("Should be able to set the same integer property to null", 'int_1', null, 'int'),
                        createTest("Should be able to set the same integer property to a different integer", 'int_1', 343, 'int'),
                        createTest("Should be able to set a different integer property", 'int_2', -98765, 'int'),

                        createTest("Should be able to set a double property", 'double_1', 2.718281828, 'double'),
                        createTest("Should be able to set the same double property to an integer", 'double_1', 12345, 'double'),
                        createTest("Should be able to set the same double property to 0", 'double_1', 0, 'double'),
                        createTest("Should be able to set the same double property to null", 'double_1', null, 'double'),
                        createTest("Should be able to set the same double property to a different double", 'double_1', -123.456789, 'double'),
                        createTest("Should be able to set a different double property", 'double_2', 3.1415926535, 'double'),

                        createTest("Should be able to set a string property", 'string_1', 'hello world', 'string'),
                        createTest("Should be able to set the same string property to the empty string", 'string_1', '', 'string'),
                        createTest("Should be able to set the same string property to null", 'string_1', null, 'string'),
                        createTest("Should be able to set the same string property to a different string", 'string_1', 'hello universe', 'string'),
                        createTest("Should be able to set a different string property", 'string_2', 'please to make englishes', 'string'),

                        createTest("Should be able to set a json property",
                                   'json_1',
                                   {
                                      foo : "bar",
                                      bif : [1, 2, 3],
                                      borf : null,
                                      baz : -234,
                                      bat : 0.00042,
                                      blorp : null
                                   },
                                   'json'),
                        createTest("Should be able to set the same json property to the empty object",
                                   'json_1',
                                   {},
                                   'json'),
                        createTest("Should be able to set the same json property to null",
                                   'json_1',
                                   null,
                                   'json'),
                        createTest("Should be able to set the same json property to a different json",
                                   'json_1',
                                   { a : [9, 8, 7, 6, 5, 4, 3, 2, 1], b : { c : 42, d : 343 }, e : 4242 },
                                   'json'),
                        createTest("Should be able to set a different json property",
                                   'json_2',
                                   { bloop : [4, 5, 6], blorp : { froop : "froppity" } },
                                   'json'),

                        createTest("Should be able to set a boolean property", 'boolean_1', true, 'boolean'),
                        createTest("Should be able to set the same boolean property to null", 'boolean_1', null, 'boolean'),
                        createTest("Should be able to set the same boolean property to a different boolean", 'boolean_1', false, 'boolean'),
                        createTest("Should be able to set a different boolean property", 'boolean_2', true, 'boolean'),

                        createTest(
                              "Should be able to set an integer property (prep for testing switching of types)",
                              'shapeshifter',
                              shapeShifterInt,
                              'int'
                        ),
                        createTypeSwitchTest('int', 'double'),
                        createTypeSwitchTest('double', 'int'),
                        createTypeSwitchTest('int', 'string'),
                        createTypeSwitchTest('string', 'int'),
                        createTypeSwitchTest('int', 'json'),
                        createTypeSwitchTest('json', 'int'),
                        createTypeSwitchTest('int', 'boolean'),
                        createTypeSwitchTest('boolean', 'double'),
                        createTypeSwitchTest('double', 'string'),
                        createTypeSwitchTest('string', 'double'),
                        createTypeSwitchTest('double', 'json'),
                        createTypeSwitchTest('json', 'double'),
                        createTypeSwitchTest('double', 'boolean'),
                        createTypeSwitchTest('boolean', 'string'),
                        createTypeSwitchTest('string', 'json'),
                        createTypeSwitchTest('json', 'string'),
                        createTypeSwitchTest('string', 'boolean'),
                        createTypeSwitchTest('boolean', 'json'),
                        createTypeSwitchTest('json', 'boolean'),
                        createTypeSwitchTest('boolean', 'int'),

                        // test setting prop for same user but diff clients
                        {
                           description : "Should be able to set a property for feed 1 owned by user 1 and client 1 (prep for showing properties are private to feed+user+client)",
                           feed : feed1,
                           accessToken : function() {
                              return user1.accessToken
                           },
                           propertyKey : 'this_is_my_property',
                           propertyValue : createValue('string', 'feed 1 user 1 client 1')
                        },
                        {
                           description : "Should be able to set a property for feed 2 owned by user 1 and client 1",
                           feed : feed2,
                           accessToken : function() {
                              return user1.accessToken
                           },
                           propertyKey : 'this_is_my_property',
                           propertyValue : createValue('string', 'feed 2 user 1 client 1')
                        },
                        {
                           description : "Should be able to set a property for feed 1 owned by user 1 and client 2",
                           feed : feed1,
                           accessToken : function() {
                              return user1Client2.accessToken
                           },
                           propertyKey : 'this_is_my_property',
                           propertyValue : createValue('string', 'feed 1 user 1 client 2')
                        },
                        {
                           description : "Should be able to set a property for feed 2 owned by user 1 and client 2",
                           feed : feed2,
                           accessToken : function() {
                              return user1Client2.accessToken
                           },
                           propertyKey : 'this_is_my_property',
                           propertyValue : createValue('string', 'feed 2 user 1 client 2')
                        },

                        {
                           description : "Should be able to set a property for feed 3 owned by user 2 and client 1",
                           feed : feed3,
                           accessToken : function() {
                              return user2.accessToken
                           },
                           propertyKey : 'this_is_my_property',
                           propertyValue : createValue('string', 'feed 3 user 2 client 1')
                        },
                        {
                           description : "Should be able to set a property for feed 4 owned by user 2 and client 1",
                           feed : feed4,
                           accessToken : function() {
                              return user2.accessToken
                           },
                           propertyKey : 'this_is_my_property',
                           propertyValue : createValue('string', 'feed 4 user 2 client 1')
                        },
                        {
                           description : "Should be able to set a property for feed 3 owned by user 2 and client 2",
                           feed : feed3,
                           accessToken : function() {
                              return user2Client2.accessToken
                           },
                           propertyKey : 'this_is_my_property',
                           propertyValue : createValue('string', 'feed 3 user 2 client 2')
                        },
                        {
                           description : "Should be able to set a property for feed 4 owned by user 2 and client 2",
                           feed : feed4,
                           accessToken : function() {
                              return user2Client2.accessToken
                           },
                           propertyKey : 'this_is_my_property',
                           propertyValue : createValue('string', 'feed 4 user 2 client 2'),
                           additionalTests : function(done) {
                              // now verify the properties
                              var key = 'this_is_my_property';
                              getProperty(feed1.id, user1.accessToken, key, function() {
                                 getProperty(feed2.id, user1.accessToken, key, function() {
                                    getProperty(feed1.id, user1Client2.accessToken, key, function() {
                                       getProperty(feed2.id, user1Client2.accessToken, key, function() {
                                          getProperty(feed3.id, user2.accessToken, key, function() {
                                             getProperty(feed4.id, user2.accessToken, key, function() {
                                                getProperty(feed3.id, user2Client2.accessToken, key, function() {
                                                   getProperty(feed4.id, user2Client2.accessToken, key, function() {
                                                      done();
                                                   }, false, 'feed 4 user 2 client 2');
                                                }, false, 'feed 3 user 2 client 2');
                                             }, false, 'feed 4 user 2 client 1');
                                          }, false, 'feed 3 user 2 client 1');
                                       }, false, 'feed 2 user 1 client 2');
                                    }, false, 'feed 1 user 1 client 2');
                                 }, false, 'feed 2 user 1 client 1');
                              }, false, 'feed 1 user 1 client 1');
                           }
                        }
                     ].forEach(testSetProperty);

                  });   // Success
                  describe("Failure", function() {
                     it("Should fail to set a property for a non-existent feed", function(done) {
                        superagent
                              .put(ESDR_FEEDS_API_URL + BOGUS_FEED_ID + "/properties/foo")
                              .set(createAuthorizationHeader(user1.accessToken))
                              .send(createValue('int', 42))
                              .end(function(err, res) {
                                 should.not.exist(err);
                                 should.exist(res);

                                 res.should.have.property('status', httpStatus.FORBIDDEN);

                                 done();
                              });
                     });

                     var testSetPropertyValidation = function(test) {
                        it(test.description, function(done) {
                           superagent
                                 .put(ESDR_FEEDS_API_URL + test.feed.id + "/properties/" + test.propertyKey)
                                 .set(createAuthorizationHeader(test.accessToken))
                                 .send(test.propertyValue)
                                 .end(function(err, res) {
                                    should.not.exist(err);
                                    should.exist(res);

                                    if (test.willDebug) {
                                       console.log(JSON.stringify(res.body, null, 3));
                                    }

                                    res.should.have.property('status', httpStatus.UNPROCESSABLE_ENTITY);
                                    res.should.have.property('body');
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
                     };

                     var createValidationTest = function(description, key, value, type, expectedValidationItems, willDebug) {
                        return {
                           description : description,
                           feed : feed1,
                           accessToken : function() {
                              return user1.accessToken
                           },
                           propertyKey : key,
                           propertyValue : createValue(type, value),
                           getExpectedValidationItems : function() {
                              return expectedValidationItems;
                           },
                           willDebug : !!willDebug
                        }
                     };

                     var createSimpleValidationTest = function(description, key, value, type, constraintType, testedType, willDebug) {
                        return createValidationTest(description,
                                                    key,
                                                    value,
                                                    type,
                                                    [
                                                       {
                                                          instanceContext : '#/value',
                                                          constraintName : 'type',
                                                          constraintValue : [
                                                             constraintType,
                                                             "null"
                                                          ],
                                                          testedValue : testedType
                                                       }
                                                    ],
                                                    willDebug);
                     };

                     [
                        createSimpleValidationTest("Should fail to set an integer property to a double",
                                                   'bad_int',
                                                   3.1415926535,
                                                   'int',
                                                   'integer',
                                                   'number'),
                        createSimpleValidationTest("Should fail to set an integer property to a string",
                                                   'bad_int',
                                                   '42',
                                                   'int',
                                                   'integer',
                                                   'string'),
                        createSimpleValidationTest("Should fail to set an integer property to an object",
                                                   'bad_int',
                                                   { foo : "bar", baz : 343 },
                                                   'int',
                                                   'integer',
                                                   'object'),
                        createSimpleValidationTest("Should fail to set an integer property to a boolean",
                                                   'bad_int',
                                                   true,
                                                   'int',
                                                   'integer',
                                                   'boolean'),
                        createValidationTest("Should fail to set an integer property to an array",
                                             'bad_int',
                                             [1, 2, 3],
                                             'int',
                                             [
                                                {
                                                   instanceContext : '#/value',
                                                   constraintName : 'type',
                                                   constraintValue : [
                                                      "integer",
                                                      "number",
                                                      "string",
                                                      "object",
                                                      "boolean",
                                                      "null"
                                                   ],
                                                   testedValue : 'array'
                                                }
                                             ]),
                        createSimpleValidationTest("Should fail to set an double property to a string",
                                                   'bad_double',
                                                   '42',
                                                   'double',
                                                   'number',
                                                   'string'),
                        createSimpleValidationTest("Should fail to set an double property to an object",
                                                   'bad_double',
                                                   { foo : "bar", baz : 343 },
                                                   'double',
                                                   'number',
                                                   'object'),
                        createSimpleValidationTest("Should fail to set an double property to a boolean",
                                                   'bad_double',
                                                   true,
                                                   'double',
                                                   'number',
                                                   'boolean'),
                        createValidationTest("Should fail to set an double property to an array",
                                             'bad_double',
                                             [1, 2, 3],
                                             'double',
                                             [
                                                {
                                                   instanceContext : '#/value',
                                                   constraintName : 'type',
                                                   constraintValue : [
                                                      "integer",
                                                      "number",
                                                      "string",
                                                      "object",
                                                      "boolean",
                                                      "null"
                                                   ],
                                                   testedValue : 'array'
                                                }
                                             ]),
                        createSimpleValidationTest("Should fail to set a string property to an integer",
                                                   'bad_string',
                                                   42,
                                                   'string',
                                                   'string',
                                                   'integer'),
                        createSimpleValidationTest("Should fail to set a string property to an double",
                                                   'bad_string',
                                                   42.42,
                                                   'string',
                                                   'string',
                                                   'number'),
                        createSimpleValidationTest("Should fail to set a string property to an object",
                                                   'bad_string',
                                                   { foo : "bar", baz : 343 },
                                                   'string',
                                                   'string',
                                                   'object'),
                        createSimpleValidationTest("Should fail to set a string property to a boolean",
                                                   'bad_string',
                                                   true,
                                                   'string',
                                                   'string',
                                                   'boolean'),
                        createValidationTest("Should fail to set a string property to an array",
                                             'bad_string',
                                             [1, 2, 3],
                                             'string',
                                             [
                                                {
                                                   instanceContext : '#/value',
                                                   constraintName : 'type',
                                                   constraintValue : [
                                                      "integer",
                                                      "number",
                                                      "string",
                                                      "object",
                                                      "boolean",
                                                      "null"
                                                   ],
                                                   testedValue : 'array'
                                                }
                                             ]),

                        createSimpleValidationTest("Should fail to set a json property to an integer",
                                                   'bad_json',
                                                   42,
                                                   'json',
                                                   'object',
                                                   'integer'),
                        createSimpleValidationTest("Should fail to set a json property to an double",
                                                   'bad_json',
                                                   42.42,
                                                   'json',
                                                   'object',
                                                   'number'),
                        createSimpleValidationTest("Should fail to set a json property to a string",
                                                   'bad_json',
                                                   '42',
                                                   'json',
                                                   'object',
                                                   'string'),
                        createSimpleValidationTest("Should fail to set a json property to a boolean",
                                                   'bad_json',
                                                   true,
                                                   'json',
                                                   'object',
                                                   'boolean'),
                        createValidationTest("Should fail to set a json property to an array",
                                             'bad_json',
                                             [1, 2, 3],
                                             'json',
                                             [
                                                {
                                                   instanceContext : '#/value',
                                                   constraintName : 'type',
                                                   constraintValue : [
                                                      "integer",
                                                      "number",
                                                      "string",
                                                      "object",
                                                      "boolean",
                                                      "null"
                                                   ],
                                                   testedValue : 'array'
                                                }
                                             ]),
                        createValidationTest("Should fail to set a property with an invalid key (has a space)",
                                             'bad key',
                                             42,
                                             'int',
                                             [
                                                {
                                                   constraintName : 'pattern',
                                                   instanceContext : '#/key',
                                                   kind : 'StringValidationError'
                                                }
                                             ]),
                        createValidationTest("Should fail to set a property with an invalid key (starts with a number)",
                                             '1bad_key',
                                             42,
                                             'int',
                                             [
                                                {
                                                   constraintName : 'pattern',
                                                   instanceContext : '#/key',
                                                   kind : 'StringValidationError'
                                                }
                                             ]),
                        createValidationTest("Should fail to set a property with an invalid key (starts with an underscore)",
                                             '_bad_key',
                                             42,
                                             'int',
                                             [
                                                {
                                                   constraintName : 'pattern',
                                                   instanceContext : '#/key',
                                                   kind : 'StringValidationError'
                                                }
                                             ]),
                        createValidationTest("Should fail to set a property with an invalid key (too long)",
                                             'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
                                             42,
                                             'int',
                                             [
                                                {
                                                   constraintName : 'maxLength',
                                                   instanceContext : '#/key',
                                                   kind : 'StringValidationError'
                                                }
                                             ]),
                        createValidationTest("Should fail to set a string property with a value that is too long",
                                             'long_string',
                                             'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
                                             'string',
                                             [
                                                {
                                                   constraintName : 'maxLength',
                                                   instanceContext : '#/value',
                                                   kind : 'StringValidationError'
                                                }
                                             ])
                     ].forEach(testSetPropertyValidation);

                  });   // Failure
               });   // Valid Authentication
            });   // OAuth2 Authentication
         });   // Set Property

         describe("Get and Delete", function() {

            var propertiesByUserIdFeedIdAndAccessToken = {};

            var getPropertiesForFeed = function(userId, feedId, accessToken, done) {
               var expectedProperties = {};
               for (var key in propertiesByUserIdFeedIdAndAccessToken[userId][feedId][accessToken]) {
                  expectedProperties[key] = propertiesByUserIdFeedIdAndAccessToken[userId][feedId][accessToken][key].value;
               }
               getProperties(
                     feedId,
                     accessToken,
                     "",
                     done,
                     false,
                     expectedProperties
               );
            };

            before(function(initDone) {
               propertiesByUserIdFeedIdAndAccessToken[user1.id] = {};
               propertiesByUserIdFeedIdAndAccessToken[user1.id][feed1.id] = {};
               propertiesByUserIdFeedIdAndAccessToken[user1.id][feed2.id] = {};
               propertiesByUserIdFeedIdAndAccessToken[user1.id][feed1.id][user1.accessToken] = {
                  'prop1' : createValue('int', 123),
                  'prop2' : createValue('double', 12.3),
                  'prop3' : createValue('string', 'this is user1Feed1Client1 prop 3'),
                  'prop4' : createValue('json', { thing : 1, other : [1, 2, 3] }),
                  'prop5' : createValue('boolean', true),
                  'user1Feed1Client1Prop' : createValue('string', 'user1Feed1Client1Prop value')
               };
               propertiesByUserIdFeedIdAndAccessToken[user1Client2.id][feed1.id][user1Client2.accessToken] = {
                  'prop1' : createValue('int', 456),
                  'prop2' : createValue('double', 45.6),
                  'prop3' : createValue('string', 'this is user1Feed1Client2 prop 3'),
                  'prop4' : createValue('json', { thing : 2, other : [4, 5, 6] }),
                  'prop5' : createValue('boolean', false),
                  'user1Feed1Client2Prop' : createValue('string', 'user1Feed1Client2Prop value')
               };
               propertiesByUserIdFeedIdAndAccessToken[user1.id][feed2.id][user1.accessToken] = {
                  'prop1' : createValue('int', 1230),
                  'prop2' : createValue('double', 120.3),
                  'prop3' : createValue('string', 'this is user1Feed2Client1 prop 3'),
                  'prop4' : createValue('json', { thing : 10, other : [10, 20, 30] }),
                  'prop5' : createValue('boolean', true),
                  'user1Feed2Client1Prop' : createValue('string', 'user1Feed2Client1Prop value')
               };
               propertiesByUserIdFeedIdAndAccessToken[user1Client2.id][feed2.id][user1Client2.accessToken] = {
                  'prop1' : createValue('int', 4560),
                  'prop2' : createValue('double', 450.6),
                  'prop3' : createValue('string', 'this is user1Feed2Client2 prop 3'),
                  'prop4' : createValue('json', { thing : 20, other : [40, 50, 60] }),
                  'prop5' : createValue('boolean', false),
                  'user1Feed2Client2Prop' : createValue('string', 'user1Feed2Client2Prop value')
               };

               propertiesByUserIdFeedIdAndAccessToken[user2.id] = {};
               propertiesByUserIdFeedIdAndAccessToken[user2.id][feed3.id] = {};
               propertiesByUserIdFeedIdAndAccessToken[user2.id][feed4.id] = {};
               propertiesByUserIdFeedIdAndAccessToken[user2.id][feed3.id][user2.accessToken] = {
                  'prop1' : createValue('int', 789),
                  'prop2' : createValue('double', 78.9),
                  'prop3' : createValue('string', 'this is user2Feed3Client1 prop 3'),
                  'prop4' : createValue('json', { thing : 3, other : [7, 8, 9] }),
                  'prop5' : createValue('boolean', true),
                  'user2Feed3Client1Prop' : createValue('string', 'user2Feed3Client1Prop value')
               };
               propertiesByUserIdFeedIdAndAccessToken[user2Client2.id][feed3.id][user2Client2.accessToken] = {
                  'prop1' : createValue('int', 112233),
                  'prop2' : createValue('double', -1.12233),
                  'prop3' : createValue('string', 'this is user2Feed3Client2 prop 3'),
                  'prop4' : createValue('json', { thing : 4, other : [11, 22, 33] }),
                  'prop5' : createValue('boolean', false),
                  'user2Feed3Client2Prop' : createValue('string', 'user2Feed3Client2Prop value')
               };
               propertiesByUserIdFeedIdAndAccessToken[user2.id][feed4.id][user2.accessToken] = {
                  'prop1' : createValue('int', 7890),
                  'prop2' : createValue('double', 780.9),
                  'prop3' : createValue('string', 'this is user2Feed4Client1 prop 3'),
                  'prop4' : createValue('json', { thing : 30, other : [70, 80, 90] }),
                  'prop5' : createValue('boolean', true),
                  'user2Feed4Client1Prop' : createValue('string', 'user2Feed4Client1Prop value')
               };
               propertiesByUserIdFeedIdAndAccessToken[user2Client2.id][feed4.id][user2Client2.accessToken] = {
                  'prop1' : createValue('int', 1122330),
                  'prop2' : createValue('double', -10.12233),
                  'prop3' : createValue('string', 'this is user2Feed4Client2 prop 3'),
                  'prop4' : createValue('json', { thing : 40, other : [110, 220, 330] }),
                  'prop5' : createValue('boolean', false),
                  'user2Feed4Client2Prop' : createValue('string', 'user2Feed4Client2Prop value')
               };

               var createCommand = function(user, feed, key, value) {
                  commands.push(function(done) {
                     setProperty(feed.id, user.accessToken, key, value, done);
                  });
               };
               var createCommandsForUserAndFeed = function(user, feed) {
                  // start by creating a command to delete this feed's properties
                  commands.push(function(done) {
                     deletePropertiesForFeed(feed.id, user.accessToken, done);
                  });

                  // now add commands to create the above properties for this user
                  var props = propertiesByUserIdFeedIdAndAccessToken[user.id][feed.id][user.accessToken];
                  Object.keys(props).forEach(function(key) {
                     var val = props[key];
                     createCommand(user, feed, key, val)
                  });
               };

               var commands = [];
               createCommandsForUserAndFeed(user1, feed1);
               createCommandsForUserAndFeed(user1, feed2);
               createCommandsForUserAndFeed(user1Client2, feed1);
               createCommandsForUserAndFeed(user1Client2, feed2);
               createCommandsForUserAndFeed(user2, feed3);
               createCommandsForUserAndFeed(user2, feed4);
               createCommandsForUserAndFeed(user2Client2, feed3);
               createCommandsForUserAndFeed(user2Client2, feed4);

               flow.series(commands, initDone);
            });

            describe("Get", function() {
               describe("Get Property", function() {
                  describe("No Authentication", function() {
                     it("Should fail to get a property with no OAuth2 token specified", function(done) {
                        superagent
                              .get(ESDR_FEEDS_API_URL + feed1.id + "/properties/prop1")
                              .end(function(err, res) {
                                 should.not.exist(err);
                                 should.exist(res);

                                 res.should.have.property('status', httpStatus.UNAUTHORIZED);

                                 done();
                              });
                     });
                  });   // No Authentication

                  describe("OAuth2 Authentication", function() {
                     describe("Invalid Authentication", function() {
                        it("Should fail to get a property with an invalid OAuth2 token specified", function(done) {
                           superagent
                                 .get(ESDR_FEEDS_API_URL + feed1.id + "/properties/prop1")
                                 .set(createAuthorizationHeader("bogus"))
                                 .end(function(err, res) {
                                    should.not.exist(err);
                                    should.exist(res);

                                    res.should.have.property('status', httpStatus.UNAUTHORIZED);

                                    done();
                                 });
                        });
                     });   // Invalid Authentication

                     describe("Valid Authentication", function() {
                        describe("Success", function() {
                           var getExistingProperty = function(user, feed, key, done) {
                              getProperty(feed.id,
                                          user.accessToken,
                                          key,
                                          done,
                                          false,
                                          propertiesByUserIdFeedIdAndAccessToken[user.id][feed.id][user.accessToken][key].value);
                           };

                           it("Should be able to get prop1 for user 1 feed 1 client 1", function(done) {
                              getExistingProperty(user1, feed1, 'prop1', done);
                           });
                           it("Should be able to get prop2 for user 1 feed 1 client 1", function(done) {
                              getExistingProperty(user1, feed1, 'prop2', done);
                           });
                           it("Should be able to get prop3 for user 1 feed 1 client 1", function(done) {
                              getExistingProperty(user1, feed1, 'prop3', done);
                           });
                           it("Should be able to get prop4 for user 1 feed 1 client 1", function(done) {
                              getExistingProperty(user1, feed1, 'prop4', done);
                           });
                           it("Should be able to get prop5 for user 1 feed 1 client 1", function(done) {
                              getExistingProperty(user1, feed1, 'prop5', done);
                           });
                           it("Should be able to get user1Client1Prop for user 1 feed 1 client 1", function(done) {
                              getExistingProperty(user1, feed1, 'user1Feed1Client1Prop', done);
                           });

                           it("Should be able to get prop1 for user 1 feed 2 client 1", function(done) {
                              getExistingProperty(user1, feed2, 'prop1', done);
                           });
                           it("Should be able to get prop2 for user 1 feed 2 client 1", function(done) {
                              getExistingProperty(user1, feed2, 'prop2', done);
                           });
                           it("Should be able to get prop3 for user 1 feed 2 client 1", function(done) {
                              getExistingProperty(user1, feed2, 'prop3', done);
                           });
                           it("Should be able to get prop4 for user 1 feed 2 client 1", function(done) {
                              getExistingProperty(user1, feed2, 'prop4', done);
                           });
                           it("Should be able to get prop5 for user 1 feed 2 client 1", function(done) {
                              getExistingProperty(user1, feed2, 'prop5', done);
                           });
                           it("Should be able to get user1Client1Prop for user 1 feed 2 client 1", function(done) {
                              getExistingProperty(user1, feed2, 'user1Feed2Client1Prop', done);
                           });

                           it("Should be able to get prop1 for user 1 feed 1 client 2", function(done) {
                              getExistingProperty(user1Client2, feed1, 'prop1', done);
                           });
                           it("Should be able to get prop2 for user 1 feed 1 client 2", function(done) {
                              getExistingProperty(user1Client2, feed1, 'prop2', done);
                           });
                           it("Should be able to get prop3 for user 1 feed 1 client 2", function(done) {
                              getExistingProperty(user1Client2, feed1, 'prop3', done);
                           });
                           it("Should be able to get prop4 for user 1 feed 1 client 2", function(done) {
                              getExistingProperty(user1Client2, feed1, 'prop4', done);
                           });
                           it("Should be able to get prop5 for user 1 feed 1 client 2", function(done) {
                              getExistingProperty(user1Client2, feed1, 'prop5', done);
                           });
                           it("Should be able to get user1Client1Prop for user 1 feed 1 client 2", function(done) {
                              getExistingProperty(user1Client2, feed1, 'user1Feed1Client2Prop', done);
                           });

                           it("Should be able to get prop1 for user 1 feed 2 client 2", function(done) {
                              getExistingProperty(user1Client2, feed2, 'prop1', done);
                           });
                           it("Should be able to get prop2 for user 1 feed 2 client 2", function(done) {
                              getExistingProperty(user1Client2, feed2, 'prop2', done);
                           });
                           it("Should be able to get prop3 for user 1 feed 2 client 2", function(done) {
                              getExistingProperty(user1Client2, feed2, 'prop3', done);
                           });
                           it("Should be able to get prop4 for user 1 feed 2 client 2", function(done) {
                              getExistingProperty(user1Client2, feed2, 'prop4', done);
                           });
                           it("Should be able to get prop5 for user 1 feed 2 client 2", function(done) {
                              getExistingProperty(user1Client2, feed2, 'prop5', done);
                           });
                           it("Should be able to get user1Client1Prop for user 1 feed 2 client 2", function(done) {
                              getExistingProperty(user1Client2, feed2, 'user1Feed2Client2Prop', done);
                           });

                           // ----------------------------------------------------------------
                           it("Should be able to get prop1 for user 2 feed 3 client 1", function(done) {
                              getExistingProperty(user2, feed3, 'prop1', done);
                           });
                           it("Should be able to get prop2 for user 2 feed 3 client 1", function(done) {
                              getExistingProperty(user2, feed3, 'prop2', done);
                           });
                           it("Should be able to get prop3 for user 2 feed 3 client 1", function(done) {
                              getExistingProperty(user2, feed3, 'prop3', done);
                           });
                           it("Should be able to get prop4 for user 2 feed 3 client 1", function(done) {
                              getExistingProperty(user2, feed3, 'prop4', done);
                           });
                           it("Should be able to get prop5 for user 2 feed 3 client 1", function(done) {
                              getExistingProperty(user2, feed3, 'prop5', done);
                           });
                           it("Should be able to get user2Client1Prop for user 2 feed 3 client 1", function(done) {
                              getExistingProperty(user2, feed3, 'user2Feed3Client1Prop', done);
                           });

                           it("Should be able to get prop1 for user 2 feed 4 client 1", function(done) {
                              getExistingProperty(user2, feed4, 'prop1', done);
                           });
                           it("Should be able to get prop2 for user 2 feed 4 client 1", function(done) {
                              getExistingProperty(user2, feed4, 'prop2', done);
                           });
                           it("Should be able to get prop3 for user 2 feed 4 client 1", function(done) {
                              getExistingProperty(user2, feed4, 'prop3', done);
                           });
                           it("Should be able to get prop4 for user 2 feed 4 client 1", function(done) {
                              getExistingProperty(user2, feed4, 'prop4', done);
                           });
                           it("Should be able to get prop5 for user 2 feed 4 client 1", function(done) {
                              getExistingProperty(user2, feed4, 'prop5', done);
                           });
                           it("Should be able to get user2Client1Prop for user 2 feed 4 client 1", function(done) {
                              getExistingProperty(user2, feed4, 'user2Feed4Client1Prop', done);
                           });

                           it("Should be able to get prop1 for user 2 feed 3 client 2", function(done) {
                              getExistingProperty(user2Client2, feed3, 'prop1', done);
                           });
                           it("Should be able to get prop2 for user 2 feed 3 client 2", function(done) {
                              getExistingProperty(user2Client2, feed3, 'prop2', done);
                           });
                           it("Should be able to get prop3 for user 2 feed 3 client 2", function(done) {
                              getExistingProperty(user2Client2, feed3, 'prop3', done);
                           });
                           it("Should be able to get prop4 for user 2 feed 3 client 2", function(done) {
                              getExistingProperty(user2Client2, feed3, 'prop4', done);
                           });
                           it("Should be able to get prop5 for user 2 feed 3 client 2", function(done) {
                              getExistingProperty(user2Client2, feed3, 'prop5', done);
                           });
                           it("Should be able to get user2Client1Prop for user 2 feed 3 client 2", function(done) {
                              getExistingProperty(user2Client2, feed3, 'user2Feed3Client2Prop', done);
                           });

                           it("Should be able to get prop1 for user 2 feed 4 client 2", function(done) {
                              getExistingProperty(user2Client2, feed4, 'prop1', done);
                           });
                           it("Should be able to get prop2 for user 2 feed 4 client 2", function(done) {
                              getExistingProperty(user2Client2, feed4, 'prop2', done);
                           });
                           it("Should be able to get prop3 for user 2 feed 4 client 2", function(done) {
                              getExistingProperty(user2Client2, feed4, 'prop3', done);
                           });
                           it("Should be able to get prop4 for user 2 feed 4 client 2", function(done) {
                              getExistingProperty(user2Client2, feed4, 'prop4', done);
                           });
                           it("Should be able to get prop5 for user 2 feed 4 client 2", function(done) {
                              getExistingProperty(user2Client2, feed4, 'prop5', done);
                           });
                           it("Should be able to get user2Client1Prop for user 2 feed 4 client 2", function(done) {
                              getExistingProperty(user2Client2, feed4, 'user2Feed4Client2Prop', done);
                           });
                           // ----------------------------------------------------------------

                        });   // Success
                        describe("Failure", function() {
                           it("Should fail to get a property for a non-existent feed", function(done) {
                              superagent
                                    .get(ESDR_FEEDS_API_URL + BOGUS_FEED_ID + "/properties/foo")
                                    .set(createAuthorizationHeader(user1.accessToken))
                                    .end(function(err, res) {
                                       should.not.exist(err);
                                       should.exist(res);

                                       res.should.have.property('status', httpStatus.FORBIDDEN);

                                       done();
                                    });
                           });
                           it("Should fail to get a property with a valid OAuth2 token, but for the wrong user", function(done) {
                              superagent
                                    .get(ESDR_FEEDS_API_URL + feed1.id + "/properties/prop1")
                                    .set(createAuthorizationHeader(user2.accessToken))
                                    .end(function(err, res) {
                                       should.not.exist(err);
                                       should.exist(res);

                                       res.should.have.property('status', httpStatus.FORBIDDEN);

                                       done();
                                    });
                           });
                           it("Should fail to get a property with a valid OAuth2 token for the same user, but a different client", function(done) {
                              superagent
                                    .get(ESDR_FEEDS_API_URL + feed1.id + "/properties/user1Feed1Client1Prop")
                                    .set(createAuthorizationHeader(user1Client2.accessToken))
                                    .end(function(err, res) {
                                       should.not.exist(err);
                                       should.exist(res);

                                       res.should.have.property('status', httpStatus.NOT_FOUND);

                                       done();
                                    });
                           });
                           it("Should fail to get a non-existent property", function(done) {
                              superagent
                                    .get(ESDR_FEEDS_API_URL + feed1.id + "/properties/no_such_property")
                                    .set(createAuthorizationHeader(user1.accessToken))
                                    .end(function(err, res) {
                                       should.not.exist(err);
                                       should.exist(res);

                                       res.should.have.property('status', httpStatus.NOT_FOUND);

                                       done();
                                    });
                           });
                           it("Should fail to get a property with an invalid key", function(done) {
                              superagent
                                    .get(ESDR_FEEDS_API_URL + feed3.id + "/properties/bad-key")
                                    .set(createAuthorizationHeader(user2.accessToken))
                                    .end(function(err, res) {
                                       should.not.exist(err);
                                       should.exist(res);

                                       res.should.have.property('status', httpStatus.UNPROCESSABLE_ENTITY);
                                       res.should.have.property('body');
                                       res.body.should.have.properties({
                                                                          code : httpStatus.UNPROCESSABLE_ENTITY,
                                                                          status : 'error'
                                                                       });

                                       var expectedValidationItems = [{
                                          constraintName : 'pattern',
                                          instanceContext : '#/key',
                                          kind : 'StringValidationError'
                                       }];
                                       res.body.should.have.property('data');
                                       res.body.data.should.have.length(expectedValidationItems.length);
                                       res.body.data.forEach(function(validationItem, index) {
                                          validationItem.should.have.properties(expectedValidationItems[index]);
                                       });

                                       done();
                                    });
                           });
                        });   // Failure
                     });   // Valid Authentication
                  });   // OAuth2 Authentication
               });   // Get Property

               describe("Get Properties", function() {
                  describe("No Authentication", function() {
                     it("Should fail to get properties with no OAuth2 token specified", function(done) {
                        superagent
                              .get(ESDR_FEEDS_API_URL + feed1.id + "/properties")
                              .end(function(err, res) {
                                 should.not.exist(err);
                                 should.exist(res);

                                 res.should.have.property('status', httpStatus.UNAUTHORIZED);

                                 done();
                              });
                     });
                  });   // No Authentication

                  describe("OAuth2 Authentication", function() {
                     describe("Invalid Authentication", function() {
                        it("Should fail to get properties with an invalid OAuth2 token specified", function(done) {
                           superagent
                                 .get(ESDR_FEEDS_API_URL + feed1.id + "/properties")
                                 .set(createAuthorizationHeader("bogus"))
                                 .end(function(err, res) {
                                    should.not.exist(err);
                                    should.exist(res);

                                    res.should.have.property('status', httpStatus.UNAUTHORIZED);

                                    done();
                                 });
                        });
                     });   // Invalid Authentication

                     describe("Valid Authentication", function() {
                        describe("Success", function() {
                           it("Should be able to get properties for user 1 feed 1 client 1", function(done) {
                              getPropertiesForFeed(user1.id, feed1.id, user1.accessToken, done);
                           });
                           it("Should be able to get properties for user 1 feed 2 client 1", function(done) {
                              getPropertiesForFeed(user1.id, feed2.id, user1.accessToken, done);
                           });
                           it("Should be able to get properties for user 1 feed 1 client 2", function(done) {
                              getPropertiesForFeed(user1Client2.id, feed1.id, user1Client2.accessToken, done);
                           });
                           it("Should be able to get properties for user 1 feed 2 client 2", function(done) {
                              getPropertiesForFeed(user1Client2.id, feed2.id, user1Client2.accessToken, done);
                           });

                           it("Should be able to get properties for user 2 feed 3 client 1", function(done) {
                              getPropertiesForFeed(user2.id, feed3.id, user2.accessToken, done);
                           });
                           it("Should be able to get properties for user 2 feed 4 client 1", function(done) {
                              getPropertiesForFeed(user2.id, feed4.id, user2.accessToken, done);
                           });
                           it("Should be able to get properties for user 2 feed 3 client 2", function(done) {
                              getPropertiesForFeed(user2Client2.id, feed3.id, user2Client2.accessToken, done);
                           });
                           it("Should be able to get properties for user 2 feed 4 client 2", function(done) {
                              getPropertiesForFeed(user2Client2.id, feed4.id, user2Client2.accessToken, done);
                           });

                           it("Should be able to use query string to select only properties of type string", function(done) {
                              getProperties(
                                    feed1.id,
                                    user1.accessToken,
                                    "?where=type=string",
                                    done,
                                    false,
                                    {
                                       prop3 : 'this is user1Feed1Client1 prop 3',
                                       user1Feed1Client1Prop : 'user1Feed1Client1Prop value'
                                    }
                              );
                           });
                           it("Should be able to use query string to select only properties of type string or int", function(done) {
                              getProperties(
                                    feed1.id,
                                    user1.accessToken,
                                    "?whereOr=type=string,type=int",
                                    done,
                                    false,
                                    {
                                       prop3 : 'this is user1Feed1Client1 prop 3',
                                       user1Feed1Client1Prop : 'user1Feed1Client1Prop value',
                                       prop1 : 123
                                    }
                              );
                           });
                           it("Should be able to use query string to select only specific property keys", function(done) {
                              getProperties(
                                    feed3.id,
                                    user2.accessToken,
                                    "?whereOr=key=prop2,key=prop5",
                                    done,
                                    false,
                                    {
                                       prop2 : 78.9,
                                       prop5 : true
                                    }
                              );
                           });
                           it("Should be able to use query string to select only specific property keys or keys of type json", function(done) {
                              getProperties(
                                    feed3.id,
                                    user2Client2.accessToken,
                                    "?whereOr=key=prop2,key=prop5,type=json",
                                    done,
                                    false,
                                    {
                                       prop2 : -1.12233,
                                       prop4 : { thing : 4, other : [11, 22, 33] },
                                       prop5 : false
                                    }
                              );
                           });

                        });   // Success
                        describe("Failure", function() {
                           it("Should fail to get properties for a non-existent feed", function(done) {
                              superagent
                                    .get(ESDR_FEEDS_API_URL + BOGUS_FEED_ID + "/properties")
                                    .set(createAuthorizationHeader(user1.accessToken))
                                    .end(function(err, res) {
                                       should.not.exist(err);
                                       should.exist(res);

                                       res.should.have.property('status', httpStatus.FORBIDDEN);

                                       done();
                                    });
                           });
                           it("Should fail to get properties with a valid OAuth2 token, but for the wrong user", function(done) {
                              superagent
                                    .get(ESDR_FEEDS_API_URL + feed1.id + "/properties")
                                    .set(createAuthorizationHeader(user2.accessToken))
                                    .end(function(err, res) {
                                       should.not.exist(err);
                                       should.exist(res);

                                       res.should.have.property('status', httpStatus.FORBIDDEN);

                                       done();
                                    });
                           });
                        });   // Failure
                     });   // Valid Authentication
                  });   // OAuth2 Authentication
               });   // Get Properties
            });   // Get

            describe("Delete", function() {
               describe("Delete Properties", function() {
                  describe("No Authentication", function() {
                     it("Should fail to delete properties with no OAuth2 token specified", function(done) {
                        superagent
                              .del(ESDR_FEEDS_API_URL + feed1.id + "/properties")
                              .end(function(err, res) {
                                 should.not.exist(err);
                                 should.exist(res);

                                 res.should.have.property('status', httpStatus.UNAUTHORIZED);

                                 done();
                              });
                     });
                  });   // No Authentication

                  describe("OAuth2 Authentication", function() {
                     describe("Invalid Authentication", function() {
                        it("Should fail to delete properties with an invalid OAuth2 token specified", function(done) {
                           superagent
                                 .del(ESDR_FEEDS_API_URL + feed1.id + "/properties")
                                 .set(createAuthorizationHeader("bogus"))
                                 .end(function(err, res) {
                                    should.not.exist(err);
                                    should.exist(res);

                                    res.should.have.property('status', httpStatus.UNAUTHORIZED);

                                    done();
                                 });
                        });
                     });   // Invalid Authentication

                     describe("Valid Authentication", function() {
                        describe("Success", function() {
                           it("Should be able to delete properties for user 1 feed 1 client 1", function(done) {
                              deletePropertiesForFeed(
                                    feed1.id,
                                    user1.accessToken,
                                    done,
                                    Object.keys(propertiesByUserIdFeedIdAndAccessToken[user1.id][feed1.id][user1.accessToken]).length
                              );
                           });
                           it("Should be able to delete properties again for user 1 feed 1 client 1, without error", function(done) {
                              deletePropertiesForFeed(
                                    feed1.id,
                                    user1.accessToken,
                                    function() {
                                       // verify there are now no properties for this user
                                       getProperties(
                                             feed1.id,
                                             user1.accessToken,
                                             '',
                                             done,
                                             false,
                                             {}
                                       );
                                    },
                                    0  // expect there to be 0 properties deleted since we just deleted them in the previous test
                              );
                           });
                           it("Verify that deleting one user's feed properties shouldn't affect any other user's feed properties", function(done) {
                              // verify that other user properties are untouched
                              getPropertiesForFeed(
                                    user1Client2.id,
                                    feed1.id,
                                    user1Client2.accessToken,
                                    function() {
                                       getPropertiesForFeed(
                                             user1.id,
                                             feed2.id,
                                             user1.accessToken,
                                             function() {
                                                getPropertiesForFeed(
                                                      user1Client2.id,
                                                      feed2.id,
                                                      user1Client2.accessToken,
                                                      function() {
                                                         getPropertiesForFeed(
                                                               user2.id,
                                                               feed3.id,
                                                               user2.accessToken,
                                                               function() {
                                                                  getPropertiesForFeed(
                                                                        user2Client2.id,
                                                                        feed3.id,
                                                                        user2Client2.accessToken,
                                                                        function() {
                                                                           getPropertiesForFeed(
                                                                                 user2.id,
                                                                                 feed4.id,
                                                                                 user2.accessToken,
                                                                                 function() {
                                                                                    getPropertiesForFeed(
                                                                                          user2Client2.id,
                                                                                          feed4.id,
                                                                                          user2Client2.accessToken,
                                                                                          done
                                                                                    );
                                                                                 }
                                                                           );
                                                                        }
                                                                  );
                                                               }
                                                         );
                                                      }
                                                );
                                             }
                                       );
                                    }
                              );
                           });

                        });   // Success
                        describe("Failure", function() {
                           it("Should fail to delete properties for a non-existent feed", function(done) {
                              superagent
                                    .del(ESDR_FEEDS_API_URL + BOGUS_FEED_ID + "/properties")
                                    .set(createAuthorizationHeader(user1.accessToken))
                                    .end(function(err, res) {
                                       should.not.exist(err);
                                       should.exist(res);

                                       res.should.have.property('status', httpStatus.FORBIDDEN);

                                       done();
                                    });
                           });
                           it("Should fail to delete properties with a valid OAuth2 token, but for the wrong user", function(done) {
                              superagent
                                    .del(ESDR_FEEDS_API_URL + feed1.id + "/properties")
                                    .set(createAuthorizationHeader(user2.accessToken))
                                    .end(function(err, res) {
                                       should.not.exist(err);
                                       should.exist(res);

                                       res.should.have.property('status', httpStatus.FORBIDDEN);

                                       done();
                                    });
                           });
                        });   // Failure
                     });   // Valid Authentication
                  });   // OAuth2 Authentication
               });   // Delete Properties

               describe("Delete Property", function() {
                  describe("No Authentication", function() {
                     it("Should fail to delete a property with no OAuth2 token specified", function(done) {
                        superagent
                              .del(ESDR_FEEDS_API_URL + feed3.id + "/properties/prop1")
                              .end(function(err, res) {
                                 should.not.exist(err);
                                 should.exist(res);

                                 res.should.have.property('status', httpStatus.UNAUTHORIZED);

                                 done();
                              });
                     });
                  });   // No Authentication

                  describe("OAuth2 Authentication", function() {
                     describe("Invalid Authentication", function() {
                        it("Should fail to delete a property with an invalid OAuth2 token specified", function(done) {
                           superagent
                                 .del(ESDR_FEEDS_API_URL + feed3.id + "/properties/prop1")
                                 .set(createAuthorizationHeader("bogus"))
                                 .end(function(err, res) {
                                    should.not.exist(err);
                                    should.exist(res);

                                    res.should.have.property('status', httpStatus.UNAUTHORIZED);

                                    done();
                                 });
                        });
                     });   // Invalid Authentication

                     describe("Valid Authentication", function() {
                        describe("Success", function() {
                           var verifyPropertyIsDeleted = function(feedId, accessToken, key, done) {
                              superagent
                                    .get(ESDR_FEEDS_API_URL + feedId + "/properties/" + key)
                                    .set(createAuthorizationHeader(accessToken))
                                    .end(function(err, res) {
                                       should.not.exist(err);
                                       should.exist(res);

                                       res.should.have.property('status', httpStatus.NOT_FOUND);
                                       res.should.have.property('body');
                                       res.body.should.have.properties({
                                                                          code : httpStatus.NOT_FOUND,
                                                                          status : 'error'
                                                                       });
                                       res.body.should.have.property('data', null);

                                       done();
                                    });
                           };
                           it("Should not error when asked to delete a non-existent property", function(done) {
                              deletePropertyForFeed(feed3.id, user2.accessToken, 'this_prop_does_not_exist', done, 0);
                           });
                           it("Should be able to delete prop1 for user 2 feed 3 client 1", function(done) {
                              deletePropertyForFeed(feed3.id, user2.accessToken, 'prop1', done, 1);
                           });
                           it("The property prop1 for user 2 feed 3 client 1 should no longer exist", function(done) {
                              verifyPropertyIsDeleted(feed3.id, user2.accessToken, 'prop1', done);
                           });

                           it("Should be able to delete prop2 for user 2 feed 3 client 1", function(done) {
                              deletePropertyForFeed(feed3.id, user2.accessToken, 'prop2', done, 1);
                           });
                           it("The property prop2 for user 2 feed 3 client 1 should no longer exist", function(done) {
                              verifyPropertyIsDeleted(feed3.id, user2.accessToken, 'prop2', done);
                           });
                           it("Should be able to delete prop3 for user 2 feed 3 client 1", function(done) {
                              deletePropertyForFeed(feed3.id, user2.accessToken, 'prop3', done, 1);
                           });
                           it("The property prop3 for user 2 feed 3 client 1 should no longer exist", function(done) {
                              verifyPropertyIsDeleted(feed3.id, user2.accessToken, 'prop3', done);
                           });
                           it("Should be able to delete prop4 for user 2 feed 3 client 1", function(done) {
                              deletePropertyForFeed(feed3.id, user2.accessToken, 'prop4', done, 1);
                           });
                           it("The property prop4 for user 2 feed 3 client 1 should no longer exist", function(done) {
                              verifyPropertyIsDeleted(feed3.id, user2.accessToken, 'prop4', done);
                           });
                           it("Should be able to delete prop5 for user 2 feed 3 client 1", function(done) {
                              deletePropertyForFeed(feed3.id, user2.accessToken, 'prop5', done, 1);
                           });
                           it("The property prop5 for user 2 feed 3 client 1 should no longer exist", function(done) {
                              verifyPropertyIsDeleted(feed3.id, user2.accessToken, 'prop5', done);
                           });
                           it("Should be able to delete user2Feed3Client1Prop for user 2 feed 3 client 1", function(done) {
                              deletePropertyForFeed(feed3.id, user2.accessToken, 'user2Feed3Client1Prop', done, 1);
                           });
                           it("The property user2Feed3Client1Prop for user 2 feed 3 client 1 should no longer exist", function(done) {
                              verifyPropertyIsDeleted(feed3.id, user2.accessToken, 'user2Feed3Client1Prop', done);
                           });
                           it("Verify user 2 feed 3 client 1 has no properties", function(done) {
                              getProperties(feed3.id, user2.accessToken, '', done, false, {});
                           });

                        });   // Success
                        describe("Failure", function() {
                           it("Should fail to delete a property for a non-existent feed", function(done) {
                              superagent
                                    .del(ESDR_FEEDS_API_URL + BOGUS_FEED_ID + "/properties/foo")
                                    .set(createAuthorizationHeader(user1.accessToken))
                                    .end(function(err, res) {
                                       should.not.exist(err);
                                       should.exist(res);

                                       res.should.have.property('status', httpStatus.FORBIDDEN);

                                       done();
                                    });
                           });
                           it("Should fail to delete a property with a valid OAuth2 token, but for the wrong user", function(done) {
                              superagent
                                    .del(ESDR_FEEDS_API_URL + feed2.id + "/properties/prop1")
                                    .set(createAuthorizationHeader(user2.accessToken))
                                    .end(function(err, res) {
                                       should.not.exist(err);
                                       should.exist(res);

                                       res.should.have.property('status', httpStatus.FORBIDDEN);

                                       done();
                                    });
                           });
                           it("Should fail to delete a property with an invalid key", function(done) {
                              superagent
                                    .del(ESDR_FEEDS_API_URL + feed3.id + "/properties/bad-key")
                                    .set(createAuthorizationHeader(user2.accessToken))
                                    .end(function(err, res) {
                                       should.not.exist(err);
                                       should.exist(res);

                                       res.should.have.property('status', httpStatus.UNPROCESSABLE_ENTITY);
                                       res.should.have.property('body');
                                       res.body.should.have.properties({
                                                                          code : httpStatus.UNPROCESSABLE_ENTITY,
                                                                          status : 'error'
                                                                       });

                                       var expectedValidationItems = [{
                                          constraintName : 'pattern',
                                          instanceContext : '#/key',
                                          kind : 'StringValidationError'
                                       }];
                                       res.body.should.have.property('data');
                                       res.body.data.should.have.length(expectedValidationItems.length);
                                       res.body.data.forEach(function(validationItem, index) {
                                          validationItem.should.have.properties(expectedValidationItems[index]);
                                       });

                                       done();
                                    });
                           });

                        });   // Failure
                     });   // Valid Authentication
                  });   // OAuth2 Authentication
               });   // Delete Property
            });   // Delete
         });   // Get and Delete
      });   // Properties
   });   // Feeds
});   // REST API

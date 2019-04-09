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
const ESDR_DEVICES_API_URL = ESDR_API_ROOT_URL + "/devices/";
const BOGUS_DEVICE_ID = 1;

const createValue = function(type, value) {
   return {
      type : type,
      value : value
   };
};

const setProperty = function(deviceId, accessToken, propertyKey, propertyValue, callback, willDebug) {
   superagent
         .put(ESDR_DEVICES_API_URL + deviceId + "/properties/" + propertyKey)
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
         .get(ESDR_DEVICES_API_URL + deviceId + "/properties/" + propertyKey)
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

const getProperties = function(deviceId, accessToken, queryString, callback, willDebug, expectedResponse) {
   superagent
         .get(ESDR_DEVICES_API_URL + deviceId + "/properties" + queryString)
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

const deletePropertiesForDevice = function(deviceId, accessToken, callback, expectedNumPropertiesDeleted) {
   superagent
         .del(ESDR_DEVICES_API_URL + deviceId + "/properties")
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

const deletePropertyForDevice = function(deviceId, accessToken, key, callback, expectedNumPropertiesDeleted) {
   superagent
         .del(ESDR_DEVICES_API_URL + deviceId + "/properties/" + key)
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
   const client1 = requireNew('./fixtures/client1.json');
   const client2 = requireNew('./fixtures/client2.json');
   const user1 = requireNew('./fixtures/user1.json');
   const user2 = requireNew('./fixtures/user2.json');
   let user1Client2 = null;
   let user2Client2 = null;
   const product1 = requireNew('./fixtures/product1.json');      // user 1
   const product2 = requireNew('./fixtures/product2.json');      // user 2
   const device1 = requireNew('./fixtures/device1.json');        // user 1, product 1
   const device2 = requireNew('./fixtures/device2.json');        // user 1, product 1
   const device3 = requireNew('./fixtures/device3.json');        // user 2, product 1
   const device4 = requireNew('./fixtures/device4.json');        // user 2, product 2

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
                  product1.creatorUserId = user1['id'];
                  setup.createProduct(product1, done);
               },
               function(done) {
                  product2.creatorUserId = user2['id'];
                  setup.createProduct(product2, done);
               },
               function(done) {
                  device1.userId = user1['id'];
                  device1.productId = product1['id'];
                  setup.createDevice(device1, done);
               },
               function(done) {
                  device2.userId = user1['id'];
                  device2.productId = product1['id'];
                  setup.createDevice(device2, done);
               },
               function(done) {
                  device3.userId = user2['id'];
                  device3.productId = product1['id'];
                  setup.createDevice(device3, done);
               },
               function(done) {
                  device4.userId = user2['id'];
                  device4.productId = product2['id'];
                  setup.createDevice(device4, done);
               }
            ],
            initDone
      );
   });

   describe.only("Devices", function() {
      describe("DeviceProperties", function() {
         describe("Set Property", function() {

            describe("No Authentication", function() {
               it("Should fail to set a property with no OAuth2 token specified", function(done) {
                  superagent
                        .put(ESDR_DEVICES_API_URL + device1['id'] + "/properties/foo")
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
                           .put(ESDR_DEVICES_API_URL + device1['id'] + "/properties/foo")
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
                           .put(ESDR_DEVICES_API_URL + device1['id'] + "/properties/foo")
                           .set(createAuthorizationHeader(user2['accessToken']))
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
                     const testSetProperty = function(test) {
                        it(test.description, function(done) {
                           const deviceId = (typeof test.device === 'function') ? test.device()['id'] : test.device['id'];

                           setProperty(deviceId,
                                       test['accessToken'],
                                       test.propertyKey,
                                       test.propertyValue,
                                       function() {
                                          // now try to fetch the property through the API to verify it was set correctly
                                          getProperty(
                                                deviceId,
                                                test['accessToken'],
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

                     const createTest = function(description, key, value, type, willDebug) {
                        return {
                           description : description,
                           device : device1,
                           accessToken : function() {
                              return user1['accessToken']
                           },
                           propertyKey : key,
                           propertyValue : createValue(type, value),
                           willDebug : !!willDebug
                        }
                     };

                     const shapeShifterInt = 42;
                     const shapeShifterDouble = 42.00042;
                     const shapeShifterString = "please to make englishes";
                     const shapeShifterJson = { foo : "bar", isTest : true, num : 3.14159 };
                     const shapeShifterBoolean = true;

                     const shapeshifterTypes = {
                        int : shapeShifterInt,
                        double : shapeShifterDouble,
                        string : shapeShifterString,
                        json : shapeShifterJson,
                        boolean : shapeShifterBoolean
                     };

                     const createTypeSwitchTest = function(fromTypeName, toTypeName) {
                        const propertyValue = {};
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
                           description : "Should be able to set a property for device 1 owned by user 1 and client 1 (prep for showing properties are private to device+user+client)",
                           device : device1,
                           accessToken : function() {
                              return user1['accessToken']
                           },
                           propertyKey : 'this_is_my_property',
                           propertyValue : createValue('string', 'device 1 user 1 client 1')
                        },
                        {
                           description : "Should be able to set a property for device 2 owned by user 1 and client 1",
                           device : device2,
                           accessToken : function() {
                              return user1['accessToken']
                           },
                           propertyKey : 'this_is_my_property',
                           propertyValue : createValue('string', 'device 2 user 1 client 1')
                        },
                        {
                           description : "Should be able to set a property for device 1 owned by user 1 and client 2",
                           device : device1,
                           accessToken : function() {
                              return user1Client2['accessToken']
                           },
                           propertyKey : 'this_is_my_property',
                           propertyValue : createValue('string', 'device 1 user 1 client 2')
                        },
                        {
                           description : "Should be able to set a property for device 2 owned by user 1 and client 2",
                           device : device2,
                           accessToken : function() {
                              return user1Client2['accessToken']
                           },
                           propertyKey : 'this_is_my_property',
                           propertyValue : createValue('string', 'device 2 user 1 client 2')
                        },

                        {
                           description : "Should be able to set a property for device 3 owned by user 2 and client 1",
                           device : device3,
                           accessToken : function() {
                              return user2['accessToken']
                           },
                           propertyKey : 'this_is_my_property',
                           propertyValue : createValue('string', 'device 3 user 2 client 1')
                        },
                        {
                           description : "Should be able to set a property for device 4 owned by user 2 and client 1",
                           device : device4,
                           accessToken : function() {
                              return user2['accessToken']
                           },
                           propertyKey : 'this_is_my_property',
                           propertyValue : createValue('string', 'device 4 user 2 client 1')
                        },
                        {
                           description : "Should be able to set a property for device 3 owned by user 2 and client 2",
                           device : device3,
                           accessToken : function() {
                              return user2Client2['accessToken']
                           },
                           propertyKey : 'this_is_my_property',
                           propertyValue : createValue('string', 'device 3 user 2 client 2')
                        },
                        {
                           description : "Should be able to set a property for device 4 owned by user 2 and client 2",
                           device : device4,
                           accessToken : function() {
                              return user2Client2['accessToken']
                           },
                           propertyKey : 'this_is_my_property',
                           propertyValue : createValue('string', 'device 4 user 2 client 2'),
                           additionalTests : function(done) {
                              // now verify the properties
                              const key = 'this_is_my_property';
                              getProperty(device1['id'], user1['accessToken'], key, function() {
                                 getProperty(device2['id'], user1['accessToken'], key, function() {
                                    getProperty(device1['id'], user1Client2['accessToken'], key, function() {
                                       getProperty(device2['id'], user1Client2['accessToken'], key, function() {
                                          getProperty(device3['id'], user2['accessToken'], key, function() {
                                             getProperty(device4['id'], user2['accessToken'], key, function() {
                                                getProperty(device3['id'], user2Client2['accessToken'], key, function() {
                                                   getProperty(device4['id'], user2Client2['accessToken'], key, function() {
                                                      done();
                                                   }, false, 'device 4 user 2 client 2');
                                                }, false, 'device 3 user 2 client 2');
                                             }, false, 'device 4 user 2 client 1');
                                          }, false, 'device 3 user 2 client 1');
                                       }, false, 'device 2 user 1 client 2');
                                    }, false, 'device 1 user 1 client 2');
                                 }, false, 'device 2 user 1 client 1');
                              }, false, 'device 1 user 1 client 1');
                           }
                        }
                     ].forEach(testSetProperty);

                  });   // Success
                  describe("Failure", function() {
                     it("Should fail to set a property for a non-existent device", function(done) {
                        superagent
                              .put(ESDR_DEVICES_API_URL + BOGUS_DEVICE_ID + "/properties/foo")
                              .set(createAuthorizationHeader(user1['accessToken']))
                              .send(createValue('int', 42))
                              .end(function(err, res) {
                                 should.not.exist(err);
                                 should.exist(res);

                                 res.should.have.property('status', httpStatus.NOT_FOUND);

                                 done();
                              });
                     });

                     const testSetPropertyValidation = function(test) {
                        it(test.description, function(done) {
                           superagent
                                 .put(ESDR_DEVICES_API_URL + test.device['id'] + "/properties/" + test.propertyKey)
                                 .set(createAuthorizationHeader(test['accessToken']))
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

                                    const expectedValidationItems = test.getExpectedValidationItems();
                                    res.body.should.have.property('data');
                                    res.body.data.should.have.length(expectedValidationItems.length);
                                    res.body.data.forEach(function(validationItem, index) {
                                       validationItem.should.have.properties(expectedValidationItems[index]);
                                    });

                                    done();
                                 });
                        });
                     };

                     const createValidationTest = function(description, key, value, type, expectedValidationItems, willDebug) {
                        return {
                           description : description,
                           device : device1,
                           accessToken : function() {
                              return user1['accessToken']
                           },
                           propertyKey : key,
                           propertyValue : createValue(type, value),
                           getExpectedValidationItems : function() {
                              return expectedValidationItems;
                           },
                           willDebug : !!willDebug
                        }
                     };

                     const createSimpleValidationTest = function(description, key, value, type, constraintType, testedType, willDebug) {
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

            const propertiesByUserIdDeviceIdAndAccessToken = {};

            const getPropertiesForDevice = function(userId, deviceId, accessToken, done) {
               const expectedProperties = {};
               for (const key in propertiesByUserIdDeviceIdAndAccessToken[userId][deviceId][accessToken]) {
                  // noinspection JSUnfilteredForInLoop
                  expectedProperties[key] = propertiesByUserIdDeviceIdAndAccessToken[userId][deviceId][accessToken][key].value;
               }
               getProperties(
                     deviceId,
                     accessToken,
                     "",
                     done,
                     false,
                     expectedProperties
               );
            };

            before(function(initDone) {
               propertiesByUserIdDeviceIdAndAccessToken[user1['id']] = {};
               propertiesByUserIdDeviceIdAndAccessToken[user1['id']][device1['id']] = {};
               propertiesByUserIdDeviceIdAndAccessToken[user1['id']][device2['id']] = {};
               propertiesByUserIdDeviceIdAndAccessToken[user1['id']][device1['id']][user1['accessToken']] = {
                  'prop1' : createValue('int', 123),
                  'prop2' : createValue('double', 12.3),
                  'prop3' : createValue('string', 'this is user1Device1Client1 prop 3'),
                  'prop4' : createValue('json', { thing : 1, other : [1, 2, 3] }),
                  'prop5' : createValue('boolean', true),
                  'user1Device1Client1Prop' : createValue('string', 'user1Device1Client1Prop value')
               };
               propertiesByUserIdDeviceIdAndAccessToken[user1Client2['id']][device1['id']][user1Client2['accessToken']] = {
                  'prop1' : createValue('int', 456),
                  'prop2' : createValue('double', 45.6),
                  'prop3' : createValue('string', 'this is user1Device1Client2 prop 3'),
                  'prop4' : createValue('json', { thing : 2, other : [4, 5, 6] }),
                  'prop5' : createValue('boolean', false),
                  'user1Device1Client2Prop' : createValue('string', 'user1Device1Client2Prop value')
               };
               propertiesByUserIdDeviceIdAndAccessToken[user1['id']][device2['id']][user1['accessToken']] = {
                  'prop1' : createValue('int', 1230),
                  'prop2' : createValue('double', 120.3),
                  'prop3' : createValue('string', 'this is user1Device2Client1 prop 3'),
                  'prop4' : createValue('json', { thing : 10, other : [10, 20, 30] }),
                  'prop5' : createValue('boolean', true),
                  'user1Device2Client1Prop' : createValue('string', 'user1Device2Client1Prop value')
               };
               propertiesByUserIdDeviceIdAndAccessToken[user1Client2['id']][device2['id']][user1Client2['accessToken']] = {
                  'prop1' : createValue('int', 4560),
                  'prop2' : createValue('double', 450.6),
                  'prop3' : createValue('string', 'this is user1Device2Client2 prop 3'),
                  'prop4' : createValue('json', { thing : 20, other : [40, 50, 60] }),
                  'prop5' : createValue('boolean', false),
                  'user1Device2Client2Prop' : createValue('string', 'user1Device2Client2Prop value')
               };

               propertiesByUserIdDeviceIdAndAccessToken[user2['id']] = {};
               propertiesByUserIdDeviceIdAndAccessToken[user2['id']][device3['id']] = {};
               propertiesByUserIdDeviceIdAndAccessToken[user2['id']][device4['id']] = {};
               propertiesByUserIdDeviceIdAndAccessToken[user2['id']][device3['id']][user2['accessToken']] = {
                  'prop1' : createValue('int', 789),
                  'prop2' : createValue('double', 78.9),
                  'prop3' : createValue('string', 'this is user2Device3Client1 prop 3'),
                  'prop4' : createValue('json', { thing : 3, other : [7, 8, 9] }),
                  'prop5' : createValue('boolean', true),
                  'user2Device3Client1Prop' : createValue('string', 'user2Device3Client1Prop value')
               };
               propertiesByUserIdDeviceIdAndAccessToken[user2Client2['id']][device3['id']][user2Client2['accessToken']] = {
                  'prop1' : createValue('int', 112233),
                  'prop2' : createValue('double', -1.12233),
                  'prop3' : createValue('string', 'this is user2Device3Client2 prop 3'),
                  'prop4' : createValue('json', { thing : 4, other : [11, 22, 33] }),
                  'prop5' : createValue('boolean', false),
                  'user2Device3Client2Prop' : createValue('string', 'user2Device3Client2Prop value')
               };
               propertiesByUserIdDeviceIdAndAccessToken[user2['id']][device4['id']][user2['accessToken']] = {
                  'prop1' : createValue('int', 7890),
                  'prop2' : createValue('double', 780.9),
                  'prop3' : createValue('string', 'this is user2Device4Client1 prop 3'),
                  'prop4' : createValue('json', { thing : 30, other : [70, 80, 90] }),
                  'prop5' : createValue('boolean', true),
                  'user2Device4Client1Prop' : createValue('string', 'user2Device4Client1Prop value')
               };
               propertiesByUserIdDeviceIdAndAccessToken[user2Client2['id']][device4['id']][user2Client2['accessToken']] = {
                  'prop1' : createValue('int', 1122330),
                  'prop2' : createValue('double', -10.12233),
                  'prop3' : createValue('string', 'this is user2Device4Client2 prop 3'),
                  'prop4' : createValue('json', { thing : 40, other : [110, 220, 330] }),
                  'prop5' : createValue('boolean', false),
                  'user2Device4Client2Prop' : createValue('string', 'user2Device4Client2Prop value')
               };

               const createCommand = function(user, device, key, value) {
                  commands.push(function(done) {
                     setProperty(device['id'], user['accessToken'], key, value, done);
                  });
               };
               const createCommandsForUserAndDevice = function(user, device) {
                  // start by creating a command to delete this device's properties
                  commands.push(function(done) {
                     deletePropertiesForDevice(device['id'], user['accessToken'], done);
                  });

                  // now add commands to create the above properties for this user
                  const props = propertiesByUserIdDeviceIdAndAccessToken[user['id']][device['id']][user['accessToken']];
                  Object.keys(props).forEach(function(key) {
                     const val = props[key];
                     createCommand(user, device, key, val)
                  });
               };

               const commands = [];
               createCommandsForUserAndDevice(user1, device1);
               createCommandsForUserAndDevice(user1, device2);
               createCommandsForUserAndDevice(user1Client2, device1);
               createCommandsForUserAndDevice(user1Client2, device2);
               createCommandsForUserAndDevice(user2, device3);
               createCommandsForUserAndDevice(user2, device4);
               createCommandsForUserAndDevice(user2Client2, device3);
               createCommandsForUserAndDevice(user2Client2, device4);

               flow.series(commands, initDone);
            });

            describe("Get", function() {
               describe("Get Property", function() {
                  describe("No Authentication", function() {
                     it("Should fail to get a property with no OAuth2 token specified", function(done) {
                        superagent
                              .get(ESDR_DEVICES_API_URL + device1['id'] + "/properties/prop1")
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
                                 .get(ESDR_DEVICES_API_URL + device1['id'] + "/properties/prop1")
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
                           const getExistingProperty = function(user, device, key, done) {
                              getProperty(device['id'],
                                          user['accessToken'],
                                          key,
                                          done,
                                          false,
                                          propertiesByUserIdDeviceIdAndAccessToken[user['id']][device['id']][user['accessToken']][key].value);
                           };

                           it("Should be able to get prop1 for user 1 device 1 client 1", function(done) {
                              getExistingProperty(user1, device1, 'prop1', done);
                           });
                           it("Should be able to get prop2 for user 1 device 1 client 1", function(done) {
                              getExistingProperty(user1, device1, 'prop2', done);
                           });
                           it("Should be able to get prop3 for user 1 device 1 client 1", function(done) {
                              getExistingProperty(user1, device1, 'prop3', done);
                           });
                           it("Should be able to get prop4 for user 1 device 1 client 1", function(done) {
                              getExistingProperty(user1, device1, 'prop4', done);
                           });
                           it("Should be able to get prop5 for user 1 device 1 client 1", function(done) {
                              getExistingProperty(user1, device1, 'prop5', done);
                           });
                           it("Should be able to get user1Client1Prop for user 1 device 1 client 1", function(done) {
                              getExistingProperty(user1, device1, 'user1Device1Client1Prop', done);
                           });

                           it("Should be able to get prop1 for user 1 device 2 client 1", function(done) {
                              getExistingProperty(user1, device2, 'prop1', done);
                           });
                           it("Should be able to get prop2 for user 1 device 2 client 1", function(done) {
                              getExistingProperty(user1, device2, 'prop2', done);
                           });
                           it("Should be able to get prop3 for user 1 device 2 client 1", function(done) {
                              getExistingProperty(user1, device2, 'prop3', done);
                           });
                           it("Should be able to get prop4 for user 1 device 2 client 1", function(done) {
                              getExistingProperty(user1, device2, 'prop4', done);
                           });
                           it("Should be able to get prop5 for user 1 device 2 client 1", function(done) {
                              getExistingProperty(user1, device2, 'prop5', done);
                           });
                           it("Should be able to get user1Client1Prop for user 1 device 2 client 1", function(done) {
                              getExistingProperty(user1, device2, 'user1Device2Client1Prop', done);
                           });

                           it("Should be able to get prop1 for user 1 device 1 client 2", function(done) {
                              getExistingProperty(user1Client2, device1, 'prop1', done);
                           });
                           it("Should be able to get prop2 for user 1 device 1 client 2", function(done) {
                              getExistingProperty(user1Client2, device1, 'prop2', done);
                           });
                           it("Should be able to get prop3 for user 1 device 1 client 2", function(done) {
                              getExistingProperty(user1Client2, device1, 'prop3', done);
                           });
                           it("Should be able to get prop4 for user 1 device 1 client 2", function(done) {
                              getExistingProperty(user1Client2, device1, 'prop4', done);
                           });
                           it("Should be able to get prop5 for user 1 device 1 client 2", function(done) {
                              getExistingProperty(user1Client2, device1, 'prop5', done);
                           });
                           it("Should be able to get user1Client1Prop for user 1 device 1 client 2", function(done) {
                              getExistingProperty(user1Client2, device1, 'user1Device1Client2Prop', done);
                           });

                           it("Should be able to get prop1 for user 1 device 2 client 2", function(done) {
                              getExistingProperty(user1Client2, device2, 'prop1', done);
                           });
                           it("Should be able to get prop2 for user 1 device 2 client 2", function(done) {
                              getExistingProperty(user1Client2, device2, 'prop2', done);
                           });
                           it("Should be able to get prop3 for user 1 device 2 client 2", function(done) {
                              getExistingProperty(user1Client2, device2, 'prop3', done);
                           });
                           it("Should be able to get prop4 for user 1 device 2 client 2", function(done) {
                              getExistingProperty(user1Client2, device2, 'prop4', done);
                           });
                           it("Should be able to get prop5 for user 1 device 2 client 2", function(done) {
                              getExistingProperty(user1Client2, device2, 'prop5', done);
                           });
                           it("Should be able to get user1Client1Prop for user 1 device 2 client 2", function(done) {
                              getExistingProperty(user1Client2, device2, 'user1Device2Client2Prop', done);
                           });

                           // ----------------------------------------------------------------
                           it("Should be able to get prop1 for user 2 device 3 client 1", function(done) {
                              getExistingProperty(user2, device3, 'prop1', done);
                           });
                           it("Should be able to get prop2 for user 2 device 3 client 1", function(done) {
                              getExistingProperty(user2, device3, 'prop2', done);
                           });
                           it("Should be able to get prop3 for user 2 device 3 client 1", function(done) {
                              getExistingProperty(user2, device3, 'prop3', done);
                           });
                           it("Should be able to get prop4 for user 2 device 3 client 1", function(done) {
                              getExistingProperty(user2, device3, 'prop4', done);
                           });
                           it("Should be able to get prop5 for user 2 device 3 client 1", function(done) {
                              getExistingProperty(user2, device3, 'prop5', done);
                           });
                           it("Should be able to get user2Client1Prop for user 2 device 3 client 1", function(done) {
                              getExistingProperty(user2, device3, 'user2Device3Client1Prop', done);
                           });

                           it("Should be able to get prop1 for user 2 device 4 client 1", function(done) {
                              getExistingProperty(user2, device4, 'prop1', done);
                           });
                           it("Should be able to get prop2 for user 2 device 4 client 1", function(done) {
                              getExistingProperty(user2, device4, 'prop2', done);
                           });
                           it("Should be able to get prop3 for user 2 device 4 client 1", function(done) {
                              getExistingProperty(user2, device4, 'prop3', done);
                           });
                           it("Should be able to get prop4 for user 2 device 4 client 1", function(done) {
                              getExistingProperty(user2, device4, 'prop4', done);
                           });
                           it("Should be able to get prop5 for user 2 device 4 client 1", function(done) {
                              getExistingProperty(user2, device4, 'prop5', done);
                           });
                           it("Should be able to get user2Client1Prop for user 2 device 4 client 1", function(done) {
                              getExistingProperty(user2, device4, 'user2Device4Client1Prop', done);
                           });

                           it("Should be able to get prop1 for user 2 device 3 client 2", function(done) {
                              getExistingProperty(user2Client2, device3, 'prop1', done);
                           });
                           it("Should be able to get prop2 for user 2 device 3 client 2", function(done) {
                              getExistingProperty(user2Client2, device3, 'prop2', done);
                           });
                           it("Should be able to get prop3 for user 2 device 3 client 2", function(done) {
                              getExistingProperty(user2Client2, device3, 'prop3', done);
                           });
                           it("Should be able to get prop4 for user 2 device 3 client 2", function(done) {
                              getExistingProperty(user2Client2, device3, 'prop4', done);
                           });
                           it("Should be able to get prop5 for user 2 device 3 client 2", function(done) {
                              getExistingProperty(user2Client2, device3, 'prop5', done);
                           });
                           it("Should be able to get user2Client1Prop for user 2 device 3 client 2", function(done) {
                              getExistingProperty(user2Client2, device3, 'user2Device3Client2Prop', done);
                           });

                           it("Should be able to get prop1 for user 2 device 4 client 2", function(done) {
                              getExistingProperty(user2Client2, device4, 'prop1', done);
                           });
                           it("Should be able to get prop2 for user 2 device 4 client 2", function(done) {
                              getExistingProperty(user2Client2, device4, 'prop2', done);
                           });
                           it("Should be able to get prop3 for user 2 device 4 client 2", function(done) {
                              getExistingProperty(user2Client2, device4, 'prop3', done);
                           });
                           it("Should be able to get prop4 for user 2 device 4 client 2", function(done) {
                              getExistingProperty(user2Client2, device4, 'prop4', done);
                           });
                           it("Should be able to get prop5 for user 2 device 4 client 2", function(done) {
                              getExistingProperty(user2Client2, device4, 'prop5', done);
                           });
                           it("Should be able to get user2Client1Prop for user 2 device 4 client 2", function(done) {
                              getExistingProperty(user2Client2, device4, 'user2Device4Client2Prop', done);
                           });
                           // ----------------------------------------------------------------

                        });   // Success
                        describe("Failure", function() {
                           it("Should fail to get a property for a non-existent device", function(done) {
                              superagent
                                    .get(ESDR_DEVICES_API_URL + BOGUS_DEVICE_ID + "/properties/foo")
                                    .set(createAuthorizationHeader(user1['accessToken']))
                                    .end(function(err, res) {
                                       should.not.exist(err);
                                       should.exist(res);

                                       res.should.have.property('status', httpStatus.NOT_FOUND);

                                       done();
                                    });
                           });
                           it("Should fail to get a property with a valid OAuth2 token, but for the wrong user", function(done) {
                              superagent
                                    .get(ESDR_DEVICES_API_URL + device1['id'] + "/properties/prop1")
                                    .set(createAuthorizationHeader(user2['accessToken']))
                                    .end(function(err, res) {
                                       should.not.exist(err);
                                       should.exist(res);

                                       res.should.have.property('status', httpStatus.FORBIDDEN);

                                       done();
                                    });
                           });
                           it("Should fail to get a property with a valid OAuth2 token for the same user, but a different client", function(done) {
                              superagent
                                    .get(ESDR_DEVICES_API_URL + device1['id'] + "/properties/user1Device1Client1Prop")
                                    .set(createAuthorizationHeader(user1Client2['accessToken']))
                                    .end(function(err, res) {
                                       should.not.exist(err);
                                       should.exist(res);

                                       res.should.have.property('status', httpStatus.NOT_FOUND);

                                       done();
                                    });
                           });
                           it("Should fail to get a non-existent property", function(done) {
                              superagent
                                    .get(ESDR_DEVICES_API_URL + device1['id'] + "/properties/no_such_property")
                                    .set(createAuthorizationHeader(user1['accessToken']))
                                    .end(function(err, res) {
                                       should.not.exist(err);
                                       should.exist(res);

                                       res.should.have.property('status', httpStatus.NOT_FOUND);

                                       done();
                                    });
                           });
                           it("Should fail to get a property with an invalid key", function(done) {
                              superagent
                                    .get(ESDR_DEVICES_API_URL + device3['id'] + "/properties/bad-key")
                                    .set(createAuthorizationHeader(user2['accessToken']))
                                    .end(function(err, res) {
                                       should.not.exist(err);
                                       should.exist(res);

                                       res.should.have.property('status', httpStatus.UNPROCESSABLE_ENTITY);
                                       res.should.have.property('body');
                                       res.body.should.have.properties({
                                                                          code : httpStatus.UNPROCESSABLE_ENTITY,
                                                                          status : 'error'
                                                                       });

                                       const expectedValidationItems = [{
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
                              .get(ESDR_DEVICES_API_URL + device1['id'] + "/properties")
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
                                 .get(ESDR_DEVICES_API_URL + device1['id'] + "/properties")
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
                           it("Should be able to get properties for user 1 device 1 client 1", function(done) {
                              getPropertiesForDevice(user1['id'], device1['id'], user1['accessToken'], done);
                           });
                           it("Should be able to get properties for user 1 device 2 client 1", function(done) {
                              getPropertiesForDevice(user1['id'], device2['id'], user1['accessToken'], done);
                           });
                           it("Should be able to get properties for user 1 device 1 client 2", function(done) {
                              getPropertiesForDevice(user1Client2['id'], device1['id'], user1Client2['accessToken'], done);
                           });
                           it("Should be able to get properties for user 1 device 2 client 2", function(done) {
                              getPropertiesForDevice(user1Client2['id'], device2['id'], user1Client2['accessToken'], done);
                           });

                           it("Should be able to get properties for user 2 device 3 client 1", function(done) {
                              getPropertiesForDevice(user2['id'], device3['id'], user2['accessToken'], done);
                           });
                           it("Should be able to get properties for user 2 device 4 client 1", function(done) {
                              getPropertiesForDevice(user2['id'], device4['id'], user2['accessToken'], done);
                           });
                           it("Should be able to get properties for user 2 device 3 client 2", function(done) {
                              getPropertiesForDevice(user2Client2['id'], device3['id'], user2Client2['accessToken'], done);
                           });
                           it("Should be able to get properties for user 2 device 4 client 2", function(done) {
                              getPropertiesForDevice(user2Client2['id'], device4['id'], user2Client2['accessToken'], done);
                           });

                           it("Should be able to use query string to select only properties of type string", function(done) {
                              getProperties(
                                    device1['id'],
                                    user1['accessToken'],
                                    "?where=type=string",
                                    done,
                                    false,
                                    {
                                       prop3 : 'this is user1Device1Client1 prop 3',
                                       user1Device1Client1Prop : 'user1Device1Client1Prop value'
                                    }
                              );
                           });
                           it("Should be able to use query string to select only properties of type string or int", function(done) {
                              getProperties(
                                    device1['id'],
                                    user1['accessToken'],
                                    "?whereOr=type=string,type=int",
                                    done,
                                    false,
                                    {
                                       prop3 : 'this is user1Device1Client1 prop 3',
                                       user1Device1Client1Prop : 'user1Device1Client1Prop value',
                                       prop1 : 123
                                    }
                              );
                           });
                           it("Should be able to use query string to select only specific property keys", function(done) {
                              getProperties(
                                    device3['id'],
                                    user2['accessToken'],
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
                                    device3['id'],
                                    user2Client2['accessToken'],
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
                           it("Should fail to get properties for a non-existent device", function(done) {
                              superagent
                                    .get(ESDR_DEVICES_API_URL + BOGUS_DEVICE_ID + "/properties")
                                    .set(createAuthorizationHeader(user1['accessToken']))
                                    .end(function(err, res) {
                                       should.not.exist(err);
                                       should.exist(res);

                                       res.should.have.property('status', httpStatus.NOT_FOUND);

                                       done();
                                    });
                           });
                           it("Should fail to get properties with a valid OAuth2 token, but for the wrong user", function(done) {
                              superagent
                                    .get(ESDR_DEVICES_API_URL + device1['id'] + "/properties")
                                    .set(createAuthorizationHeader(user2['accessToken']))
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
                              .del(ESDR_DEVICES_API_URL + device1['id'] + "/properties")
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
                                 .del(ESDR_DEVICES_API_URL + device1['id'] + "/properties")
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
                           it("Should be able to delete properties for user 1 device 1 client 1", function(done) {
                              deletePropertiesForDevice(
                                    device1['id'],
                                    user1['accessToken'],
                                    done,
                                    Object.keys(propertiesByUserIdDeviceIdAndAccessToken[user1['id']][device1['id']][user1['accessToken']]).length
                              );
                           });
                           it("Should be able to delete properties again for user 1 device 1 client 1, without error", function(done) {
                              deletePropertiesForDevice(
                                    device1['id'],
                                    user1['accessToken'],
                                    function() {
                                       // verify there are now no properties for this user
                                       getProperties(
                                             device1['id'],
                                             user1['accessToken'],
                                             '',
                                             done,
                                             false,
                                             {}
                                       );
                                    },
                                    0  // expect there to be 0 properties deleted since we just deleted them in the previous test
                              );
                           });
                           it("Verify that deleting one user's device properties shouldn't affect any other user's device properties", function(done) {
                              // verify that other user properties are untouched
                              getPropertiesForDevice(
                                    user1Client2['id'],
                                    device1['id'],
                                    user1Client2['accessToken'],
                                    function() {
                                       getPropertiesForDevice(
                                             user1['id'],
                                             device2['id'],
                                             user1['accessToken'],
                                             function() {
                                                getPropertiesForDevice(
                                                      user1Client2['id'],
                                                      device2['id'],
                                                      user1Client2['accessToken'],
                                                      function() {
                                                         getPropertiesForDevice(
                                                               user2['id'],
                                                               device3['id'],
                                                               user2['accessToken'],
                                                               function() {
                                                                  getPropertiesForDevice(
                                                                        user2Client2['id'],
                                                                        device3['id'],
                                                                        user2Client2['accessToken'],
                                                                        function() {
                                                                           getPropertiesForDevice(
                                                                                 user2['id'],
                                                                                 device4['id'],
                                                                                 user2['accessToken'],
                                                                                 function() {
                                                                                    getPropertiesForDevice(
                                                                                          user2Client2['id'],
                                                                                          device4['id'],
                                                                                          user2Client2['accessToken'],
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
                           it("Should fail to delete properties for a non-existent device", function(done) {
                              superagent
                                    .del(ESDR_DEVICES_API_URL + BOGUS_DEVICE_ID + "/properties")
                                    .set(createAuthorizationHeader(user1['accessToken']))
                                    .end(function(err, res) {
                                       should.not.exist(err);
                                       should.exist(res);

                                       res.should.have.property('status', httpStatus.NOT_FOUND);

                                       done();
                                    });
                           });
                           it("Should fail to delete properties with a valid OAuth2 token, but for the wrong user", function(done) {
                              superagent
                                    .del(ESDR_DEVICES_API_URL + device1['id'] + "/properties")
                                    .set(createAuthorizationHeader(user2['accessToken']))
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
                              .del(ESDR_DEVICES_API_URL + device3['id'] + "/properties/prop1")
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
                                 .del(ESDR_DEVICES_API_URL + device3['id'] + "/properties/prop1")
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
                           const verifyPropertyIsDeleted = function(deviceId, accessToken, key, done) {
                              superagent
                                    .get(ESDR_DEVICES_API_URL + deviceId + "/properties/" + key)
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
                              deletePropertyForDevice(device3['id'], user2['accessToken'], 'this_prop_does_not_exist', done, 0);
                           });
                           it("Should be able to delete prop1 for user 2 device 3 client 1", function(done) {
                              deletePropertyForDevice(device3['id'], user2['accessToken'], 'prop1', done, 1);
                           });
                           it("The property prop1 for user 2 device 3 client 1 should no longer exist", function(done) {
                              verifyPropertyIsDeleted(device3['id'], user2['accessToken'], 'prop1', done);
                           });

                           it("Should be able to delete prop2 for user 2 device 3 client 1", function(done) {
                              deletePropertyForDevice(device3['id'], user2['accessToken'], 'prop2', done, 1);
                           });
                           it("The property prop2 for user 2 device 3 client 1 should no longer exist", function(done) {
                              verifyPropertyIsDeleted(device3['id'], user2['accessToken'], 'prop2', done);
                           });
                           it("Should be able to delete prop3 for user 2 device 3 client 1", function(done) {
                              deletePropertyForDevice(device3['id'], user2['accessToken'], 'prop3', done, 1);
                           });
                           it("The property prop3 for user 2 device 3 client 1 should no longer exist", function(done) {
                              verifyPropertyIsDeleted(device3['id'], user2['accessToken'], 'prop3', done);
                           });
                           it("Should be able to delete prop4 for user 2 device 3 client 1", function(done) {
                              deletePropertyForDevice(device3['id'], user2['accessToken'], 'prop4', done, 1);
                           });
                           it("The property prop4 for user 2 device 3 client 1 should no longer exist", function(done) {
                              verifyPropertyIsDeleted(device3['id'], user2['accessToken'], 'prop4', done);
                           });
                           it("Should be able to delete prop5 for user 2 device 3 client 1", function(done) {
                              deletePropertyForDevice(device3['id'], user2['accessToken'], 'prop5', done, 1);
                           });
                           it("The property prop5 for user 2 device 3 client 1 should no longer exist", function(done) {
                              verifyPropertyIsDeleted(device3['id'], user2['accessToken'], 'prop5', done);
                           });
                           it("Should be able to delete user2Device3Client1Prop for user 2 device 3 client 1", function(done) {
                              deletePropertyForDevice(device3['id'], user2['accessToken'], 'user2Device3Client1Prop', done, 1);
                           });
                           it("The property user2Device3Client1Prop for user 2 device 3 client 1 should no longer exist", function(done) {
                              verifyPropertyIsDeleted(device3['id'], user2['accessToken'], 'user2Device3Client1Prop', done);
                           });
                           it("Verify user 2 device 3 client 1 has no properties", function(done) {
                              getProperties(device3['id'], user2['accessToken'], '', done, false, {});
                           });

                        });   // Success
                        describe("Failure", function() {
                           it("Should fail to delete a property for a non-existent device", function(done) {
                              superagent
                                    .del(ESDR_DEVICES_API_URL + BOGUS_DEVICE_ID + "/properties/foo")
                                    .set(createAuthorizationHeader(user1['accessToken']))
                                    .end(function(err, res) {
                                       should.not.exist(err);
                                       should.exist(res);

                                       res.should.have.property('status', httpStatus.NOT_FOUND);

                                       done();
                                    });
                           });
                           it("Should fail to delete a property with a valid OAuth2 token, but for the wrong user", function(done) {
                              superagent
                                    .del(ESDR_DEVICES_API_URL + device2['id'] + "/properties/prop1")
                                    .set(createAuthorizationHeader(user2['accessToken']))
                                    .end(function(err, res) {
                                       should.not.exist(err);
                                       should.exist(res);

                                       res.should.have.property('status', httpStatus.FORBIDDEN);

                                       done();
                                    });
                           });
                           it("Should fail to delete a property with an invalid key", function(done) {
                              superagent
                                    .del(ESDR_DEVICES_API_URL + device3['id'] + "/properties/bad-key")
                                    .set(createAuthorizationHeader(user2['accessToken']))
                                    .end(function(err, res) {
                                       should.not.exist(err);
                                       should.exist(res);

                                       res.should.have.property('status', httpStatus.UNPROCESSABLE_ENTITY);
                                       res.should.have.property('body');
                                       res.body.should.have.properties({
                                                                          code : httpStatus.UNPROCESSABLE_ENTITY,
                                                                          status : 'error'
                                                                       });

                                       const expectedValidationItems = [{
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
   });   // Devices
});   // REST API

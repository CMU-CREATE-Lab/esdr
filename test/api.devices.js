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
var ESDR_PRODUCTS_API_URL = ESDR_API_ROOT_URL + "/products";
var ESDR_DEVICES_API_URL = ESDR_API_ROOT_URL + "/devices";

describe("REST API", function() {
   var user1 = requireNew('./fixtures/user1.json');
   var user2 = requireNew('./fixtures/user2.json');
   var product1 = requireNew('./fixtures/product1.json');
   var product2 = requireNew('./fixtures/product2.json');
   var device1User1 = requireNew('./fixtures/device1.json');
   var device1User2 = requireNew('./fixtures/device1.json');
   var device2User1 = requireNew('./fixtures/device2.json');
   var device3User1 = requireNew('./fixtures/device3.json');
   var device4User2 = requireNew('./fixtures/device4.json');
   var device1User1Product2 = requireNew('./fixtures/device1.json');
   var deviceMissingRequiredFields = requireNew('./fixtures/device6-missing-required-fields.json');
   var deviceInvalidSerialNumber = requireNew('./fixtures/device7-invalid-serial-number.json');

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
                  setup.authenticateUser(user1, done);
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
               }
            ],
            initDone
      );
   });

   describe("Devices", function() {

      describe("Create", function() {
         var creationTests = [
            {
               description : "Should be able to create a new device (user 1)",
               accessToken : function() {
                  return user1.accessToken
               },
               product : product1,
               device : device1User1,
               user : user1,
               expectedHttpStatus : httpStatus.CREATED,
               expectedStatusText : 'success',
               expectedResponseData : {
                  name : device1User1.name,
                  serialNumber : device1User1.serialNumber,
               }
            },
            {
               description : "Should be able to create the same device for the same product for a different user (user 2)",
               accessToken : function() {
                  return user2.accessToken
               },
               product : product1,
               device : device1User2,
               user : user2,
               expectedHttpStatus : httpStatus.CREATED,
               expectedStatusText : 'success',
               expectedResponseData : {
                  name : device1User2.name,
                  serialNumber : device1User2.serialNumber,
               }
            },
            {
               description : "Should fail to create the same device for the same product for the same user again (user 1)",
               accessToken : function() {
                  return user1.accessToken
               },
               product : product1,
               device : device1User1,
               user : user1,
               expectedHttpStatus : httpStatus.CONFLICT,
               expectedStatusText : 'error',
               expectedResponseData : {
                  serialNumber : device1User1.serialNumber,
               }
            },
            {
               description : "Should fail to create a new device for a bogus product",
               accessToken : function() {
                  return user1.accessToken
               },
               product : { name : "bogus" },
               device : device1User1,
               user : user1,
               expectedHttpStatus : httpStatus.NOT_FOUND,
               expectedStatusText : 'error',
               hasEmptyBody : true
            },
            {
               description : "Should fail to create a new device with an invalid OAuth2 access token",
               accessToken : function() {
                  return "bogus"
               },
               product : product1,
               device : device1User1,
               user : user1,
               expectedHttpStatus : httpStatus.UNAUTHORIZED,
               expectedStatusText : 'error',
               hasEmptyBody : true
            },
            {
               description : "Should be able to create a second device for user 1",
               accessToken : function() {
                  return user1.accessToken
               },
               product : product1,
               device : device2User1,
               user : user1,
               expectedHttpStatus : httpStatus.CREATED,
               expectedStatusText : 'success',
               expectedResponseData : {
                  serialNumber : device2User1.serialNumber,
               }
            },
            {
               description : "Should be able to create a third device for user 1",
               accessToken : function() {
                  return user1.accessToken
               },
               product : product1,
               device : device3User1,
               user : user1,
               expectedHttpStatus : httpStatus.CREATED,
               expectedStatusText : 'success',
               expectedResponseData : {
                  serialNumber : device3User1.serialNumber,
               }
            },
            {
               description : "Should be able to create a second device for user 2",
               accessToken : function() {
                  return user2.accessToken
               },
               product : product1,
               device : device4User2,
               user : user2,
               expectedHttpStatus : httpStatus.CREATED,
               expectedStatusText : 'success',
               expectedResponseData : {
                  serialNumber : device4User2.serialNumber,
               }
            },
            {
               description : "Should be able to create a device with the same serial number as a different device owned by the user, but for a different product",
               accessToken : function() {
                  return user1.accessToken
               },
               product : product2,
               device : device1User1Product2,
               user : user1,
               expectedHttpStatus : httpStatus.CREATED,
               expectedStatusText : 'success',
               expectedResponseData : {
                  serialNumber : device1User1Product2.serialNumber,
               }
            }
         ];

         creationTests.forEach(function(test) {
            it(test.description, function(done) {
               superagent
                     .post(ESDR_PRODUCTS_API_URL + "/" + test.product.name + "/devices")
                     .set(createAuthorizationHeader(test.accessToken))
                     .send(test.device)
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

                           res.body.should.have.property('data');
                           res.body.data.should.have.properties(test.expectedResponseData);

                           if (test.expectedHttpStatus == httpStatus.CREATED) {
                              res.body.data.should.have.property('id');

                              // remember the database ID and userId
                              test.device.id = res.body.data.id;
                              test.device.userId = test.user.id;
                           }
                        }

                        done();
                     });
            });
         });

         var creationValidationTests = [
            {
               description : "Should fail to create a new device if required fields are missing",
               accessToken : function() {
                  return user1.accessToken
               },
               product : product1,
               device : deviceMissingRequiredFields,
               user : user1,
               getExpectedValidationItems : function() {
                  return [
                     {
                        instanceContext : '#',
                        constraintName : 'required',
                        constraintValue : global.db.devices.jsonSchema.required,
                        kind : 'ObjectValidationError'
                     }
                  ];
               }
            },
            {
               description : "Should fail to create a new device if serial number is invalid",
               accessToken : function() {
                  return user1.accessToken
               },
               product : product1,
               device : deviceInvalidSerialNumber,
               user : user1,
               getExpectedValidationItems : function() {
                  return [
                     {
                        instanceContext : '#/serialNumber',
                        constraintName : 'pattern',
                        testedValue : deviceInvalidSerialNumber.serialNumber,
                        kind : 'StringValidationError'
                     }
                  ];
               }
            }
         ];

         creationValidationTests.forEach(function(test) {
            it(test.description, function(done) {
               superagent
                     .post(ESDR_PRODUCTS_API_URL + "/" + test.product.name + "/devices")
                     .set(createAuthorizationHeader(test.accessToken))
                     .send(test.device)
                     .end(function(err, res) {
                        should.not.exist(err);
                        should.exist(res);

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
         });

      });   // End Create

      describe("Find", function() {
         var executeFindTest = function(test) {
            it(test.description, function(done) {
               superagent
                     .get(typeof test.url === 'function' ? test.url() : test.url)
                     .set(createAuthorizationHeader(test.accessToken))
                     .end(function(err, res) {
                        should.not.exist(err);
                        should.exist(res);

                        if (test.willDebug) {
                           console.log(JSON.stringify(res.body, null, 3));
                        }

                        res.should.have.property('status', test.expectedHttpStatus || httpStatus.OK);
                        if (!test.hasEmptyBody) {
                           res.should.have.property('body');
                           res.body.should.have.properties({
                                                              code : test.expectedHttpStatus || httpStatus.OK,
                                                              status : test.expectedStatusText || 'success'
                                                           });

                           if (!test.hasEmptyData) {
                              res.body.should.have.property('data');
                              var expectedResponseData = test.getExpectedResponseData();
                              if ('rows' in expectedResponseData && 'totalCount' in expectedResponseData) {
                                 res.body.data.should.have.property('totalCount', expectedResponseData.totalCount);
                                 res.body.data.rows.forEach(function(item, index) {
                                    item.should.have.properties(expectedResponseData.rows[index]);

                                    if (test.additionalExpectedDataProperties) {
                                       item.should.have.properties(test.additionalExpectedDataProperties);
                                    }
                                    if (test.expectedMissingProperties) {
                                       test.expectedMissingProperties.forEach(function(prop) {
                                          item.should.not.have.property(prop);
                                       });
                                    }
                                 });
                              }
                              else {
                                 res.body.data.should.have.properties(expectedResponseData);

                                 if (test.additionalExpectedDataProperties) {
                                    res.body.data.should.have.properties(test.additionalExpectedDataProperties);
                                 }
                                 if (test.expectedMissingProperties) {
                                    test.expectedMissingProperties.forEach(function(prop) {
                                       res.body.data.should.not.have.property(prop);
                                    });
                                 }
                              }
                           }
                        }

                        done();
                     });
            });
         };

         describe("Using URL /products/:productNameOrId/devices/:serialNumber", function() {

            [
               {
                  description : "Should be able to find a device by product name and serial number by the user who owns it (user 1)",
                  url : ESDR_PRODUCTS_API_URL + "/" + product1.name + "/devices/" + device1User1.serialNumber,
                  accessToken : function() {
                     return user1.accessToken
                  },
                  getExpectedResponseData : function() {
                     return {
                        id : device1User1.id,
                        name : device1User1.name,
                        serialNumber : device1User1.serialNumber,
                        productId : product1.id,
                        userId : user1.id
                     }
                  },
                  additionalExpectedDataProperties : ['created', 'modified']
               },
               {
                  description : "Should be able to find a device by product ID and serial number by the user who owns it (user 1)",
                  url : function() {
                     return ESDR_PRODUCTS_API_URL + "/" + product1.id + "/devices/" + device1User1.serialNumber;
                  },
                  accessToken : function() {
                     return user1.accessToken
                  },
                  getExpectedResponseData : function() {
                     return {
                        id : device1User1.id,
                        name : device1User1.name,
                        serialNumber : device1User1.serialNumber,
                        productId : product1.id,
                        userId : user1.id
                     }
                  },
                  additionalExpectedDataProperties : ['created', 'modified']
               },
               {
                  description : "Should fail to find a device by product ID and device serial number for a product that doesn't exist",
                  url : function() {
                     return ESDR_PRODUCTS_API_URL + "/" + 1 + "/devices/" + device1User1.serialNumber;
                  },
                  accessToken : function() {
                     return user1.accessToken
                  },
                  expectedHttpStatus : httpStatus.NOT_FOUND,
                  expectedStatusText : 'error',
                  hasEmptyData : true
               },
               {
                  description : "Should fail to find a device by product name and device serial number for a product that doesn't exist",
                  url : function() {
                     return ESDR_PRODUCTS_API_URL + "/" + 'bogus_product' + "/devices/" + device1User1.serialNumber;
                  },
                  accessToken : function() {
                     return user1.accessToken
                  },
                  expectedHttpStatus : httpStatus.NOT_FOUND,
                  expectedStatusText : 'error',
                  hasEmptyData : true
               },
               {
                  description : "Should fail to find a device by product name and device serial number by a user who doesn't own it",
                  url : function() {
                     return ESDR_PRODUCTS_API_URL + "/" + product2.name + "/devices/" + device1User1Product2.serialNumber;
                  },
                  accessToken : function() {
                     return user2.accessToken
                  },
                  expectedHttpStatus : httpStatus.NOT_FOUND,
                  expectedStatusText : 'error',
                  hasEmptyData : true
               },
               {
                  description : "Should fail to find a device by product ID and device serial number by a user who doesn't own it",
                  url : function() {
                     return ESDR_PRODUCTS_API_URL + "/" + product2.id + "/devices/" + device1User1Product2.serialNumber;
                  },
                  accessToken : function() {
                     return user2.accessToken
                  },
                  expectedHttpStatus : httpStatus.NOT_FOUND,
                  expectedStatusText : 'error',
                  hasEmptyData : true
               },
               {
                  description : "Should fail to find a device by product ID and device serial number if the serial number is unknown",
                  url : function() {
                     return ESDR_PRODUCTS_API_URL + "/" + product2.id + "/devices/" + "bogus";
                  },
                  accessToken : function() {
                     return user2.accessToken
                  },
                  expectedHttpStatus : httpStatus.NOT_FOUND,
                  expectedStatusText : 'error',
                  hasEmptyData : true
               },
               {
                  description : "Should fail to find a device by product name and device serial number if the serial number is unknown",
                  url : function() {
                     return ESDR_PRODUCTS_API_URL + "/" + product2.name + "/devices/" + "bogus";
                  },
                  accessToken : function() {
                     return user2.accessToken
                  },
                  expectedHttpStatus : httpStatus.NOT_FOUND,
                  expectedStatusText : 'error',
                  hasEmptyData : true
               }
            ].forEach(executeFindTest);

         });   // End Using URL /products/:productNameOrId/devices/:serialNumber

         describe("Using URL /devices/:deviceId", function() {
            [
               {
                  description : "Should be able to find a device by ID by the user who owns it",
                  url : function() {
                     return ESDR_DEVICES_API_URL + "/" + device1User1.id;
                  },
                  accessToken : function() {
                     return user1.accessToken
                  },
                  getExpectedResponseData : function() {
                     return {
                        id : device1User1.id,
                        name : device1User1.name,
                        serialNumber : device1User1.serialNumber,
                        productId : product1.id,
                        userId : user1.id
                     }
                  },
                  additionalExpectedDataProperties : ['created', 'modified']
               },
               {
                  description : "Should fail to find a device by ID for an ID that doesn't exist",
                  url : function() {
                     return ESDR_DEVICES_API_URL + "/" + 1;
                  },
                  accessToken : function() {
                     return user2.accessToken
                  },
                  expectedHttpStatus : httpStatus.NOT_FOUND,
                  expectedStatusText : 'error',
                  hasEmptyData : true
               },
               {
                  description : "Should fail to find a device by ID by a user who doesn't own it",
                  url : function() {
                     return ESDR_DEVICES_API_URL + "/" + device1User1.id;
                  },
                  accessToken : function() {
                     return user2.accessToken
                  },
                  expectedHttpStatus : httpStatus.FORBIDDEN,
                  expectedStatusText : 'error',
                  hasEmptyData : true
               },
               {
                  description : "Should be able to find all devices for a particular product owned by the auth'd user (user 1)",
                  url : function() {
                     return ESDR_DEVICES_API_URL + "?where=productId=" + product1.id;
                  },
                  accessToken : function() {
                     return user1.accessToken
                  },
                  getExpectedResponseData : function() {
                     return {
                        totalCount : 3,
                        offset : 0,
                        limit : 100,
                        rows : [
                           {
                              id : device1User1.id,
                              name : device1User1.name,
                              serialNumber : device1User1.serialNumber,
                              productId : product1.id,
                              userId : user1.id
                           },
                           {
                              id : device2User1.id,
                              name : null,
                              serialNumber : device2User1.serialNumber,
                              productId : product1.id,
                              userId : user1.id
                           },
                           {
                              id : device3User1.id,
                              name : null,
                              serialNumber : device3User1.serialNumber,
                              productId : product1.id,
                              userId : user1.id
                           }
                        ]
                     }
                  },
                  additionalExpectedDataProperties : ['created', 'modified']
               },
               {
                  description : "Should be able to find devices (owned by a single user) having the same serial number, but for different products",
                  url : function() {
                     return ESDR_DEVICES_API_URL + "?where=serialNumber=" + device1User1.serialNumber;
                  },
                  accessToken : function() {
                     return user1.accessToken
                  },
                  getExpectedResponseData : function() {
                     return {
                        totalCount : 2,
                        offset : 0,
                        limit : 100,
                        rows : [
                           {
                              id : device1User1.id,
                              name : device1User1.name,
                              serialNumber : device1User1.serialNumber,
                              productId : product1.id,
                              userId : user1.id
                           },
                           {
                              id : device1User1Product2.id,
                              name : device1User1Product2.name,
                              serialNumber : device1User1Product2.serialNumber,
                              productId : product2.id,
                              userId : user1.id
                           }
                        ]
                     }
                  },
                  additionalExpectedDataProperties : ['created', 'modified']
               },
               {
                  description : "Should be able to find all devices for a particular product owned by the auth'd user (user 2)",
                  url : function() {
                     return ESDR_DEVICES_API_URL + "?fields=id,serialNumber,userId,productId&where=productId=" + product1.id;
                  },
                  accessToken : function() {
                     return user2.accessToken
                  },
                  getExpectedResponseData : function() {
                     return {
                        totalCount : 2,
                        offset : 0,
                        limit : 100,
                        rows : [
                           {
                              id : device1User2.id,
                              serialNumber : device1User2.serialNumber,
                              productId : product1.id,
                              userId : user2.id
                           },
                           {
                              id : device4User2.id,
                              serialNumber : device4User2.serialNumber,
                              productId : product1.id,
                              userId : user2.id
                           }
                        ]
                     }
                  },
                  expectedMissingProperties : ['name', 'created', 'modified']
               },
               {
                  description : "Should fail to find any devices for a particular product if the auth'd user (user 2) has no devices for that product",
                  url : function() {
                     return ESDR_DEVICES_API_URL + "?where=productId=" + product2.id;
                  },
                  accessToken : function() {
                     return user2.accessToken
                  },
                  getExpectedResponseData : function() {
                     return {
                        totalCount : 0,
                        offset : 0,
                        limit : 100,
                        rows : []
                     }
                  }
               },
               {
                  description : "Should fail to find any devices for a particular product if auth is invalid",
                  url : function() {
                     return ESDR_DEVICES_API_URL + "?where=productId=" + product2.id;
                  },
                  accessToken : "bogus",
                  expectedHttpStatus : httpStatus.UNAUTHORIZED,
                  hasEmptyBody : true
               }
            ].forEach(executeFindTest);
         });   // End Using URL /devices/:deviceId
      });   // End Find
   });   // End Devices
});   // End REST API
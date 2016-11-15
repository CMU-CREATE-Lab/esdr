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

describe("REST API", function() {
   var user1 = requireNew('./fixtures/user1.json');
   var user2 = requireNew('./fixtures/user2.json');
   var product1 = requireNew('./fixtures/product1.json');
   var product2 = requireNew('./fixtures/product2.json');
   var product3 = requireNew('./fixtures/product3.json');
   var productMissingRequiredFields = requireNew('./fixtures/product6-missing-required-fields.json');
   var productFieldsWithMinLengthAreTooShort = requireNew('./fixtures/product7-fields-with-minLength-too-short.json');

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
               }
            ],
            initDone
      );
   });

   describe("Products", function() {

      describe("Create", function() {
         var creationTests = [
            {
               description : "Should be able to create a new product (with authentication)",
               accessToken : function() {
                  return user1.accessToken
               },
               product : product1,
               user : user1,
               expectedHttpStatus : httpStatus.CREATED,
               expectedStatusText : 'success',
               expectedResponseData : {
                  name : product1.name
               }
            },
            {
               description : "Should be able to create another new product, owned by a different user",
               accessToken : function() {
                  return user2.accessToken
               },
               product : product2,
               user : user2,
               expectedHttpStatus : httpStatus.CREATED,
               expectedStatusText : 'success',
               expectedResponseData : {
                  name : product2.name
               }
            },
            {
               description : "Should fail to create a new product with bogus authentication",
               accessToken : "bogus",
               product : product2,
               expectedHttpStatus : httpStatus.UNAUTHORIZED,
               expectedStatusText : 'error',
               hasEmptyBody : true
            },
            {
               description : "Should fail to create a new product if the name is already in use",
               accessToken : function() {
                  return user2.accessToken
               },
               product : product1,
               expectedHttpStatus : httpStatus.CONFLICT,
               expectedStatusText : 'error',
               expectedResponseData : {
                  name : product1.name
               }
            }
         ];

         creationTests.forEach(function(test) {
            it(test.description, function(done) {
               superagent
                     .post(ESDR_PRODUCTS_API_URL)
                     .set(createAuthorizationHeader(test.accessToken))
                     .send(test.product)
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

                              // remember the database ID and creatorUserId
                              test.product.id = res.body.data.id;
                              test.product.creatorUserId = test.user.id;
                           }
                        }

                        done();
                     });
            });
         });

         it("Should fail to create a new product without authentication", function(done) {
            superagent
                  .post(ESDR_PRODUCTS_API_URL)
                  .send(product3)
                  .end(function(err, res) {
                     should.not.exist(err);
                     should.exist(res);

                     res.should.have.property('status', httpStatus.UNAUTHORIZED);

                     done();
                  });
         });

         var creationValidationTests = [
            {
               description : "Should fail to create a new product if the required fields are missing",
               accessToken : function() {
                  return user1.accessToken
               },
               product : productMissingRequiredFields,
               getExpectedValidationItems : function() {
                  return [
                     {
                        instanceContext : '#',
                        constraintName : 'required',
                        constraintValue : global.db.products.jsonSchema.required,
                        desc : 'missing: name,prettyName,defaultChannelSpecs',
                        kind : 'ObjectValidationError'
                     }
                  ];
               }
            },
            {
               description : "Should fail to create a new product if the fields with minLength are too short",
               accessToken : function() {
                  return user1.accessToken
               },
               product : productFieldsWithMinLengthAreTooShort,
               getExpectedValidationItems : function() {
                  return [
                     {
                        instanceContext : '#/name',
                        constraintName : 'minLength',
                        constraintValue : global.db.products.jsonSchema.properties.name.minLength,
                        testedValue : productFieldsWithMinLengthAreTooShort.name.length
                     },
                     {
                        instanceContext : '#/prettyName',
                        constraintName : 'minLength',
                        constraintValue : global.db.products.jsonSchema.properties.prettyName.minLength,
                        testedValue : productFieldsWithMinLengthAreTooShort.prettyName.length
                     },
                     {
                        instanceContext : '#/defaultChannelSpecs',
                        constraintName : 'minLength',
                        constraintValue : global.db.products.jsonSchema.properties.defaultChannelSpecs.minLength,
                        testedValue : 1
                     }
                  ];
               }
            }
         ];

         creationValidationTests.forEach(function(test) {
            it(test.description, function(done) {
               superagent
                     .post(ESDR_PRODUCTS_API_URL)
                     .set(createAuthorizationHeader(test.accessToken))
                     .send(test.product)
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

         var findTests = [
            {
               description : "Should be able to get a product by name (with no access token provided)",
               urlSuffix : "/" + product1.name,
               getExpectedResponseData : function() {
                  return {
                     id : product1.id,
                     name : product1.name,
                     prettyName : product1.prettyName,
                     vendor : product1.vendor,
                     description : product1.description,
                     creatorUserId : product1.creatorUserId,
                     defaultChannelSpecs : product1.defaultChannelSpecs
                  }
               },
               additionalExpectedDataProperties : ['created', 'modified']
            },
            {
               description : "Should be able to get a product by name and specify which fields to return",
               urlSuffix : "/" + product1.name + "?fields=id,name,defaultChannelSpecs",
               getExpectedResponseData : function() {
                  return {
                     id : product1.id,
                     name : product1.name,
                     defaultChannelSpecs : product1.defaultChannelSpecs
                  }
               },
               expectedMissingProperties : ['prettyName', 'vendor', 'description', 'creatorUserId']
            },
            {
               description : "Should be able to get a product by id and specify which fields to return",
               urlSuffix : function() {
                  return "/" + product1.id + "?fields=id,name,defaultChannelSpecs"
               },
               getExpectedResponseData : function() {
                  return {
                     id : product1.id,
                     name : product1.name,
                     defaultChannelSpecs : product1.defaultChannelSpecs
                  }
               },
               expectedMissingProperties : ['prettyName', 'vendor', 'description', 'creatorUserId']
            },
            {
               description : "Should fail to get a product with a bogus name",
               urlSuffix : "/" + "bogus",
               expectedHttpStatus : httpStatus.NOT_FOUND,
               expectedStatusText : 'error',
               hasEmptyData : true
            },
            {
               description : "Should be able to list all products",
               urlSuffix : "",
               getExpectedResponseData : function() {
                  return {
                     totalCount : 2,
                     offset : 0,
                     limit : 100,
                     rows : [
                        {
                           id : product1.id,
                           name : product1.name,
                           prettyName : product1.prettyName,
                           vendor : product1.vendor,
                           description : product1.description,
                           creatorUserId : product1.creatorUserId,
                           defaultChannelSpecs : product1.defaultChannelSpecs
                        },
                        {
                           id : product2.id,
                           name : product2.name,
                           prettyName : product2.prettyName,
                           vendor : product2.vendor,
                           description : product2.description,
                           creatorUserId : product2.creatorUserId,
                           defaultChannelSpecs : product2.defaultChannelSpecs
                        }
                     ]
                  }
               },
               additionalExpectedDataProperties : ['created', 'modified']
            },
            {
               description : "Should be able to find products by name",
               urlSuffix : "?where=name=" + product1.name + "&fields=id,name,created",
               getExpectedResponseData : function() {
                  return {
                     totalCount : 1,
                     offset : 0,
                     limit : 100,
                     rows : [
                        {
                           id : product1.id,
                           name : product1.name
                        }
                     ]
                  }
               },
               additionalExpectedDataProperties : ['created'],
               expectedMissingProperties : ['prettyName', 'vendor', 'description', 'creatorUserId', 'defaultChannelSpecs', 'modified']
            },
            {
               description : "Should be able to query for products and have them returned in a specified order",
               urlSuffix : "?fields=id,name&orderBy=-id",
               getExpectedResponseData : function() {
                  return {
                     totalCount : 2,
                     offset : 0,
                     limit : 100,
                     rows : [
                        {
                           id : product2.id,
                           name : product2.name
                        },
                        {
                           id : product1.id,
                           name : product1.name
                        }
                     ]
                  }
               },
               expectedMissingProperties : ['prettyName', 'vendor', 'description', 'creatorUserId', 'defaultChannelSpecs', 'created', 'modified']
            }
         ];

         findTests.forEach(function(test) {
            it(test.description, function(done) {
               var urlSuffix = (typeof test.urlSuffix === 'function') ? test.urlSuffix() : test.urlSuffix;
               superagent
                     .get(ESDR_PRODUCTS_API_URL + urlSuffix)
                     .end(function(err, res) {
                        should.not.exist(err);
                        should.exist(res);

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
                                 res.body.data.rows.forEach(function(product, index) {
                                    product.should.have.properties(expectedResponseData.rows[index]);

                                    if (test.additionalExpectedDataProperties) {
                                       product.should.have.properties(test.additionalExpectedDataProperties);
                                    }
                                    if (test.expectedMissingProperties) {
                                       test.expectedMissingProperties.forEach(function(prop) {
                                          product.should.not.have.property(prop);
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
         });

      });   // End Find
   });   // End Products
});   // End REST API
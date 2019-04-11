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
const ESDR_MULTIFEEDS_API_URL = ESDR_API_ROOT_URL + "/multifeeds";

describe("REST API", function() {
   const user1 = requireNew('./fixtures/user1.json');
   const user2 = requireNew('./fixtures/user2.json');
   const multifeed1a = requireNew('./fixtures/multifeed1.json');
   const multifeed1b = requireNew('./fixtures/multifeed1.json');
   const multifeed2 = requireNew('./fixtures/multifeed2.json');

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
               }
            ],
            initDone
      );
   });

   describe("Multifeeds", function() {
      describe("Create", function() {

         const executeTest = function(test) {
            it(test.description, function(done) {
               superagent
                     .post(ESDR_MULTIFEEDS_API_URL)
                     .set(typeof test.headers === 'undefined' ? {} : (typeof test.headers === 'function' ? test.headers() : test.headers))
                     .send(test.multifeed)
                     .end(function(err, res) {
                        should.not.exist(err);
                        should.exist(res);

                        if (test.willDebug) {
                           console.log(JSON.stringify(test.multifeed, null, 3));
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

                           if (test.expectedHttpStatus === httpStatus.CREATED) {
                              res.body.data.should.have.property('id');
                              res.body.data.should.have.property('name');

                              // remember the database ID
                              test.multifeed.id = res.body.data.id;

                              // If the name is already defined, make a copy of it under the _name field.  Then save
                              // the returned name under the name field.  We do this because creating a multifeed will
                              // trim the name field
                              if (typeof test.multifeed.name !== 'undefined') {
                                 test.multifeed._name = test.multifeed.name;
                              }
                              test.multifeed.name = res.body.data.name;

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
         };

         describe("Invalid Auth", function() {
            [
               {
                  description : "Should fail to create a multifeed if no authentication is provided",
                  mulitfeed : multifeed1a,
                  expectedHttpStatus : httpStatus.UNAUTHORIZED,
                  expectedStatusText : 'error',
                  hasEmptyBody : true
               },
               {
                  description : "Should fail to create a multifeed if invalid authentication is provided",
                  headers : createAuthorizationHeader("bogus"),
                  mulitfeed : multifeed1a,
                  expectedHttpStatus : httpStatus.UNAUTHORIZED,
                  expectedStatusText : 'error',
                  hasEmptyBody : true
               }
            ].forEach(executeTest);

         });   // End Invalid Auth

         describe("Valid Auth", function() {
            [
               {
                  description : "Should be able to create a multifeed with no name specified",
                  headers : function() {
                     return createAuthorizationHeader(user1['accessToken']);
                  },
                  multifeed : multifeed1a,
                  expectedHttpStatus : httpStatus.CREATED,
                  expectedStatusText : 'success'
               },
               {
                  description : "Should be able to create the same multifeed again with no name specified",
                  headers : function() {
                     return createAuthorizationHeader(user1['accessToken']);
                  },
                  multifeed : multifeed1b,
                  expectedHttpStatus : httpStatus.CREATED,
                  expectedStatusText : 'success',
                  additionalTests : function(originalErr, originalRes, done) {
                     // make sure the names are different
                     multifeed1a['name'].should.not.equal(multifeed1b['name']);
                     done();
                  }
               },
               {
                  description : "Should be able to create a named multifeed (and the name will be trimmed)",
                  headers : function() {
                     return createAuthorizationHeader(user1['accessToken']);
                  },
                  multifeed : multifeed2,
                  expectedHttpStatus : httpStatus.CREATED,
                  expectedStatusText : 'success',
                  additionalTests : function(originalErr, originalRes, done) {
                     // make sure the name got trimmed (see note above about _name)
                     multifeed2._name.trim().should.equal(multifeed2['name']);
                     done();
                  }
               },
               {
                  description : "Should fail to create a named multifeed again, by the same user",
                  headers : function() {
                     return createAuthorizationHeader(user1['accessToken']);
                  },
                  multifeed : multifeed2,
                  expectedHttpStatus : httpStatus.CONFLICT,
                  expectedStatusText : 'error',
                  expectedResponseData : { name : multifeed2['name'].trim() }
               },
               {
                  description : "Should fail to create a named multifeed again, by a different user",
                  headers : function() {
                     return createAuthorizationHeader(user2['accessToken']);
                  },
                  multifeed : multifeed2,
                  expectedHttpStatus : httpStatus.CONFLICT,
                  expectedStatusText : 'error',
                  expectedResponseData : { name : multifeed2['name'].trim() }
               }
            ].forEach(executeTest);

            // validation tests
            [
               {
                  description : "Should fail to create multifeed with no spec field specified",
                  accessToken : function() {
                     return user1['accessToken']
                  },
                  multifeed : {},
                  getExpectedValidationItems : function() {
                     return [
                        {
                           "keyword" : "required",
                           "dataPath" : "",
                           "schemaPath" : "#/required",
                           "params" : {
                              "missingProperty" : "spec"
                           }
                        }
                     ];
                  }
               },
               {
                  description : "Should fail to create multifeed with an empty array of specs specified",
                  accessToken : function() {
                     return user1['accessToken']
                  },
                  multifeed : { spec : [] },
                  getExpectedValidationItems : function() {
                     return [
                        {
                           "keyword" : "minItems",
                           "dataPath" : ".spec",
                           "schemaPath" : "#/properties/spec/minItems"
                        }
                     ];
                  }
               },
               {
                  description : "Should fail to create multifeed if the spec field is not an array",
                  accessToken : function() {
                     return user1['accessToken']
                  },
                  multifeed : { spec : "bogus" },
                  getExpectedValidationItems : function() {
                     return [
                        {
                           "keyword" : "type",
                           "dataPath" : ".spec",
                           "schemaPath" : "#/properties/spec/type",
                           "params" : {
                              "type" : "array"
                           }
                        }
                     ];
                  }
               },
               {
                  description : "Should fail to create multifeed with the spec array containing a single empty object",
                  accessToken : function() {
                     return user1['accessToken']
                  },
                  multifeed : { spec : [{}] },
                  getExpectedValidationItems : function() {
                     return [
                        {
                           "keyword" : "required",
                           "dataPath" : ".spec[0]",
                           "schemaPath" : "#/properties/spec/items/required",
                           "params" : {
                              "missingProperty" : "feeds"
                           }
                        },
                        {
                           "keyword" : "required",
                           "dataPath" : ".spec[0]",
                           "schemaPath" : "#/properties/spec/items/required",
                           "params" : {
                              "missingProperty" : "channels"
                           }
                        }
                     ];
                  }
               },
               {
                  description : "Should fail to create multifeed with the spec array containing an object with feeds and channels fields of the wrong type",
                  accessToken : function() {
                     return user1['accessToken']
                  },
                  multifeed : { spec : [{ feeds : 4, channels : 42 }] },
                  getExpectedValidationItems : function() {
                     return [
                        {
                           "keyword" : "type",
                           "dataPath" : ".spec[0].feeds",
                           "schemaPath" : "#/properties/spec/items/properties/feeds/type",
                           "params" : {
                              "type" : "string"
                           }
                        },
                        {
                           "keyword" : "type",
                           "dataPath" : ".spec[0].channels",
                           "schemaPath" : "#/properties/spec/items/properties/channels/type",
                           "params" : {
                              "type" : "array"
                           }
                        }
                     ];
                  }
               },
               {
                  description : "Should fail to create multifeed with the spec array containing an object with only the feeds field",
                  accessToken : function() {
                     return user1['accessToken']
                  },
                  multifeed : { spec : [{ feeds : "where=outdoor=1,productId=42" }] },
                  getExpectedValidationItems : function() {
                     return [
                        {
                           "keyword" : "required",
                           "dataPath" : ".spec[0]",
                           "schemaPath" : "#/properties/spec/items/required",
                           "params" : {
                              "missingProperty" : "channels"
                           }
                        }
                     ];
                  }
               },
               {
                  description : "Should fail to create multifeed with the spec array containing an object with only the channels field",
                  accessToken : function() {
                     return user1['accessToken']
                  },
                  multifeed : { spec : [{ channels : ["particle_concentration", "humidity"] }] },
                  getExpectedValidationItems : function() {
                     return [
                        {
                           "keyword" : "required",
                           "dataPath" : ".spec[0]",
                           "schemaPath" : "#/properties/spec/items/required",
                           "params" : {
                              "missingProperty" : "feeds"
                           }
                        }
                     ];
                  }
               },
               {
                  description : "Should fail to create multifeed with if the channels array is empty",
                  accessToken : function() {
                     return user1['accessToken']
                  },
                  multifeed : { spec : [{ feeds : "where=outdoor=1,productId=42", channels : [] }] },
                  getExpectedValidationItems : function() {
                     return [
                        {
                           "keyword" : "minItems",
                           "dataPath" : ".spec[0].channels",
                           "schemaPath" : "#/properties/spec/items/properties/channels/minItems"
                        }
                     ];
                  }
               },
               {
                  description : "Should fail to create multifeed with if the channels array contains an empty string",
                  accessToken : function() {
                     return user1['accessToken']
                  },
                  multifeed : {
                     spec : [{
                        feeds : "where=outdoor=1,productId=42",
                        channels : ["humidity", ""]
                     }]
                  },
                  getExpectedValidationItems : function() {
                     return [
                        {
                           "keyword" : "minLength",
                           "dataPath" : ".spec[0].channels[1]",
                           "schemaPath" : "#/properties/spec/items/properties/channels/items/minLength"
                        }
                     ];
                  }
               },
               {
                  description : "Should fail to create multifeed if the channels array contains multiple instances of the same string",
                  accessToken : function() {
                     return user1['accessToken']
                  },
                  multifeed : {
                     spec : [{
                        feeds : "where=outdoor=1,productId=42",
                        channels : ["humidity", "particle_concentration", "humidity"]
                     }]
                  },
                  getExpectedValidationItems : function() {
                     return [
                        {
                           "keyword" : "uniqueItems",
                           "dataPath" : ".spec[0].channels",
                           "schemaPath" : "#/properties/spec/items/properties/channels/uniqueItems"
                        }
                     ];
                  }
               }
            ].forEach(function(test) {
               it(test.description, function(done) {
                  superagent
                        .post(ESDR_MULTIFEEDS_API_URL)
                        .set(createAuthorizationHeader(test['accessToken']))
                        .send(test.multifeed)
                        .end(function(err, res) {
                           should.not.exist(err);
                           should.exist(res);

                           if (test.willDebug) {
                              console.log(JSON.stringify(test.multifeed, null, 3));
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
                           res.body.data.errors.should.have.length(expectedValidationItems.length);
                           res.body.data.errors.forEach(function(validationItem, index) {
                              validationItem.should.have.properties(expectedValidationItems[index]);
                           });

                           done();
                        });
               });
            });
         });   // End Valid Auth
      });   // End Create
   });   // End Multifeeds
});   // End REST API
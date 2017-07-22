var should = require('should');
var flow = require('nimble');
var httpStatus = require('http-status');
var superagent = require('superagent-ls');
var requireNew = require('require-new');
var wipe = require('./fixture-helpers/wipe');
var setup = require('./fixture-helpers/setup');
var createAuthorizationHeader = require('./fixture-helpers/test-utils').createAuthorizationHeader;

var config = require('../config');

const ESDR_API_ROOT_URL = config.get("esdr:apiRootUrl");
const ESDR_MIRROR_REGISTRATIONS_API_URL = ESDR_API_ROOT_URL + "/mirrors/";

const REALM1 = "realm1";
const REALM2 = "realm2";
const REALM3 = "realm3";
const REALM4 = "realm4";
const VALID_BUT_UNKNOWN_MIRROR_TOKEN = "abcde01234abcde01234abcde01234abcde01234abcde01234abcde01234abcd";

describe("REST API", function() {
   var client1 = requireNew('./fixtures/client1.json');
   var client2 = requireNew('./fixtures/client2.json');
   var user1 = requireNew('./fixtures/user1.json');
   var user2 = requireNew('./fixtures/user2.json');
   var user3 = requireNew('./fixtures/user3.json');
   var user4 = requireNew('./fixtures/user4.json');
   var product1 = requireNew('./fixtures/product1.json');
   var product2 = requireNew('./fixtures/product2.json');
   var successfulMirrorRegistrations = [];

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
                  setup.createUser(user2, done);
               },
               function(done) {
                  setup.verifyUser(user2, done);
               },

               function(done) {
                  setup.createUser(user3, done);
               },
               function(done) {
                  setup.verifyUser(user3, done);
               },
               function(done) {
                  setup.authenticateUserWithClient(user3, client1, done);
               },
               function(done) {
                  setup.createUser(user4, done);
               },
               function(done) {
                  setup.verifyUser(user4, done);
               },
               function(done) {
                  setup.authenticateUserWithClient(user4, client1, done);
               },

               function(done) {
                  setup.authenticateUserWithClient(user2, client1, done);
               },
               function(done) {
                  product1.creatorUserId = user1.id;
                  setup.createProduct(product1, done);
               },
               function(done) {
                  product2.creatorUserId = user2.id;
                  setup.createProduct(product2, done);
               }
            ],
            initDone
      );
   });

   describe("Mirror Registrations", function() {
      describe("For Product", function() {
         describe("Create", function() {

            describe("No Authentication", function() {
               it("Should fail to create a mirror registration with no Authorization header specified", function(done) {
                  superagent
                        .post(ESDR_MIRROR_REGISTRATIONS_API_URL + REALM1 + "/registrations/products/" + product1.name)
                        .end(function(err, res) {
                           should.not.exist(err);
                           should.exist(res);

                           res.should.have.property('status', httpStatus.UNAUTHORIZED);

                           done();
                        });
               });
            });   // No Authentication

            describe("Invalid Authentication", function() {
               it("Should fail to create a mirror registration with invalid Authorization Bearer header specified", function(done) {
                  superagent
                        .post(ESDR_MIRROR_REGISTRATIONS_API_URL + REALM1 + "/registrations/products/" + product1.name)
                        .set(createAuthorizationHeader("bogus"))
                        .end(function(err, res) {
                           should.not.exist(err);
                           should.exist(res);

                           res.should.have.property('status', httpStatus.UNAUTHORIZED);

                           done();
                        });
               });
               it("Should fail to create a mirror registration with invalid Authorization Basic header specified", function(done) {
                  superagent
                        .post(ESDR_MIRROR_REGISTRATIONS_API_URL + REALM1 + "/registrations/products/" + product1.name)
                        .auth('bogus', 'sugob')
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
                  var createMirrorRegistrationWithOAuth2ExpectingSuccess = function(realm, user, productNameOrId, callback) {
                     superagent
                           .post(ESDR_MIRROR_REGISTRATIONS_API_URL + realm + "/registrations/products/" + productNameOrId)
                           .set(createAuthorizationHeader(user.accessToken))
                           .end(function(err, res) {
                              should.not.exist(err);
                              should.exist(res);

                              res.should.have.property('status', httpStatus.CREATED);
                              res.should.have.property('body');
                              res.body.should.have.properties({
                                                                 code : httpStatus.CREATED,
                                                                 status : 'success'
                                                              });
                              res.body.should.have.property('data');
                              res.body.data.should.have.property('mirrorToken');

                              successfulMirrorRegistrations.push({
                                                                    realm : realm,
                                                                    mirrorToken : res.body.data['mirrorToken']
                                                                 });

                              callback(null, res.body.data.mirrorToken);
                           });
                  };

                  var createMirrorRegistrationWithBasicAuthExpectingSuccess = function(realm, user, productNameOrId, callback) {
                     superagent
                           .post(ESDR_MIRROR_REGISTRATIONS_API_URL + realm + "/registrations/products/" + productNameOrId)
                           .auth(user.email, user.password)
                           .end(function(err, res) {
                              should.not.exist(err);
                              should.exist(res);

                              res.should.have.property('status', httpStatus.CREATED);
                              res.should.have.property('body');
                              res.body.should.have.properties({
                                                                 code : httpStatus.CREATED,
                                                                 status : 'success'
                                                              });
                              res.body.should.have.property('data');
                              res.body.data.should.have.property('mirrorToken');

                              successfulMirrorRegistrations.push({
                                                                    realm : realm,
                                                                    mirrorToken : res.body.data['mirrorToken']
                                                                 });

                              callback(null, res.body.data.mirrorToken);
                           });
                  };

                  it("Should be able to create mirror registration realm1/user1/product1 with product referenced by name with OAuth2 authentication", function(done) {
                     createMirrorRegistrationWithOAuth2ExpectingSuccess(REALM1, user1, product1.name, done);
                  });
                  it("Should be able to create mirror registration realm2/user1/product1 with product referenced by name with OAuth2 authentication", function(done) {
                     createMirrorRegistrationWithOAuth2ExpectingSuccess(REALM2, user1, product1.name, done);
                  });
                  it("Should be able to create mirror registration realm1/user1/product2 with product referenced by id with OAuth2 authentication", function(done) {
                     createMirrorRegistrationWithOAuth2ExpectingSuccess(REALM1, user1, product2.id, done);
                  });
                  it("Should be able to create mirror registration realm2/user1/product2 with product referenced by id with OAuth2 authentication", function(done) {
                     createMirrorRegistrationWithOAuth2ExpectingSuccess(REALM2, user1, product2.id, done);
                  });
                  it("Should be able to create mirror registration realm1/user2/product1 with product referenced by name with OAuth2 authentication", function(done) {
                     createMirrorRegistrationWithOAuth2ExpectingSuccess(REALM1, user2, product1.name, done);
                  });
                  it("Should be able to create mirror registration realm2/user2/product1 with product referenced by name with OAuth2 authentication", function(done) {
                     createMirrorRegistrationWithOAuth2ExpectingSuccess(REALM2, user2, product1.name, done);
                  });
                  it("Should be able to create mirror registration realm1/user2/product2 with product referenced by id with OAuth2 authentication", function(done) {
                     createMirrorRegistrationWithOAuth2ExpectingSuccess(REALM1, user2, product2.id, done);
                  });
                  it("Should be able to create mirror registration realm2/user2/product2 with product referenced by id with OAuth2 authentication", function(done) {
                     createMirrorRegistrationWithOAuth2ExpectingSuccess(REALM2, user2, product2.id, done);
                  });

                  it("Should be able to create mirror registration realm3/user3/product1 with product referenced by name with HTTP Basic authentication", function(done) {
                     createMirrorRegistrationWithBasicAuthExpectingSuccess(REALM3, user3, product1.name, done);
                  });
                  it("Should be able to create mirror registration realm4/user3/product1 with product referenced by name with HTTP Basic authentication", function(done) {
                     createMirrorRegistrationWithBasicAuthExpectingSuccess(REALM4, user3, product1.name, done);
                  });
                  it("Should be able to create mirror registration realm3/user3/product2 with product referenced by id with HTTP Basic authentication", function(done) {
                     createMirrorRegistrationWithBasicAuthExpectingSuccess(REALM3, user3, product2.id, done);
                  });
                  it("Should be able to create mirror registration realm4/user3/product2 with product referenced by id with HTTP Basic authentication", function(done) {
                     createMirrorRegistrationWithBasicAuthExpectingSuccess(REALM4, user3, product2.id, done);
                  });
                  it("Should be able to create mirror registration realm3/user4/product1 with product referenced by name with HTTP Basic authentication", function(done) {
                     createMirrorRegistrationWithBasicAuthExpectingSuccess(REALM3, user4, product1.name, done);
                  });
                  it("Should be able to create mirror registration realm4/user4/product1 with product referenced by name with HTTP Basic authentication", function(done) {
                     createMirrorRegistrationWithBasicAuthExpectingSuccess(REALM4, user4, product1.name, done);
                  });
                  it("Should be able to create mirror registration realm3/user4/product2 with product referenced by id with HTTP Basic authentication", function(done) {
                     createMirrorRegistrationWithBasicAuthExpectingSuccess(REALM3, user4, product2.id, done);
                  });
                  it("Should be able to create mirror registration realm4/user4/product2 with product referenced by id with HTTP Basic authentication", function(done) {
                     createMirrorRegistrationWithBasicAuthExpectingSuccess(REALM4, user4, product2.id, done);
                  });
               });   // Success

               describe("Failure", function() {
                  describe("Duplicate", function() {
                     var createMirrorRegistrationWithOAuth2ExpectingDuplicate = function(realm, user, productNameOrId, productId, done) {
                        superagent
                              .post(ESDR_MIRROR_REGISTRATIONS_API_URL + realm + "/registrations/products/" + productNameOrId)
                              .set(createAuthorizationHeader(user.accessToken))
                              .end(function(err, res) {
                                 should.not.exist(err);
                                 should.exist(res);

                                 res.should.have.property('status', httpStatus.CONFLICT);
                                 res.should.have.property('body');
                                 res.body.should.have.properties({
                                                                    code : httpStatus.CONFLICT,
                                                                    status : 'error'
                                                                 });
                                 res.body.should.have.property('data', {
                                    realm : realm,
                                    userId : user.id,
                                    productId : productId
                                 });

                                 done();
                              });
                     };

                     var createMirrorRegistrationWithBasicAuthExpectingDuplicate = function(realm, user, productNameOrId, productId, done) {
                        superagent
                              .post(ESDR_MIRROR_REGISTRATIONS_API_URL + realm + "/registrations/products/" + productNameOrId)
                              .auth(user.email, user.password)
                              .end(function(err, res) {
                                 should.not.exist(err);
                                 should.exist(res);

                                 res.should.have.property('status', httpStatus.CONFLICT);
                                 res.should.have.property('body');
                                 res.body.should.have.properties({
                                                                    code : httpStatus.CONFLICT,
                                                                    status : 'error'
                                                                 });
                                 res.body.should.have.property('data', {
                                    realm : realm,
                                    userId : user.id,
                                    productId : productId
                                 });

                                 done();
                              });
                     };

                     it("Should fail to create mirror registration realm1/user1/product1 with product referenced by name with OAuth2 authentication", function(done) {
                        createMirrorRegistrationWithOAuth2ExpectingDuplicate(REALM1, user1, product1.name, product1.id, done);
                     });
                     it("Should fail to create mirror registration realm2/user1/product1 with product referenced by name with OAuth2 authentication", function(done) {
                        createMirrorRegistrationWithOAuth2ExpectingDuplicate(REALM2, user1, product1.name, product1.id, done);
                     });
                     it("Should fail to create mirror registration realm1/user1/product2 with product referenced by id with OAuth2 authentication", function(done) {
                        createMirrorRegistrationWithOAuth2ExpectingDuplicate(REALM1, user1, product2.id, product2.id, done);
                     });
                     it("Should fail to create mirror registration realm2/user1/product2 with product referenced by id with OAuth2 authentication", function(done) {
                        createMirrorRegistrationWithOAuth2ExpectingDuplicate(REALM2, user1, product2.id, product2.id, done);
                     });
                     it("Should fail to create mirror registration realm1/user2/product1 with product referenced by name with OAuth2 authentication", function(done) {
                        createMirrorRegistrationWithOAuth2ExpectingDuplicate(REALM1, user2, product1.name, product1.id, done);
                     });
                     it("Should fail to create mirror registration realm2/user2/product1 with product referenced by name with OAuth2 authentication", function(done) {
                        createMirrorRegistrationWithOAuth2ExpectingDuplicate(REALM2, user2, product1.name, product1.id, done);
                     });
                     it("Should fail to create mirror registration realm1/user2/product2 with product referenced by id with OAuth2 authentication", function(done) {
                        createMirrorRegistrationWithOAuth2ExpectingDuplicate(REALM1, user2, product2.id, product2.id, done);
                     });
                     it("Should fail to create mirror registration realm2/user2/product2 with product referenced by id with OAuth2 authentication", function(done) {
                        createMirrorRegistrationWithOAuth2ExpectingDuplicate(REALM2, user2, product2.id, product2.id, done);
                     });

                     it("Should fail to create mirror registration realm3/user3/product1 with product referenced by name with HTTP Basic authentication", function(done) {
                        createMirrorRegistrationWithBasicAuthExpectingDuplicate(REALM3, user3, product1.name, product1.id, done);
                     });
                     it("Should fail to create mirror registration realm4/user3/product1 with product referenced by name with HTTP Basic authentication", function(done) {
                        createMirrorRegistrationWithBasicAuthExpectingDuplicate(REALM4, user3, product1.name, product1.id, done);
                     });
                     it("Should fail to create mirror registration realm3/user3/product2 with product referenced by id with HTTP Basic authentication", function(done) {
                        createMirrorRegistrationWithBasicAuthExpectingDuplicate(REALM3, user3, product2.id, product2.id, done);
                     });
                     it("Should fail to create mirror registration realm4/user3/product2 with product referenced by id with HTTP Basic authentication", function(done) {
                        createMirrorRegistrationWithBasicAuthExpectingDuplicate(REALM4, user3, product2.id, product2.id, done);
                     });
                     it("Should fail to create mirror registration realm3/user4/product1 with product referenced by name with HTTP Basic authentication", function(done) {
                        createMirrorRegistrationWithBasicAuthExpectingDuplicate(REALM3, user4, product1.name, product1.id, done);
                     });
                     it("Should fail to create mirror registration realm4/user4/product1 with product referenced by name with HTTP Basic authentication", function(done) {
                        createMirrorRegistrationWithBasicAuthExpectingDuplicate(REALM4, user4, product1.name, product1.id, done);
                     });
                     it("Should fail to create mirror registration realm3/user4/product2 with product referenced by id with HTTP Basic authentication", function(done) {
                        createMirrorRegistrationWithBasicAuthExpectingDuplicate(REALM3, user4, product2.id, product2.id, done);
                     });
                     it("Should fail to create mirror registration realm4/user4/product2 with product referenced by id with HTTP Basic authentication", function(done) {
                        createMirrorRegistrationWithBasicAuthExpectingDuplicate(REALM4, user4, product2.id, product2.id, done);
                     });

                  });   // Duplicate

                  describe("Invalid Realm", function() {
                     var createMirrorRegistrationWithInvalidRealm = function(realm, expectedValidationErrorProperties, done) {
                        superagent
                              .post(ESDR_MIRROR_REGISTRATIONS_API_URL + realm + "/registrations/products/" + product1.id)
                              .auth(user1.email, user1.password)
                              .end(function(err, res) {
                                 should.not.exist(err);
                                 should.exist(res);

                                 res.should.have.property('status', httpStatus.UNPROCESSABLE_ENTITY);
                                 res.should.have.property('body');
                                 res.body.should.have.properties({
                                                                    code : httpStatus.UNPROCESSABLE_ENTITY,
                                                                    status : 'error'
                                                                 });
                                 res.body.should.have.property('data');
                                 res.body.data.should.have.length(1);
                                 res.body.data[0].should.have.properties(expectedValidationErrorProperties);

                                 done();
                              });
                     };

                     it("Should fail to create mirror registration with invalid realm (too short)", function(done) {
                        createMirrorRegistrationWithInvalidRealm("X",
                                                                 {
                                                                    "instanceContext" : "#/realm",
                                                                    "constraintName" : "minLength",
                                                                    "constraintValue" : 2,
                                                                    "testedValue" : 1,
                                                                    "kind" : "StringValidationError"
                                                                 },
                                                                 done);
                     });
                     it("Should fail to create mirror registration with invalid realm (too long)", function(done) {
                        createMirrorRegistrationWithInvalidRealm("realm012345678901234567890123456789012345678901234567890123456789",
                                                                 {
                                                                    "instanceContext" : "#/realm",
                                                                    "constraintName" : "maxLength",
                                                                    "constraintValue" : 64,
                                                                    "testedValue" : 65,
                                                                    "kind" : "StringValidationError"
                                                                 },
                                                                 done);
                     });
                     it("Should fail to create mirror registration with invalid realm (must start with alphanumeric, not .)", function(done) {
                        createMirrorRegistrationWithInvalidRealm(".realm",
                                                                 {
                                                                    "instanceContext" : "#/realm",
                                                                    "constraintName" : "pattern",
                                                                    "kind" : "StringValidationError"
                                                                 },
                                                                 done);
                     });
                     it("Should fail to create mirror registration with invalid realm (must start with alphanumeric, not -)", function(done) {
                        createMirrorRegistrationWithInvalidRealm("-realm",
                                                                 {
                                                                    "instanceContext" : "#/realm",
                                                                    "constraintName" : "pattern",
                                                                    "kind" : "StringValidationError"
                                                                 },
                                                                 done);
                     });
                     it("Should fail to create mirror registration with invalid realm (must start with alphanumeric, not _)", function(done) {
                        createMirrorRegistrationWithInvalidRealm("_realm",
                                                                 {
                                                                    "instanceContext" : "#/realm",
                                                                    "constraintName" : "pattern",
                                                                    "kind" : "StringValidationError"
                                                                 },
                                                                 done);
                     });
                     it("Should fail to create mirror registration with invalid realm (limited to alphanumeric, underscore, hyphen, and period)", function(done) {
                        createMirrorRegistrationWithInvalidRealm("rea$lm",
                                                                 {
                                                                    "instanceContext" : "#/realm",
                                                                    "constraintName" : "pattern",
                                                                    "kind" : "StringValidationError"
                                                                 },
                                                                 done);
                     });
                     it("Should fail to create mirror registration with invalid realm (limited to alphanumeric, underscore, hyphen, and period)", function(done) {
                        createMirrorRegistrationWithInvalidRealm("my cool realm",
                                                                 {
                                                                    "instanceContext" : "#/realm",
                                                                    "constraintName" : "pattern",
                                                                    "kind" : "StringValidationError"
                                                                 },
                                                                 done);
                     });
                  });   // Invalid Realm

                  describe("Invalid Product", function() {
                     var createMirrorRegistrationWithInvalidProduct = function(productNameOrId, done) {
                        superagent
                              .post(ESDR_MIRROR_REGISTRATIONS_API_URL + REALM1 + "/registrations/products/" + productNameOrId)
                              .auth(user1.email, user1.password)
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
                     it("Should fail to create mirror registration with invalid product (unknown id)", function(done) {
                        createMirrorRegistrationWithInvalidProduct(0, done);
                     });
                     it("Should fail to create mirror registration with invalid product (unknown name)", function(done) {
                        createMirrorRegistrationWithInvalidProduct("bogus", done);
                     });
                  });   // Invalid Product

               });   // Failure
            });   // Valid Authentication
         });   // Create

         describe("Find", function() {
            describe("By Realm, User, and Product", function() {
               describe("No Authentication", function() {
                  it("Should fail to find a mirror registration with no Authorization header specified", function(done) {
                     superagent
                           .get(ESDR_MIRROR_REGISTRATIONS_API_URL + REALM1 + "/registrations/products/" + product1.id)
                           .end(function(err, res) {
                              should.not.exist(err);
                              should.exist(res);

                              res.should.have.property('status', httpStatus.UNAUTHORIZED);

                              done();
                           });
                  });
               });   // No Authentication
               describe("Invalid Authentication", function() {
                  it("Should fail to find a mirror registration with invalid Authorization Bearer header specified", function(done) {
                     superagent
                           .get(ESDR_MIRROR_REGISTRATIONS_API_URL + REALM1 + "/registrations/products/" + product1.name)
                           .set(createAuthorizationHeader("bogus"))
                           .end(function(err, res) {
                              should.not.exist(err);
                              should.exist(res);

                              res.should.have.property('status', httpStatus.UNAUTHORIZED);

                              done();
                           });
                  });
                  it("Should fail to find a mirror registration with invalid Authorization Basic header specified", function(done) {
                     superagent
                           .get(ESDR_MIRROR_REGISTRATIONS_API_URL + REALM1 + "/registrations/products/" + product1.name)
                           .auth('bogus', 'sugob')
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
                     var findMirrorRegistrationWithOAuth2ExpectingSuccess = function(realm, user, product, nameOrId, expectedMirrorToken, done, willDebug) {
                        superagent
                              .get(ESDR_MIRROR_REGISTRATIONS_API_URL + realm + "/registrations/products/" + product[nameOrId])
                              .set(createAuthorizationHeader(user.accessToken))
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
                                 res.body.data.should.have.properties({
                                                                         realm : realm,
                                                                         userId : user.id,
                                                                         productId : product.id,
                                                                         mirrorToken : expectedMirrorToken
                                                                      });

                                 done();
                              });
                     };
                     var findMirrorRegistrationWithBasicAuthExpectingSuccess = function(realm, user, product, nameOrId, expectedMirrorToken, done, willDebug) {
                        superagent
                              .get(ESDR_MIRROR_REGISTRATIONS_API_URL + realm + "/registrations/products/" + product[nameOrId])
                              .auth(user.email, user.password)
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
                                 res.body.data.should.have.properties({
                                                                         realm : realm,
                                                                         userId : user.id,
                                                                         productId : product.id,
                                                                         mirrorToken : expectedMirrorToken
                                                                      });

                                 done();
                              });
                     };

                     it("Should be able to find mirror registration realm1/user1/product1 with product referenced by name with OAuth2 authentication", function(done) {
                        findMirrorRegistrationWithOAuth2ExpectingSuccess(REALM1,
                                                                         user1,
                                                                         product1,
                                                                         'name',
                                                                         successfulMirrorRegistrations[0].mirrorToken,
                                                                         done);
                     });
                     it("Should be able to find mirror registration realm2/user1/product1 with product referenced by name with OAuth2 authentication", function(done) {
                        findMirrorRegistrationWithOAuth2ExpectingSuccess(REALM2,
                                                                         user1,
                                                                         product1,
                                                                         'name',
                                                                         successfulMirrorRegistrations[1].mirrorToken,
                                                                         done);
                     });
                     it("Should be able to find mirror registration realm1/user1/product2 with product referenced by id with OAuth2 authentication", function(done) {
                        findMirrorRegistrationWithOAuth2ExpectingSuccess(REALM1,
                                                                         user1,
                                                                         product2,
                                                                         'id',
                                                                         successfulMirrorRegistrations[2].mirrorToken,
                                                                         done);
                     });
                     it("Should be able to find mirror registration realm2/user1/product2 with product referenced by id with OAuth2 authentication", function(done) {
                        findMirrorRegistrationWithOAuth2ExpectingSuccess(REALM2,
                                                                         user1,
                                                                         product2,
                                                                         'id',
                                                                         successfulMirrorRegistrations[3].mirrorToken,
                                                                         done);
                     });

                     it("Should be able to find mirror registration realm1/user2/product1 with product referenced by name with OAuth2 authentication", function(done) {
                        findMirrorRegistrationWithOAuth2ExpectingSuccess(REALM1,
                                                                         user2,
                                                                         product1,
                                                                         'name',
                                                                         successfulMirrorRegistrations[4].mirrorToken,
                                                                         done);
                     });
                     it("Should be able to find mirror registration realm2/user2/product1 with product referenced by name with OAuth2 authentication", function(done) {
                        findMirrorRegistrationWithOAuth2ExpectingSuccess(REALM2,
                                                                         user2,
                                                                         product1,
                                                                         'name',
                                                                         successfulMirrorRegistrations[5].mirrorToken,
                                                                         done);
                     });
                     it("Should be able to find mirror registration realm1/user2/product2 with product referenced by id with OAuth2 authentication", function(done) {
                        findMirrorRegistrationWithOAuth2ExpectingSuccess(REALM1,
                                                                         user2,
                                                                         product2,
                                                                         'id',
                                                                         successfulMirrorRegistrations[6].mirrorToken,
                                                                         done);
                     });
                     it("Should be able to find mirror registration realm2/user2/product2 with product referenced by id with OAuth2 authentication", function(done) {
                        findMirrorRegistrationWithOAuth2ExpectingSuccess(REALM2,
                                                                         user2,
                                                                         product2,
                                                                         'id',
                                                                         successfulMirrorRegistrations[7].mirrorToken,
                                                                         done);
                     });

                     it("Should be able to find mirror registration realm3/user3/product1 with product referenced by name with HTTP Basic authentication", function(done) {
                        findMirrorRegistrationWithBasicAuthExpectingSuccess(REALM3,
                                                                            user3,
                                                                            product1,
                                                                            'name',
                                                                            successfulMirrorRegistrations[8].mirrorToken,
                                                                            done);
                     });
                     it("Should be able to find mirror registration realm4/user3/product1 with product referenced by name with HTTP Basic authentication", function(done) {
                        findMirrorRegistrationWithBasicAuthExpectingSuccess(REALM4,
                                                                            user3,
                                                                            product1,
                                                                            'name',
                                                                            successfulMirrorRegistrations[9].mirrorToken,
                                                                            done);
                     });
                     it("Should be able to find mirror registration realm3/user3/product2 with product referenced by id with HTTP Basic authentication", function(done) {
                        findMirrorRegistrationWithBasicAuthExpectingSuccess(REALM3,
                                                                            user3,
                                                                            product2,
                                                                            'id',
                                                                            successfulMirrorRegistrations[10].mirrorToken,
                                                                            done);
                     });
                     it("Should be able to find mirror registration realm4/user3/product2 with product referenced by id with HTTP Basic authentication", function(done) {
                        findMirrorRegistrationWithBasicAuthExpectingSuccess(REALM4,
                                                                            user3,
                                                                            product2,
                                                                            'id',
                                                                            successfulMirrorRegistrations[11].mirrorToken,
                                                                            done);
                     });

                     it("Should be able to find mirror registration realm3/user4/product1 with product referenced by name with HTTP Basic authentication", function(done) {
                        findMirrorRegistrationWithBasicAuthExpectingSuccess(REALM3,
                                                                            user4,
                                                                            product1,
                                                                            'name',
                                                                            successfulMirrorRegistrations[12].mirrorToken,
                                                                            done);
                     });
                     it("Should be able to find mirror registration realm4/user4/product1 with product referenced by name with HTTP Basic authentication", function(done) {
                        findMirrorRegistrationWithBasicAuthExpectingSuccess(REALM4,
                                                                            user4,
                                                                            product1,
                                                                            'name',
                                                                            successfulMirrorRegistrations[13].mirrorToken,
                                                                            done);
                     });
                     it("Should be able to find mirror registration realm3/user4/product2 with product referenced by id with HTTP Basic authentication", function(done) {
                        findMirrorRegistrationWithBasicAuthExpectingSuccess(REALM3,
                                                                            user4,
                                                                            product2,
                                                                            'id',
                                                                            successfulMirrorRegistrations[14].mirrorToken,
                                                                            done);
                     });
                     it("Should be able to find mirror registration realm4/user4/product2 with product referenced by id with HTTP Basic authentication", function(done) {
                        findMirrorRegistrationWithBasicAuthExpectingSuccess(REALM4,
                                                                            user4,
                                                                            product2,
                                                                            'id',
                                                                            successfulMirrorRegistrations[15].mirrorToken,
                                                                            done);
                     });

                     it("Should be able to filter returned fields", function(done) {
                        superagent
                              .get(ESDR_MIRROR_REGISTRATIONS_API_URL + REALM1 + "/registrations/products/" + product1.id + "?fields=realm,userId,mirrorToken,lastMirrorAttemptSecs,lastMirrorSuccessSecs,lastMirroredMaxTimeSecs")
                              .auth(user1.email, user1.password)
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
                                 res.body.data.should.have.properties({
                                                                         realm : REALM1,
                                                                         userId : user1.id,
                                                                         mirrorToken : successfulMirrorRegistrations[0].mirrorToken,
                                                                      });
                                 res.body.data.should.have.property('lastMirrorAttemptSecs');
                                 res.body.data.should.have.property('lastMirrorSuccessSecs');
                                 res.body.data.should.have.property('lastMirroredMaxTimeSecs');

                                 res.body.data.should.not.have.property('id');
                                 res.body.data.should.not.have.property('productId');
                                 res.body.data.should.not.have.property('deviceId');
                                 res.body.data.should.not.have.property('feedId');
                                 res.body.data.should.not.have.property('created');
                                 res.body.data.should.not.have.property('modified');

                                 done();
                              });
                     });

                  });   // Success
                  describe("Failure", function() {
                     var findMirrorRegistrationExpectingFailure = function(realm, user, product, nameOrId, done, willDebug) {
                        superagent
                              .get(ESDR_MIRROR_REGISTRATIONS_API_URL + realm + "/registrations/products/" + product[nameOrId])
                              .set(createAuthorizationHeader(user.accessToken))
                              .end(function(err, res) {
                                 should.not.exist(err);
                                 should.exist(res);

                                 if (willDebug) {
                                    console.log(JSON.stringify(res.body, null, 3));
                                 }
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

                     it("Should be fail to find mirror registration realm1/user3/product1", function(done) {
                        findMirrorRegistrationExpectingFailure(REALM1,
                                                               user3,
                                                               product1,
                                                               'id',
                                                               done);
                     });
                     it("Should be fail to find mirror registration realm2/user4/product1", function(done) {
                        findMirrorRegistrationExpectingFailure(REALM2,
                                                               user4,
                                                               product1,
                                                               'id',
                                                               done);
                     });
                     it("Should be fail to find mirror registration realm3/user1/product1", function(done) {
                        findMirrorRegistrationExpectingFailure(REALM3,
                                                               user1,
                                                               product1,
                                                               'id',
                                                               done);
                     });
                     it("Should be fail to find mirror registration realm4/user2/product2", function(done) {
                        findMirrorRegistrationExpectingFailure(REALM4,
                                                               user2,
                                                               product2,
                                                               'id',
                                                               done);
                     });
                  });   // Failure
               });   // Valid Authentication
            });   // By Realm, User, and Product

            describe("By Realm and Mirror Token", function() {
               describe("Success", function() {
                  var findMirrorRegistrationByRealmAndToken = function(realm, user, product, mirrorToken, done, willDebug) {
                     superagent
                           .get(ESDR_MIRROR_REGISTRATIONS_API_URL + realm + "/registrations/" + mirrorToken)
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
                              res.body.data.should.have.properties({
                                                                      realm : realm,
                                                                      userId : user.id,
                                                                      productId : product.id,
                                                                      mirrorToken : mirrorToken
                                                                   });

                              done();
                           });
                  };

                  it("Should be able to find mirror registration realm1/user1/product1 referenced by realm and mirror token", function(done) {
                     findMirrorRegistrationByRealmAndToken(REALM1,
                                                           user1,
                                                           product1,
                                                           successfulMirrorRegistrations[0].mirrorToken,
                                                           done);
                  });
                  it("Should be able to find mirror registration realm2/user1/product1 referenced by realm and mirror token", function(done) {
                     findMirrorRegistrationByRealmAndToken(REALM2,
                                                           user1,
                                                           product1,
                                                           successfulMirrorRegistrations[1].mirrorToken,
                                                           done);
                  });
                  it("Should be able to find mirror registration realm1/user1/product2 referenced by realm and mirror token", function(done) {
                     findMirrorRegistrationByRealmAndToken(REALM1,
                                                           user1,
                                                           product2,
                                                           successfulMirrorRegistrations[2].mirrorToken,
                                                           done);
                  });
                  it("Should be able to find mirror registration realm2/user1/product2 referenced by realm and mirror token", function(done) {
                     findMirrorRegistrationByRealmAndToken(REALM2,
                                                           user1,
                                                           product2,
                                                           successfulMirrorRegistrations[3].mirrorToken,
                                                           done);
                  });

                  it("Should be able to find mirror registration realm1/user2/product1 referenced by realm and mirror token", function(done) {
                     findMirrorRegistrationByRealmAndToken(REALM1,
                                                           user2,
                                                           product1,
                                                           successfulMirrorRegistrations[4].mirrorToken,
                                                           done);
                  });
                  it("Should be able to find mirror registration realm2/user2/product1 referenced by realm and mirror token", function(done) {
                     findMirrorRegistrationByRealmAndToken(REALM2,
                                                           user2,
                                                           product1,
                                                           successfulMirrorRegistrations[5].mirrorToken,
                                                           done);
                  });
                  it("Should be able to find mirror registration realm1/user2/product2 referenced by realm and mirror token", function(done) {
                     findMirrorRegistrationByRealmAndToken(REALM1,
                                                           user2,
                                                           product2,
                                                           successfulMirrorRegistrations[6].mirrorToken,
                                                           done);
                  });
                  it("Should be able to find mirror registration realm2/user2/product2 referenced by realm and mirror token", function(done) {
                     findMirrorRegistrationByRealmAndToken(REALM2,
                                                           user2,
                                                           product2,
                                                           successfulMirrorRegistrations[7].mirrorToken,
                                                           done);
                  });

                  it("Should be able to find mirror registration realm3/user3/product1 referenced by realm and mirror token", function(done) {
                     findMirrorRegistrationByRealmAndToken(REALM3,
                                                           user3,
                                                           product1,
                                                           successfulMirrorRegistrations[8].mirrorToken,
                                                           done);
                  });
                  it("Should be able to find mirror registration realm4/user3/product1 referenced by realm and mirror token", function(done) {
                     findMirrorRegistrationByRealmAndToken(REALM4,
                                                           user3,
                                                           product1,
                                                           successfulMirrorRegistrations[9].mirrorToken,
                                                           done);
                  });
                  it("Should be able to find mirror registration realm3/user3/product2 referenced by realm and mirror token", function(done) {
                     findMirrorRegistrationByRealmAndToken(REALM3,
                                                           user3,
                                                           product2,
                                                           successfulMirrorRegistrations[10].mirrorToken,
                                                           done);
                  });
                  it("Should be able to find mirror registration realm4/user3/product2 referenced by realm and mirror token", function(done) {
                     findMirrorRegistrationByRealmAndToken(REALM4,
                                                           user3,
                                                           product2,
                                                           successfulMirrorRegistrations[11].mirrorToken,
                                                           done);
                  });

                  it("Should be able to find mirror registration realm3/user4/product1 referenced by realm and mirror token", function(done) {
                     findMirrorRegistrationByRealmAndToken(REALM3,
                                                           user4,
                                                           product1,
                                                           successfulMirrorRegistrations[12].mirrorToken,
                                                           done);
                  });
                  it("Should be able to find mirror registration realm4/user4/product1 referenced by realm and mirror token", function(done) {
                     findMirrorRegistrationByRealmAndToken(REALM4,
                                                           user4,
                                                           product1,
                                                           successfulMirrorRegistrations[13].mirrorToken,
                                                           done);
                  });
                  it("Should be able to find mirror registration realm3/user4/product2 referenced by realm and mirror token", function(done) {
                     findMirrorRegistrationByRealmAndToken(REALM3,
                                                           user4,
                                                           product2,
                                                           successfulMirrorRegistrations[14].mirrorToken,
                                                           done);
                  });
                  it("Should be able to find mirror registration realm4/user4/product2 referenced by realm and mirror token", function(done) {
                     findMirrorRegistrationByRealmAndToken(REALM4,
                                                           user4,
                                                           product2,
                                                           successfulMirrorRegistrations[15].mirrorToken,
                                                           done);
                  });

                  it("Should be able to filter returned fields", function(done) {
                     superagent
                           .get(ESDR_MIRROR_REGISTRATIONS_API_URL + REALM1 + "/registrations/" + successfulMirrorRegistrations[0].mirrorToken + "?fields=realm,userId,mirrorToken,lastMirrorAttemptSecs,lastMirrorSuccessSecs,lastMirroredMaxTimeSecs")
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
                              res.body.data.should.have.properties({
                                                                      realm : REALM1,
                                                                      userId : user1.id,
                                                                      mirrorToken : successfulMirrorRegistrations[0].mirrorToken,
                                                                   });
                              res.body.data.should.have.property('lastMirrorAttemptSecs');
                              res.body.data.should.have.property('lastMirrorSuccessSecs');
                              res.body.data.should.have.property('lastMirroredMaxTimeSecs');

                              res.body.data.should.not.have.property('id');
                              res.body.data.should.not.have.property('productId');
                              res.body.data.should.not.have.property('deviceId');
                              res.body.data.should.not.have.property('feedId');
                              res.body.data.should.not.have.property('created');
                              res.body.data.should.not.have.property('modified');

                              done();
                           });
                  });
               });   // Success

               describe("Failure", function() {
                  var findMirrorRegistration = function(realm, mirrorToken, done, willDebug) {
                     superagent
                           .get(ESDR_MIRROR_REGISTRATIONS_API_URL + realm + "/registrations/" + mirrorToken)
                           .end(function(err, res) {
                              should.not.exist(err);
                              should.exist(res);

                              if (willDebug) {
                                 console.log(JSON.stringify(res.body, null, 3));
                              }
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
                  var findMirrorRegistrationWithValidationError = function(realm, mirrorToken, done, willDebug) {
                     superagent
                           .get(ESDR_MIRROR_REGISTRATIONS_API_URL + realm + "/registrations/" + mirrorToken)
                           .end(function(err, res) {
                              should.not.exist(err);
                              should.exist(res);

                              if (willDebug) {
                                 console.log(JSON.stringify(res.body, null, 3));
                              }
                              res.should.have.property('status', httpStatus.UNPROCESSABLE_ENTITY);
                              res.should.have.property('body');
                              res.body.should.have.properties({
                                                                 code : httpStatus.UNPROCESSABLE_ENTITY,
                                                                 status : 'error'
                                                              });
                              res.body.should.have.property('data');

                              done();
                           });
                  };
                  it("Should fail to find mirror registration referenced by known realm and unknown mirror token", function(done) {
                     findMirrorRegistration(REALM1,
                                            VALID_BUT_UNKNOWN_MIRROR_TOKEN,
                                            done);
                  });
                  it("Should fail to find mirror registration referenced by unknown realm and known mirror token", function(done) {
                     findMirrorRegistration("bogus",
                                            successfulMirrorRegistrations[0].mirrorToken,
                                            done);
                  });
                  it("Should fail to find mirror registration referenced by unknown realm and unknown mirror token", function(done) {
                     findMirrorRegistration("bogus",
                                            VALID_BUT_UNKNOWN_MIRROR_TOKEN,
                                            done);
                  });
                  it("Should fail to find mirror registration referenced by known realm and unknown mirror token", function(done) {
                     findMirrorRegistration(REALM1,
                                            "bogus",
                                            done);
                  });
                  it("Should fail to find mirror registration referenced by invalid realm and known mirror token", function(done) {
                     findMirrorRegistrationWithValidationError("X",
                                                               successfulMirrorRegistrations[0].mirrorToken,
                                                               done);
                  });
                  it("Should fail to find mirror registration referenced by invalid realm and unknown mirror token", function(done) {
                     findMirrorRegistrationWithValidationError("X",
                                                               "bogus",
                                                               done);
                  });
               });   // Failure
            });   // By Realm and Mirror Token
         });   // Find

         describe("Delete", function() {
            describe("Failure", function() {
               var deleteFailedDueToValidationError = function(realm, mirrorToken, expectedDataItems, done) {
                  superagent
                        .del(ESDR_MIRROR_REGISTRATIONS_API_URL + realm + "/registrations/" + mirrorToken)
                        .end(function(err, res) {
                           should.not.exist(err);
                           should.exist(res);

                           res.should.have.property('status', httpStatus.UNPROCESSABLE_ENTITY);
                           res.should.have.property('body');
                           res.body.should.have.properties({
                                                              code : httpStatus.UNPROCESSABLE_ENTITY,
                                                              status : 'error'
                                                           });

                           if (expectedDataItems) {
                              res.body.should.have.property('data');
                              res.body.data.should.have.length(expectedDataItems.length);
                              expectedDataItems.forEach(function(dataItem, index) {
                                 res.body.data[index].should.have.properties(dataItem);
                              });
                           }

                           done();
                        });
               };
               it("Should fail to delete mirror registration with an invalid realm (too short)", function(done) {
                  deleteFailedDueToValidationError("X",
                                                   VALID_BUT_UNKNOWN_MIRROR_TOKEN,
                                                   [
                                                      {
                                                         "instanceContext" : "#/realm",
                                                         "constraintName" : "minLength",
                                                         "constraintValue" : 2,
                                                         "testedValue" : 1,
                                                         "kind" : "StringValidationError"
                                                      }
                                                   ],
                                                   done);
               });
               it("Should fail to delete mirror registration with an invalid realm (too long)", function(done) {
                  deleteFailedDueToValidationError("realm012345678901234567890123456789012345678901234567890123456789",
                                                   VALID_BUT_UNKNOWN_MIRROR_TOKEN,
                                                   [
                                                      {
                                                         "instanceContext" : "#/realm",
                                                         "constraintName" : "maxLength",
                                                         "constraintValue" : 64,
                                                         "testedValue" : 65,
                                                         "kind" : "StringValidationError"
                                                      }
                                                   ],
                                                   done);
               });
               it("Should fail to delete mirror registration with an invalid realm (limited to alphanumeric, underscore, hyphen, and period)", function(done) {
                  deleteFailedDueToValidationError("my cool realm",
                                                   VALID_BUT_UNKNOWN_MIRROR_TOKEN,
                                                   [
                                                      {
                                                         "instanceContext" : "#/realm",
                                                         "constraintName" : "pattern",
                                                         "kind" : "StringValidationError"
                                                      }
                                                   ],
                                                   done);
               });
            });   // Failure

            describe("Success", function() {
               var doDelete = function(realm, mirrorToken, expectedRegistrationsDeleted, done) {
                  superagent
                        .del(ESDR_MIRROR_REGISTRATIONS_API_URL + realm + "/registrations/" + mirrorToken)
                        .end(function(err, res) {
                           should.not.exist(err);
                           should.exist(res);

                           res.should.have.property('status', httpStatus.OK);
                           res.should.have.property('body');
                           res.body.should.have.properties({
                                                              code : httpStatus.OK,
                                                              status : 'success'
                                                           });

                           res.body.should.have.property('data', { registrationsDeleted : expectedRegistrationsDeleted });

                           done();
                        });
               };
               it("Should return success (but not actually delete anything) when requesting deletion of mirror registration with unknown realm and unknown mirror token", function(done) {
                  doDelete("bogus-realm", VALID_BUT_UNKNOWN_MIRROR_TOKEN, 0, done);
               });
               it("Should return success (but not actually delete anything) when requesting deletion of mirror registration with unknown realm but known mirror token", function(done) {
                  doDelete("bogus-realm", successfulMirrorRegistrations[0]['mirrorToken'], 0, done);
               });
               it("Should return success (but not actually delete anything) when requesting deletion of mirror registration with known realm but unknown mirror token", function(done) {
                  doDelete(successfulMirrorRegistrations[0]['realm'], VALID_BUT_UNKNOWN_MIRROR_TOKEN, 0, done);
               });
               it("Should return success (but not actually delete anything) when requesting deletion of mirror registration with known realm and known mirror token from a different realm", function(done) {
                  doDelete(successfulMirrorRegistrations[0]['realm'], successfulMirrorRegistrations[1]['mirrorToken'], 0, done);
               });

               it("Should return success for deleting known realm and mirror token combo (1/16)", function(done) {
                  doDelete(successfulMirrorRegistrations[0]['realm'], successfulMirrorRegistrations[0]['mirrorToken'], 1, done);
               });
               it("Should return success for deleting known realm and mirror token combo (2/16)", function(done) {
                  doDelete(successfulMirrorRegistrations[1]['realm'], successfulMirrorRegistrations[1]['mirrorToken'], 1, done);
               });
               it("Should return success for deleting known realm and mirror token combo (3/16)", function(done) {
                  doDelete(successfulMirrorRegistrations[2]['realm'], successfulMirrorRegistrations[2]['mirrorToken'], 1, done);
               });
               it("Should return success for deleting known realm and mirror token combo (4/16)", function(done) {
                  doDelete(successfulMirrorRegistrations[3]['realm'], successfulMirrorRegistrations[3]['mirrorToken'], 1, done);
               });
               it("Should return success for deleting known realm and mirror token combo (5/16)", function(done) {
                  doDelete(successfulMirrorRegistrations[4]['realm'], successfulMirrorRegistrations[4]['mirrorToken'], 1, done);
               });
               it("Should return success for deleting known realm and mirror token combo (6/16)", function(done) {
                  doDelete(successfulMirrorRegistrations[5]['realm'], successfulMirrorRegistrations[5]['mirrorToken'], 1, done);
               });
               it("Should return success for deleting known realm and mirror token combo (7/16)", function(done) {
                  doDelete(successfulMirrorRegistrations[6]['realm'], successfulMirrorRegistrations[6]['mirrorToken'], 1, done);
               });
               it("Should return success for deleting known realm and mirror token combo (8/16)", function(done) {
                  doDelete(successfulMirrorRegistrations[7]['realm'], successfulMirrorRegistrations[7]['mirrorToken'], 1, done);
               });
               it("Should return success for deleting known realm and mirror token combo (9/16)", function(done) {
                  doDelete(successfulMirrorRegistrations[8]['realm'], successfulMirrorRegistrations[8]['mirrorToken'], 1, done);
               });
               it("Should return success for deleting known realm and mirror token combo (10/16)", function(done) {
                  doDelete(successfulMirrorRegistrations[9]['realm'], successfulMirrorRegistrations[9]['mirrorToken'], 1, done);
               });
               it("Should return success for deleting known realm and mirror token combo (11/16)", function(done) {
                  doDelete(successfulMirrorRegistrations[10]['realm'], successfulMirrorRegistrations[10]['mirrorToken'], 1, done);
               });
               it("Should return success for deleting known realm and mirror token combo (12/16)", function(done) {
                  doDelete(successfulMirrorRegistrations[11]['realm'], successfulMirrorRegistrations[11]['mirrorToken'], 1, done);
               });
               it("Should return success for deleting known realm and mirror token combo (13/16)", function(done) {
                  doDelete(successfulMirrorRegistrations[12]['realm'], successfulMirrorRegistrations[12]['mirrorToken'], 1, done);
               });
               it("Should return success for deleting known realm and mirror token combo (14/16)", function(done) {
                  doDelete(successfulMirrorRegistrations[13]['realm'], successfulMirrorRegistrations[13]['mirrorToken'], 1, done);
               });
               it("Should return success for deleting known realm and mirror token combo (15/16)", function(done) {
                  doDelete(successfulMirrorRegistrations[14]['realm'], successfulMirrorRegistrations[14]['mirrorToken'], 1, done);
               });
               it("Should return success for deleting known realm and mirror token combo (16/16)", function(done) {
                  doDelete(successfulMirrorRegistrations[15]['realm'], successfulMirrorRegistrations[15]['mirrorToken'], 1, done);
               });

               it("Should return success (but not actually delete anything) for deleting previously deleted known realm and mirror token combo", function(done) {
                  doDelete(successfulMirrorRegistrations[0]['realm'], successfulMirrorRegistrations[0]['mirrorToken'], 0, done);
               });

               it("Should fail to find previously deleted registration referenced by realm and mirror token", function(done) {
                  superagent
                        .get(ESDR_MIRROR_REGISTRATIONS_API_URL + REALM1 + "/registrations/" + successfulMirrorRegistrations[0].mirrorToken)

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
               });
               it("Should fail to find previously deleted registration referenced by realm and product using OAuth2 authentication", function(done) {
                  superagent
                        .get(ESDR_MIRROR_REGISTRATIONS_API_URL + REALM1 + "/registrations/products/" + product1.id)
                        .set(createAuthorizationHeader(user1.accessToken))
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
               });
               it("Should fail to find previously deleted registration referenced by realm and product using Basic Auth authentication", function(done) {
                  superagent
                        .get(ESDR_MIRROR_REGISTRATIONS_API_URL + REALM1 + "/registrations/products/" + product1.id)
                        .auth(user1.email, user1.password)
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
               });

            });   // Success
         });   // Delete
      });   // For Product
   });   // Mirror Registrations

});

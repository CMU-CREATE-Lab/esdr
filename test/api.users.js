const should = require('should');
const flow = require('nimble');
const httpStatus = require('http-status');
const superagent = require('superagent-ls');
const requireNew = require('require-new');
const wipe = require('./fixture-helpers/wipe');
const setup = require('./fixture-helpers/setup');

const config = require('../config');

const ESDR_API_ROOT_URL = config.get("esdr:apiRootUrl");
const ESDR_USERS_API_URL = ESDR_API_ROOT_URL + "/users";

describe("REST API", function() {
   const client1 = requireNew('./fixtures/client1.json');
   const user1 = requireNew('./fixtures/user1.json');
   const userNoDisplayName = requireNew('./fixtures/user2.json');
   const userNeedsTrimming = requireNew('./fixtures/user3-needs-trimming.json');
   const userEmptyDisplayName = requireNew('./fixtures/user4-empty-displayName.json');
   const userEmailTooShort = requireNew('./fixtures/user5-email-too-short.json');
   const userEmailTooLong = requireNew('./fixtures/user6-email-too-long.json');
   const userPasswordTooShort = requireNew('./fixtures/user7-password-too-short.json');
   const userPasswordTooLong = requireNew('./fixtures/user8-password-too-long.json');
   const userDisplayNameTooLong = requireNew('./fixtures/user9-displayName-too-long.json');
   const userEmailInvalid = requireNew('./fixtures/user10-email-invalid.json');
   const user11 = requireNew('./fixtures/user11.json');

   before(function(initDone) {
      flow.series(
            [
               wipe.wipeAllData,
               function(done) {
                  setup.createClient(client1, done);
               }
            ],
            initDone
      );
   });

   describe("Users", function() {

      describe("Create", function() {
         const creationTests = [
            {
               description : "Should be able to create a new user",
               client : client1,
               user : user1,
               expectedHttpStatus : httpStatus.CREATED,
               expectedStatusText : 'success',
               expectedResponseData : {
                  email : user1['email'],
                  displayName : user1['displayName']
               }
            },
            {
               description : "Should trim the email and displayName when creating a new user",
               client : client1,
               user : userNeedsTrimming,
               expectedHttpStatus : httpStatus.CREATED,
               expectedStatusText : 'success',
               expectedResponseData : {
                  email : userNeedsTrimming['email'].trim(),
                  displayName : userNeedsTrimming['displayName'].trim()
               }
            },
            {
               description : "Should be able to create a new user with no display name",
               client : client1,
               user : userNoDisplayName,
               expectedHttpStatus : httpStatus.CREATED,
               expectedStatusText : 'success',
               expectedResponseData : {
                  email : userNoDisplayName['email']
               }
            },
            {
               description : "Should be able to create a new user with an empty display name",
               client : client1,
               user : userEmptyDisplayName,
               expectedHttpStatus : httpStatus.CREATED,
               expectedStatusText : 'success',
               expectedResponseData : {
                  email : userEmptyDisplayName['email']
               }
            },
            {
               description : "Should fail to create the same user again",
               client : client1,
               user : user1,
               expectedHttpStatus : httpStatus.CONFLICT,
               expectedStatusText : 'error',
               expectedResponseData : {
                  email : user1['email']
               }
            }
         ];

         creationTests.forEach(function(test) {
            it(test.description, function(done) {
               superagent
                     .post(ESDR_USERS_API_URL)
                     .auth(test.client.clientName, test.client.clientSecret)
                     .send(test.user)
                     .end(function(err, res) {
                        should.not.exist(err);
                        should.exist(res);

                        res.should.have.property('status', test.expectedHttpStatus);
                        res.should.have.property('body');
                        res.body.should.have.properties({
                                                           code : test.expectedHttpStatus,
                                                           status : test.expectedStatusText
                                                        });

                        res.body.should.have.property('data');
                        res.body.data.should.have.properties(test.expectedResponseData);

                        if (test.expectedHttpStatus === httpStatus.CREATED) {
                           res.body.data.should.have.properties('id', 'verificationToken');

                           // remember the database ID and verificationToken
                           test.user.id = res.body.data.id;
                           test.user.verificationToken = res.body.data.verificationToken;
                        }

                        done();
                     });
            });
         });

         const creationValidationTests = [
            {
               description : "Should fail to create a new user with missing user data",
               user : {},
               getExpectedValidationItems : function() {
                  return [
                     {
                        "keyword" : "required",
                        "params" : {
                           "missingProperty" : "email"
                        }
                     },
                     {
                        "keyword" : "required",
                        "params" : {
                           "missingProperty" : "password"
                        }
                     }
                  ];
               }
            },
            {
               description : "Should fail to create a new user with an email address that's too short",
               user : userEmailTooShort,
               getExpectedValidationItems : function() {
                  return [{
                     "keyword" : "minLength",
                     "dataPath" : ".email",
                     "schemaPath" : "#/properties/email/minLength"
                  }];
               }
            },
            {
               description : "Should fail to create a new user with an email address that's too long",
               user : userEmailTooLong,
               getExpectedValidationItems : function() {
                  return [{
                     "keyword" : "maxLength",
                     "dataPath" : ".email",
                     "schemaPath" : "#/properties/email/maxLength"
                  }, {
                     "keyword" : "format",
                     "dataPath" : ".email",
                     "schemaPath" : "#/properties/email/format",
                     "params" : {
                        "format" : "email"
                     }
                  }];
               }
            },
            {
               description : "Should fail to create a new user with a password that's too short",
               user : userPasswordTooShort,
               getExpectedValidationItems : function() {
                  return [{
                     "keyword" : "minLength",
                     "dataPath" : ".password",
                     "schemaPath" : "#/properties/password/minLength"
                  }];
               }
            },
            {
               description : "Should fail to create a new user with a password that's too long",
               user : userPasswordTooLong,
               getExpectedValidationItems : function() {
                  return [{
                     "keyword" : "maxLength",
                     "dataPath" : ".password",
                     "schemaPath" : "#/properties/password/maxLength"
                  }];
               }
            },
            {
               description : "Should fail to create a new user with a display name that's too long",
               user : userDisplayNameTooLong,
               getExpectedValidationItems : function() {
                  return [{
                     "keyword" : "maxLength",
                     "dataPath" : ".displayName",
                     "schemaPath" : "#/properties/displayName/maxLength"
                  }];
               }
            },
            {
               description : "Should fail to create a new user with a email address that's invalid",
               user : userEmailInvalid,
               getExpectedValidationItems : function() {
                  return [{
                     "keyword" : "format",
                     "dataPath" : ".email",
                     "schemaPath" : "#/properties/email/format",
                     "params" : {
                        "format" : "email"
                     }
                  }];
               }
            }
         ];

         creationValidationTests.forEach(function(test) {
            it(test.description, function(done) {
               const expectedValidationItems = test.getExpectedValidationItems();
               superagent
                     .post(ESDR_USERS_API_URL)
                     .auth(client1['clientName'], client1['clientSecret'])
                     .send(test.user)
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
                        res.body.data.errors.should.have.length(expectedValidationItems.length);
                        res.body.data.errors.forEach(function(validationItem, index) {
                           validationItem.should.have.properties(expectedValidationItems[index]);
                        });

                        done();
                     });
            });
         });

         it("Should fail to create a new user with missing user and client", function(done) {
            superagent
                  .post(ESDR_USERS_API_URL)
                  .send({})
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
                     res.body.data.errors.should.have.length(2);
                     res.body.data.errors[0].should.have.properties({
                                                                       "keyword" : "required",
                                                                       "params" : {
                                                                          "missingProperty" : "email"
                                                                       }
                                                                    });
                     res.body.data.errors[1].should.have.properties({
                                                                       "keyword" : "required",
                                                                       "params" : {
                                                                          "missingProperty" : "password"
                                                                       }
                                                                    });

                     done();
                  });
         });

         it("Should be able to create a new user with no client specified", function(done) {
            superagent
                  .post(ESDR_USERS_API_URL)
                  .send(user11)
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
                     res.body.data.should.have.property('email', user11.email);
                     res.body.data.should.have.properties('id', 'verificationToken');

                     done();
                  });
         });

      });   // End Create
   });   // End Users
});   // End REST API
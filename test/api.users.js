var should = require('should');
var flow = require('nimble');
var httpStatus = require('http-status');
var superagent = require('superagent-ls');
var requireNew = require('require-new');
var wipe = require('./fixture-helpers/wipe');
var database = require('./fixture-helpers/database');

var config = require('../config');

var ESDR_API_ROOT_URL = config.get("esdr:apiRootUrl");
var ESDR_USERS_API_URL = ESDR_API_ROOT_URL + "/users";

describe("REST API", function() {
   var client1 = requireNew('./fixtures/client1.json');
   var user1 = requireNew('./fixtures/user1.json');
   var userNoDisplayName = requireNew('./fixtures/user2.json');
   var userNeedsTrimming = requireNew('./fixtures/user3-needs-trimming.json');
   var userEmptyDisplayName = requireNew('./fixtures/user4-empty-displayName.json');
   var userEmailTooShort = requireNew('./fixtures/user5-email-too-short.json');
   var userEmailTooLong = requireNew('./fixtures/user6-email-too-long.json');
   var userPasswordTooShort = requireNew('./fixtures/user7-password-too-short.json');
   var userPasswordTooLong = requireNew('./fixtures/user8-password-too-long.json');
   var userDisplayNameTooLong = requireNew('./fixtures/user9-displayName-too-long.json');
   var userEmailInvalid = requireNew('./fixtures/user10-email-invalid.json');
   var user11 = requireNew('./fixtures/user11.json');

   before(function(initDone) {
      flow.series(
            [
               wipe.wipeAllData,
               function(done) {
                  // insert the client and remember the id
                  database.insertClient(client1, function(err, result) {
                     if (err) {
                        return done(err);
                     }

                     client1.id = result.insertId;
                     done();
                  });
               }
            ],
            initDone
      );
   });

   describe("Users", function() {

      describe("Create", function() {
         var creationTests = [
            {
               description : "Should be able to create a new user",
               client : client1,
               user : user1,
               expectedHttpStatus : httpStatus.CREATED,
               expectedStatusText : 'success',
               expectedResponseData : {
                  email : user1.email,
                  displayName : user1.displayName
               }
            },
            {
               description : "Should trim the email and displayName when creating a new user",
               client : client1,
               user : userNeedsTrimming,
               expectedHttpStatus : httpStatus.CREATED,
               expectedStatusText : 'success',
               expectedResponseData : {
                  email : userNeedsTrimming.email.trim(),
                  displayName : userNeedsTrimming.displayName.trim()
               }
            },
            {
               description : "Should be able to create a new user with no display name",
               client : client1,
               user : userNoDisplayName,
               expectedHttpStatus : httpStatus.CREATED,
               expectedStatusText : 'success',
               expectedResponseData : {
                  email : userNoDisplayName.email
               }
            },
            {
               description : "Should be able to create a new user with an empty display name",
               client : client1,
               user : userEmptyDisplayName,
               expectedHttpStatus : httpStatus.CREATED,
               expectedStatusText : 'success',
               expectedResponseData : {
                  email : userEmptyDisplayName.email
               }
            },
            {
               description : "Should fail to create the same user again",
               client : client1,
               user : user1,
               expectedHttpStatus : httpStatus.CONFLICT,
               expectedStatusText : 'error',
               expectedResponseData : {
                  email : user1.email
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
                        if (!test.hasEmptyBody) {
                           res.body.should.have.properties({
                                                              code : test.expectedHttpStatus,
                                                              status : test.expectedStatusText
                                                           });

                           res.body.should.have.property('data');
                           res.body.data.should.have.properties(test.expectedResponseData);

                           if (test.expectedHttpStatus == httpStatus.CREATED) {
                              res.body.data.should.have.properties('id', 'verificationToken');

                              // remember the database ID and verificationToken
                              test.user.id = res.body.data.id;
                              test.user.verificationToken = res.body.data.verificationToken;
                           }
                        }

                        done();
                     });
            });
         });

         var creationValidationTests = [
            {
               description : "Should fail to create a new user with missing user data",
               user : {},
               getExpectedValidationItems : function() {
                  return [
                     {
                        instanceContext : '#',
                        constraintName : 'required',
                        constraintValue : global.db.users.jsonSchema.required
                     },
                     {
                        instanceContext : '#/password',
                        constraintName : 'type',
                        constraintValue : 'string'
                     }
                  ];
               }
            },
            {
               description : "Should fail to create a new user with an email address that's too short",
               user : userEmailTooShort,
               getExpectedValidationItems : function() {
                  return [{
                     instanceContext : '#/email',
                     constraintName : 'minLength',
                     constraintValue : global.db.users.jsonSchema.properties.email.minLength
                  }];
               }
            },
            {
               description : "Should fail to create a new user with an email address that's too long",
               user : userEmailTooLong,
               getExpectedValidationItems : function() {
                  return [{
                     instanceContext : '#/email',
                     constraintName : 'maxLength',
                     constraintValue : global.db.users.jsonSchema.properties.email.maxLength
                  }];
               }
            },
            {
               description : "Should fail to create a new user with a password that's too short",
               user : userPasswordTooShort,
               getExpectedValidationItems : function() {
                  return [{
                     instanceContext : '#/password',
                     constraintName : 'minLength',
                     constraintValue : global.db.users.jsonSchema.properties.password.minLength
                  }];
               }
            },
            {
               description : "Should fail to create a new user with a password that's too long",
               user : userPasswordTooLong,
               getExpectedValidationItems : function() {
                  return [{
                     instanceContext : '#/password',
                     constraintName : 'maxLength',
                     constraintValue : global.db.users.jsonSchema.properties.password.maxLength
                  }];
               }
            },
            {
               description : "Should fail to create a new user with a display name that's too long",
               user : userDisplayNameTooLong,
               getExpectedValidationItems : function() {
                  return [{
                     instanceContext : '#/displayName',
                     constraintName : 'maxLength',
                     constraintValue : global.db.users.jsonSchema.properties.displayName.maxLength
                  }];
               }
            },
            {
               description : "Should fail to create a new user with a email address that's invalid",
               user : userEmailInvalid,
               getExpectedValidationItems : function() {
                  return [{
                     instanceContext : '#/email',
                     constraintName : 'format',
                     constraintValue : 'email',
                     kind : 'FormatValidationError'
                  }];
               }
            }
         ];

         creationValidationTests.forEach(function(test) {
            it(test.description, function(done) {
               var expectedValidationItems = test.getExpectedValidationItems();
               superagent
                     .post(ESDR_USERS_API_URL)
                     .auth(client1.clientName, client1.clientSecret)
                     .send(test.user)
                     .end(function(err, res) {
                        should.not.exist(err);
                        should.exist(res);

                        if (test.willDebug) {
                           console.log(JSON.stringify(expectedValidationItems, null, 3));
                           console.log(JSON.stringify(res.body, null, 3));
                        }

                        res.should.have.property('status', httpStatus.UNPROCESSABLE_ENTITY);
                        res.body.should.have.properties({
                                                           code : httpStatus.UNPROCESSABLE_ENTITY,
                                                           status : 'error'
                                                        });

                        res.body.should.have.property('data');
                        res.body.data.should.have.length(expectedValidationItems.length);
                        res.body.data.forEach(function(validationItem, index) {
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
                     res.body.should.have.properties({
                                                        code : httpStatus.UNPROCESSABLE_ENTITY,
                                                        status : 'error'
                                                     });

                     res.body.should.have.property('data');
                     res.body.data.should.have.length(2);
                     res.body.data[0].should.have.properties({
                                                                instanceContext : '#',
                                                                constraintName : 'required',
                                                                constraintValue : global.db.users.jsonSchema.required
                                                             });
                     res.body.data[1].should.have.properties({
                                                                instanceContext : '#/password',
                                                                constraintName : 'type',
                                                                constraintValue : 'string'
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
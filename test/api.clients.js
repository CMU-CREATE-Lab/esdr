var should = require('should');
var flow = require('nimble');
var httpStatus = require('http-status');
var superagent = require('superagent');
var wipe = require('./fixture-helpers/wipe');
var database = require('./fixture-helpers/database');

var config = require('../config');

var ESDR_API_ROOT_URL = config.get("esdr:apiRootUrl");
var ESDR_OAUTH_ROOT_URL = config.get("esdr:oauthRootUrl");

describe.only("REST API", function() {
   var verifiedUser1 = require('./fixtures/user1.json');
   var verifiedUser2 = require('./fixtures/user2.json');
   var client1 = require('./fixtures/client1.json');
   var client2 = require('./fixtures/client2.json');
   var clientNeedsTrimming = require('./fixtures/client4-needs-trimming.json');
   var clientDisplayNameTooShort = require('./fixtures/client5-displayName-too-short.json');
   var clientDisplayNameTooLong = require('./fixtures/client6-displayName-too-long.json');
   var clientClientNameTooShort = require('./fixtures/client7-clientName-too-short.json');
   var clientClientNameTooLong = require('./fixtures/client8-clientName-too-long.json');
   var clientClientNameFirstCharNotAlphanumeric = require('./fixtures/client9-clientName-first-char-not-alphanumeric.json');
   var clientClientNameIllegalChars = require('./fixtures/client10-clientName-illegal-chars.json');
   var clientClientSecretTooShort = require('./fixtures/client11-clientSecret-too-short.json');
   var clientClientSecretTooLong = require('./fixtures/client12-clientSecret-too-long.json');
   var clientResetPasswordUrlTooShort = require('./fixtures/client13-reset-password-url-too-short.json');
   var clientVerificationUrlTooShort = require('./fixtures/client14-verification-url-too-short.json');

   before(function(initDone) {
      // To create a client, we have a bit of a chicken-and-egg scenario.  We need to have an OAuth2 access token to
      // create a client, but you can't get one without auth'ing against a client.  So, here, we'll insert a user, verifiy
      // it, and then get an access token for that user (using the ESDR client) so that we can create new clients.

      var insertUser = function(user, done) {
         // insert the user and remember the id
         database.insertUser(user, function(err, result) {
            if (err) {
               return done(err);
            }
            user.id = result.insertId;
            done();
         });
      };

      var verifyUser = function(user, done) {
         // mark user as verified
         superagent
               .put(ESDR_API_ROOT_URL + "/user-verification")
               .send({ token : user.verificationToken })
               .end(done);
      };

      var authentcateUser = function(user, done) {
         // get an OAuth2 access token for this user
         superagent
               .post(ESDR_OAUTH_ROOT_URL)
               .send({
                        grant_type : "password",
                        client_id : config.get("esdrClient:clientName"),
                        client_secret : config.get("esdrClient:clientSecret"),
                        username : user.email,
                        password : user.password
                     })
               .end(function(err, res) {
                  should.not.exist(err);
                  should.exist(res);

                  res.should.have.property('status', httpStatus.OK);
                  res.should.have.property('body');
                  res.body.should.have.properties('access_token', 'refresh_token');
                  res.body.should.have.properties({
                                                     userId : user.id,
                                                     expires_in : config.get("security:tokenLifeSecs"),
                                                     token_type : 'Bearer'
                                                  });

                  // remember the access token
                  user.accessToken = res.body.access_token;

                  done();
               });
      };

      flow.series(
            [
               wipe.wipeAllData,
               function(done) {
                  insertUser(verifiedUser1, done);
               },
               function(done) {
                  insertUser(verifiedUser2, done);
               },
               function(done) {
                  verifyUser(verifiedUser1, done);
               },
               function(done) {
                  verifyUser(verifiedUser2, done);
               },
               function(done) {
                  authentcateUser(verifiedUser1, done);
               },
               function(done) {
                  authentcateUser(verifiedUser2, done);
               }
            ],
            initDone
      );
   });

   describe("Clients", function() {

      describe("Create", function() {
         var creationTests = [
            {
               description : "Should be able to create a new client",
               client : client1,
               getAccessToken : function() {
                  return verifiedUser1.accessToken
               },
               expectedHttpStatus : httpStatus.CREATED,
               expectedStatusText : 'success',
               expectedResponseData : {
                  displayName : client1.displayName,
                  clientName : client1.clientName
               }
            },
            {
               description : "Should be able to create a different client",
               client : client2,
               getAccessToken : function() {
                  return verifiedUser1.accessToken
               },
               expectedHttpStatus : httpStatus.CREATED,
               expectedStatusText : 'success',
               expectedResponseData : {
                  displayName : client2.displayName,
                  clientName : client2.clientName
               }
            },
            {
               description : "Should trim the displayName and clientName when creating a new client",
               client : clientNeedsTrimming,
               getAccessToken : function() {
                  return verifiedUser2.accessToken
               },
               expectedHttpStatus : httpStatus.CREATED,
               expectedStatusText : 'success',
               expectedResponseData : {
                  displayName : clientNeedsTrimming.displayName.trim(),
                  clientName : clientNeedsTrimming.clientName.trim()
               }
            },
            {
               description : "Should fail to create the same client again",
               client : client1,
               getAccessToken : function() {
                  return verifiedUser1.accessToken
               },
               expectedHttpStatus : httpStatus.CONFLICT,
               expectedStatusText : 'error',
               expectedResponseData : {
                  clientName : client1.clientName
               }
            },
            {
               description : "Should fail to create the same client again (by a different user)",
               client : client1,
               getAccessToken : function() {
                  return verifiedUser2.accessToken
               },
               expectedHttpStatus : httpStatus.CONFLICT,
               expectedStatusText : 'error',
               expectedResponseData : {
                  clientName : client1.clientName
               }
            }
         ];

         creationTests.forEach(function(test) {
            it(test.description, function(done) {
               superagent
                     .post(ESDR_API_ROOT_URL + "/clients")
                     .set({ Authorization : "Bearer " + test.getAccessToken() })
                     .send(test.client)
                     .end(function(err, res) {
                        should.not.exist(err);
                        should.exist(res);

                        res.should.have.property('status', test.expectedHttpStatus);
                        res.body.should.have.properties({
                                                           code : test.expectedHttpStatus,
                                                           status : test.expectedStatusText,
                                                           data : test.expectedResponseData
                                                        });

                        done();
                     });
            });
         });

         it("Should fail to create a new client with missing required values", function(done) {
            superagent
                  .post(ESDR_API_ROOT_URL + "/clients")
                  .set({ Authorization : "Bearer " + verifiedUser1.accessToken })
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
                                                                constraintValue : global.db.clients.jsonSchema.required
                                                             });
                     res.body.data[1].should.have.properties({
                                                                instanceContext : '#/clientSecret',
                                                                constraintName : 'type',
                                                                constraintValue : 'string'
                                                             });

                     done();
                  });
         });

         var validationFailureTests = [
            {
               description : "Should fail to create a new client with a display name that's too short",
               client : clientDisplayNameTooShort,
               getValidationProperties : function() {
                  return {
                     instanceContext : '#/displayName',
                     constraintName : 'minLength',
                     constraintValue : global.db.clients.jsonSchema.properties.displayName.minLength
                  };
               }
            },
            {
               description : "Should fail to create a new client with a display name that's too long",
               client : clientDisplayNameTooLong,
               getValidationProperties : function() {
                  return {
                     instanceContext : '#/displayName',
                     constraintName : 'maxLength',
                     constraintValue : global.db.clients.jsonSchema.properties.displayName.maxLength
                  };
               }
            },
            {
               description : "Should fail to create a new client with a client name that's too short",
               client : clientClientNameTooShort,
               getValidationProperties : function() {
                  return {
                     instanceContext : '#/clientName',
                     constraintName : 'minLength',
                     constraintValue : global.db.clients.jsonSchema.properties.clientName.minLength
                  };
               }
            },
            {
               description : "Should fail to create a new client with a client name that's too long",
               client : clientClientNameTooLong,
               getValidationProperties : function() {
                  return {
                     instanceContext : '#/clientName',
                     constraintName : 'maxLength',
                     constraintValue : global.db.clients.jsonSchema.properties.clientName.maxLength
                  };
               }
            },
            {
               description : "Should fail to create a new client with a client name that doesn't start with an alphanumeric character",
               client : clientClientNameFirstCharNotAlphanumeric,
               getValidationProperties : function() {
                  return {
                     instanceContext : '#/clientName',
                     constraintName : 'pattern',
                     constraintValue : db.clients.jsonSchema.properties.clientName.pattern
                  };
               }
            },
            {
               description : "Should fail to create a new client with a client name that contains illegal characters",
               client : clientClientNameIllegalChars,
               getValidationProperties : function() {
                  return {
                     instanceContext : '#/clientName',
                     constraintName : 'pattern',
                     constraintValue : db.clients.jsonSchema.properties.clientName.pattern
                  };
               }
            },
            {
               description : "Should fail to create a new client with a client secret that's too short",
               client : clientClientSecretTooShort,
               getValidationProperties : function() {
                  return {
                     instanceContext : '#/clientSecret',
                     constraintName : 'minLength',
                     constraintValue : global.db.clients.jsonSchema.properties.clientSecret.minLength
                  };
               }
            },
            {
               description : "Should fail to create a new client with a client secret that's too long",
               client : clientClientSecretTooLong,
               getValidationProperties : function() {
                  return {
                     instanceContext : '#/clientSecret',
                     constraintName : 'maxLength',
                     constraintValue : global.db.clients.jsonSchema.properties.clientSecret.maxLength
                  };
               }
            },
            {
               description : "Should fail to create a new client with a reset password URL that's too short",
               client : clientResetPasswordUrlTooShort,
               getValidationProperties : function() {
                  return {
                     instanceContext : '#/resetPasswordUrl',
                     constraintName : 'minLength',
                     constraintValue : global.db.clients.jsonSchema.properties.resetPasswordUrl.minLength
                  };
               }
            },
            {
               description : "Should fail to create a new client with a verification URL that's too short",
               client : clientVerificationUrlTooShort,
               getValidationProperties : function() {
                  return {
                     instanceContext : '#/verificationUrl',
                     constraintName : 'minLength',
                     constraintValue : global.db.clients.jsonSchema.properties.verificationUrl.minLength
                  };
               }
            }
         ];

         validationFailureTests.forEach(function(test) {
            it(test.description, function(done) {
               superagent
                     .post(ESDR_API_ROOT_URL + "/clients")
                     .set({ Authorization : "Bearer " + verifiedUser1.accessToken })
                     .send(test.client)
                     .end(function(err, res) {
                        should.not.exist(err);
                        should.exist(res);

                        res.should.have.property('status', httpStatus.UNPROCESSABLE_ENTITY);
                        res.body.should.have.properties({
                                                           code : httpStatus.UNPROCESSABLE_ENTITY,
                                                           status : 'error'
                                                        });

                        res.body.should.have.property('data');
                        res.body.data.should.have.length(1);
                        res.body.data[0].should.have.properties(test.getValidationProperties());

                        done();
                     });
            });
         });

      });   // End Create

      describe("Find", function() {

         it("Should have find tests...");

      });   // End Find

   });   // End Clients
});   // End REST API
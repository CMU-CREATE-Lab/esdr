var should = require('should');
var flow = require('nimble');
var httpStatus = require('http-status');
var superagent = require('superagent-ls');
var requireNew = require('require-new');
var wipe = require('./fixture-helpers/wipe');
var database = require('./fixture-helpers/database');

var config = require('../config');

var ESDR_OAUTH_ROOT_URL = config.get("esdr:oauthRootUrl");
var ESDR_API_ROOT_URL = config.get("esdr:apiRootUrl");
var ESDR_CLIENT_API_URL = ESDR_API_ROOT_URL + "/clients";

describe("REST API", function() {
   var verifiedUser1 = requireNew('./fixtures/user1.json');
   var verifiedUser2 = requireNew('./fixtures/user2.json');
   var client1 = requireNew('./fixtures/client1.json');
   var client2 = requireNew('./fixtures/client2.json');
   var client3 = requireNew('./fixtures/client3.json');
   var clientNeedsTrimming = requireNew('./fixtures/client4-needs-trimming.json');
   var clientDisplayNameTooShort = requireNew('./fixtures/client5-displayName-too-short.json');
   var clientDisplayNameTooLong = requireNew('./fixtures/client6-displayName-too-long.json');
   var clientClientNameTooShort = requireNew('./fixtures/client7-clientName-too-short.json');
   var clientClientNameTooLong = requireNew('./fixtures/client8-clientName-too-long.json');
   var clientClientNameFirstCharNotAlphanumeric = requireNew('./fixtures/client9-clientName-first-char-not-alphanumeric.json');
   var clientClientNameIllegalChars = requireNew('./fixtures/client10-clientName-illegal-chars.json');
   var clientClientSecretTooShort = requireNew('./fixtures/client11-clientSecret-too-short.json');
   var clientClientSecretTooLong = requireNew('./fixtures/client12-clientSecret-too-long.json');
   var clientResetPasswordUrlTooShort = requireNew('./fixtures/client13-reset-password-url-too-short.json');
   var clientVerificationUrlTooShort = requireNew('./fixtures/client14-verification-url-too-short.json');

   before(function(initDone) {
      // To create a client, we have a bit of a chicken-and-egg scenario.  We need to have an OAuth2 access token to
      // create a client, but you can't get one without auth'ing against a client.  So, here, we'll insert a user, verifiy
      // it, and then get an access token for that user (using the ESDR client) so that we can create new clients.

      var insertUser = function(user, callback) {
         // insert the user and remember the id
         database.insertUser(user, function(err, result) {
            if (err) {
               return callback(err);
            }
            user.id = result.insertId;
            callback(null, user.id);
         });
      };

      var verifyUser = function(user, callback) {
         // mark user as verified
         superagent
               .put(ESDR_API_ROOT_URL + "/user-verification")
               .send({ token : user.verificationToken })
               .end(callback);
      };

      var authentcateUser = function(user, callback) {
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

                  callback(null, user.accessToken);
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
            },
            {
               description : "Should fail to create a client with an invalid OAuth2 token",
               client : client1,
               getAccessToken : function() {
                  return "bogus"
               },
               expectedHttpStatus : httpStatus.UNAUTHORIZED,
               expectedStatusText : 'error',
               hasEmptyBody : true
            }
         ];

         creationTests.forEach(function(test) {
            it(test.description, function(done) {
               superagent
                     .post(ESDR_CLIENT_API_URL)
                     .set({ Authorization : "Bearer " + test.getAccessToken() })
                     .send(test.client)
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
                              res.body.data.should.have.property('id');

                              // remember the database ID
                              test.client.id = res.body.data.id;
                           }
                        }

                        done();
                     });
            });
         });

         it("Creating a client without specifying the email, verificationUrl, or resetPasswordUrl should result in the client getting the defaults", function(done) {
            superagent
                  .post(ESDR_CLIENT_API_URL)
                  .set({ Authorization : "Bearer " + verifiedUser2.accessToken })
                  .send(client3)
                  .end(function(err, res) {
                     should.not.exist(err);
                     should.exist(res);

                     res.should.have.property('status', httpStatus.CREATED);
                     res.body.should.have.properties({
                                                        code : httpStatus.CREATED,
                                                        status : 'success'
                                                     });
                     res.body.should.have.property('data');
                     res.body.data.should.have.property('id');
                     res.body.data.should.have.properties({
                                                             displayName : client3.displayName,
                                                             clientName : client3.clientName
                                                          });

                     // now fetch the created client to verify that it got the defaults for unspecified values
                     superagent
                           .get(ESDR_API_ROOT_URL + "/clients?where=clientName=" + client3.clientName)
                           .set({ Authorization : "Bearer " + verifiedUser2.accessToken })
                           .end(function(err, res) {
                              should.not.exist(err);
                              should.exist(res);

                              res.should.have.property('status', httpStatus.OK);
                              res.body.should.have.properties({
                                                                 code : httpStatus.OK,
                                                                 status : 'success',
                                                              });
                              res.body.should.have.property('data');
                              res.body.data.should.have.property('rows');
                              res.body.data.rows.should.have.length(1);
                              res.body.data.rows[0].should.have.properties({
                                                                              email : config.get("esdrClient:email"),
                                                                              verificationUrl : config.get("esdrClient:verificationUrl"),
                                                                              resetPasswordUrl : config.get("esdrClient:resetPasswordUrl")
                                                                           });

                              done();
                           });
                  });
         });

         it("Should fail to create a new client with missing required values", function(done) {
            superagent
                  .post(ESDR_CLIENT_API_URL)
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
                     .post(ESDR_CLIENT_API_URL)
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

         // define the expected values for each client's isPublic field
         var expectedIsPublic = {
            ESDR : 1,
            test_client_1 : 0,
            test_client_2 : 0,
            test_client_3 : 0,
            test_client_trimming : 0
         };

         it("Should be able to find clients (without authentication) and only see all fields for public clients", function(done) {

            superagent
                  .get(ESDR_CLIENT_API_URL)
                  .end(function(err, res) {
                     should.not.exist(err);
                     should.exist(res);

                     res.should.have.property('status', httpStatus.OK);
                     res.body.should.have.properties({
                                                        code : httpStatus.OK,
                                                        status : 'success'
                                                     });

                     res.body.should.have.property('data');
                     res.body.data.should.have.properties({
                                                             totalCount : Object.keys(expectedIsPublic).length,
                                                             offset : 0,
                                                             limit : 100
                                                          });

                     res.body.data.should.have.property('rows');
                     res.body.data.rows.should.have.length(Object.keys(expectedIsPublic).length);
                     res.body.data.rows.forEach(function(row) {
                        row.should.have.properties('id', 'displayName', 'clientName', 'creatorUserId', 'isPublic', 'created', 'modified');

                        row.should.have.property('isPublic', expectedIsPublic[row.clientName]);
                        if (row['isPublic']) {
                           row.should.have.properties('email', 'verificationUrl', 'resetPasswordUrl');
                        }
                        else {
                           row.should.not.have.properties('email', 'verificationUrl', 'resetPasswordUrl');
                        }
                     });

                     done();
                  });
         });

         var findWithAuthenticationTests = [
            {
               description : "Should be able to find clients (with authentication) and see all fields for public clients and clients owned by verifiedUser1",
               user : verifiedUser1
            },
            {
               description : "Should be able to find clients (with authentication) and see all fields for public clients and clients owned by verifiedUser2",
               user : verifiedUser2
            }
         ];

         findWithAuthenticationTests.forEach(function(test) {
            it(test.description, function(done) {
               superagent
                     .get(ESDR_CLIENT_API_URL)
                     .set({
                             Authorization : "Bearer " + test.user.accessToken
                          })
                     .end(function(err, res) {
                        should.not.exist(err);
                        should.exist(res);

                        res.should.have.property('status', httpStatus.OK);
                        res.body.should.have.properties({
                                                           code : httpStatus.OK,
                                                           status : 'success'
                                                        });

                        res.body.should.have.property('data');
                        res.body.data.should.have.properties({
                                                                totalCount : Object.keys(expectedIsPublic).length,
                                                                offset : 0,
                                                                limit : 100
                                                             });

                        res.body.data.should.have.property('rows');
                        res.body.data.rows.should.have.length(Object.keys(expectedIsPublic).length);

                        res.body.data.rows.forEach(function(row) {
                           row.should.have.properties('id', 'displayName', 'clientName', 'creatorUserId', 'isPublic', 'created', 'modified');

                           row.should.have.property('isPublic', expectedIsPublic[row.clientName]);

                           // this user should be able to see the details of public clients and clients created by the user
                           if (row['isPublic'] || test.user.id == row.creatorUserId) {
                              row.should.have.properties('email', 'verificationUrl', 'resetPasswordUrl');
                           }
                           else {
                              row.should.not.have.properties('email', 'verificationUrl', 'resetPasswordUrl');
                           }
                        });

                        done();
                     });
            });
         });

         it("Should select only the clients matching the where clause", function(done) {
            superagent
                  .get(ESDR_CLIENT_API_URL + "?whereOr=id=" + client2.id + ",clientName=" + client3.clientName + "&fields=id,clientName,email,creatorUserId&orderBy=-id")
                  .set({
                          Authorization : "Bearer " + verifiedUser2.accessToken
                       })
                  .end(function(err, res) {
                     should.not.exist(err);
                     should.exist(res);

                     res.should.have.property('status', httpStatus.OK);
                     res.body.should.have.properties({
                                                        code : httpStatus.OK,
                                                        status : 'success'
                                                     });

                     res.body.should.have.property('data');
                     res.body.data.should.have.properties({
                                                             totalCount : 2,
                                                             offset : 0,
                                                             limit : 100
                                                          });

                     res.body.data.should.have.property('rows');
                     res.body.data.rows.should.have.length(2);
                     res.body.data.rows.forEach(function(client) {
                        client.should.have.properties('id', 'clientName', 'creatorUserId');

                        // make sure this user can see the email field for the client it created, but not for the client
                        // it didn't create.
                        if (client.creatorUserId == verifiedUser2.id) {
                           client.should.have.property('email');
                        }
                        else {
                           client.should.not.have.property('email');
                        }

                        // make sure the client doesn't have properties we didn't ask for
                        client.should.not.have.properties('displayName', 'creatorUserId', 'isPublic', 'created', 'modified');
                     });

                     // make sure order by clause worked (should sort in descending order)
                     res.body.data.rows[0].id.should.be.greaterThan(res.body.data.rows[1].id);

                     done();
                  });
         });
      });   // End Find

   });   // End Clients
});   // End REST API
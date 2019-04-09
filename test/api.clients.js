const should = require('should');
const flow = require('nimble');
const httpStatus = require('http-status');
const superagent = require('superagent-ls');
const requireNew = require('require-new');
const wipe = require('./fixture-helpers/wipe');
const setup = require('./fixture-helpers/setup');

const config = require('../config');

const ESDR_API_ROOT_URL = config.get("esdr:apiRootUrl");
const ESDR_CLIENTS_API_URL = ESDR_API_ROOT_URL + "/clients";

describe("REST API", function() {
   const verifiedUser1 = requireNew('./fixtures/user1.json');
   const verifiedUser2 = requireNew('./fixtures/user2.json');
   const client1 = requireNew('./fixtures/client1.json');
   const client2 = requireNew('./fixtures/client2.json');
   const client3 = requireNew('./fixtures/client3.json');
   const clientNeedsTrimming = requireNew('./fixtures/client4-needs-trimming.json');
   const clientDisplayNameTooShort = requireNew('./fixtures/client5-displayName-too-short.json');
   const clientDisplayNameTooLong = requireNew('./fixtures/client6-displayName-too-long.json');
   const clientClientNameTooShort = requireNew('./fixtures/client7-clientName-too-short.json');
   const clientClientNameTooLong = requireNew('./fixtures/client8-clientName-too-long.json');
   const clientClientNameFirstCharNotAlphanumeric = requireNew('./fixtures/client9-clientName-first-char-not-alphanumeric.json');
   const clientClientNameIllegalChars = requireNew('./fixtures/client10-clientName-illegal-chars.json');
   const clientClientSecretTooShort = requireNew('./fixtures/client11-clientSecret-too-short.json');
   const clientClientSecretTooLong = requireNew('./fixtures/client12-clientSecret-too-long.json');
   const clientResetPasswordUrlTooShort = requireNew('./fixtures/client13-reset-password-url-too-short.json');
   const clientVerificationUrlTooShort = requireNew('./fixtures/client14-verification-url-too-short.json');

   before(function(initDone) {
      // To create a client, we have a bit of a chicken-and-egg scenario.  We need to have an OAuth2 access token to
      // create a client, but you can't get one without auth'ing against a client.  So, here, we'll insert a user, verifiy
      // it, and then get an access token for that user (using the ESDR client) so that we can create new clients.
      flow.series(
            [
               wipe.wipeAllData,
               function(done) {
                  setup.createUser(verifiedUser1, done);
               },
               function(done) {
                  setup.createUser(verifiedUser2, done);
               },
               function(done) {
                  setup.verifyUser(verifiedUser1, done);
               },
               function(done) {
                  setup.verifyUser(verifiedUser2, done);
               },
               function(done) {
                  setup.authenticateUser(verifiedUser1, done);
               },
               function(done) {
                  setup.authenticateUser(verifiedUser2, done);
               }
            ],
            initDone
      );
   });

   describe("Clients", function() {

      describe("Create", function() {
         const creationTests = [
            {
               description : "Should be able to create a new client",
               client : client1,
               getAccessToken : function() {
                  return verifiedUser1['accessToken']
               },
               expectedHttpStatus : httpStatus.CREATED,
               expectedStatusText : 'success',
               expectedResponseData : {
                  displayName : client1['displayName'],
                  clientName : client1['clientName']
               }
            },
            {
               description : "Should be able to create a different client",
               client : client2,
               getAccessToken : function() {
                  return verifiedUser1['accessToken']
               },
               expectedHttpStatus : httpStatus.CREATED,
               expectedStatusText : 'success',
               expectedResponseData : {
                  displayName : client2['displayName'],
                  clientName : client2['clientName']
               }
            },
            {
               description : "Should trim the displayName and clientName when creating a new client",
               client : clientNeedsTrimming,
               getAccessToken : function() {
                  return verifiedUser2['accessToken']
               },
               expectedHttpStatus : httpStatus.CREATED,
               expectedStatusText : 'success',
               expectedResponseData : {
                  displayName : clientNeedsTrimming['displayName'].trim(),
                  clientName : clientNeedsTrimming['clientName'].trim()
               }
            },
            {
               description : "Should fail to create the same client again",
               client : client1,
               getAccessToken : function() {
                  return verifiedUser1['accessToken']
               },
               expectedHttpStatus : httpStatus.CONFLICT,
               expectedStatusText : 'error',
               expectedResponseData : {
                  clientName : client1['clientName']
               }
            },
            {
               description : "Should fail to create the same client again (by a different user)",
               client : client1,
               getAccessToken : function() {
                  return verifiedUser2['accessToken']
               },
               expectedHttpStatus : httpStatus.CONFLICT,
               expectedStatusText : 'error',
               expectedResponseData : {
                  clientName : client1['clientName']
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
                     .post(ESDR_CLIENTS_API_URL)
                     .set({ Authorization : "Bearer " + test.getAccessToken() })
                     .send(test.client)
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

                           if (test.expectedHttpStatus === httpStatus.CREATED) {
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
                  .post(ESDR_CLIENTS_API_URL)
                  .set({ Authorization : "Bearer " + verifiedUser2['accessToken'] })
                  .send(client3)
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
                     res.body.data.should.have.property('id');
                     res.body.data.should.have.properties({
                                                             displayName : client3['displayName'],
                                                             clientName : client3['clientName']
                                                          });

                     // now fetch the created client to verify that it got the defaults for unspecified values
                     superagent
                           .get(ESDR_API_ROOT_URL + "/clients?where=clientName=" + client3['clientName'])
                           .set({ Authorization : "Bearer " + verifiedUser2['accessToken'] })
                           .end(function(err, res) {
                              should.not.exist(err);
                              should.exist(res);

                              res.should.have.property('status', httpStatus.OK);
                              res.should.have.property('body');
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
                  .post(ESDR_CLIENTS_API_URL)
                  .set({ Authorization : "Bearer " + verifiedUser1['accessToken'] })
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
                     res.body.data.errors.should.have.length(3);
                     res.body.data.errors[0].should.have.properties({
                                                                       "keyword" : "required",
                                                                       "dataPath" : "",
                                                                       "schemaPath" : "#/required",
                                                                       "params" : {
                                                                          "missingProperty" : "displayName"
                                                                       }
                                                                    });
                     res.body.data.errors[1].should.have.properties({
                                                                       "keyword" : "required",
                                                                       "dataPath" : "",
                                                                       "schemaPath" : "#/required",
                                                                       "params" : {
                                                                          "missingProperty" : "clientName"
                                                                       }
                                                                    });
                     res.body.data.errors[2].should.have.properties({
                                                                       "keyword" : "required",
                                                                       "dataPath" : "",
                                                                       "schemaPath" : "#/required",
                                                                       "params" : {
                                                                          "missingProperty" : "clientSecret"
                                                                       }
                                                                    });

                     done();
                  });
         });

         const validationFailureTests = [
            {
               description : "Should fail to create a new client with a display name that's too short",
               client : clientDisplayNameTooShort,
               getValidationProperties : function() {
                  return {
                     "keyword" : "minLength",
                     "dataPath" : ".displayName",
                     "schemaPath" : "#/properties/displayName/minLength"
                  };
               }
            },
            {
               description : "Should fail to create a new client with a display name that's too long",
               client : clientDisplayNameTooLong,
               getValidationProperties : function() {
                  return {
                     "keyword" : "maxLength",
                     "dataPath" : ".displayName",
                     "schemaPath" : "#/properties/displayName/maxLength"
                  };
               }
            },
            {
               description : "Should fail to create a new client with a client name that's too short",
               client : clientClientNameTooShort,
               getValidationProperties : function() {
                  return {
                     "keyword" : "minLength",
                     "dataPath" : ".clientName",
                     "schemaPath" : "#/properties/clientName/minLength"
                  };
               }
            },
            {
               description : "Should fail to create a new client with a client name that's too long",
               client : clientClientNameTooLong,
               getValidationProperties : function() {
                  return {
                     "keyword" : "maxLength",
                     "dataPath" : ".clientName",
                     "schemaPath" : "#/properties/clientName/maxLength"
                  };
               }
            },
            {
               description : "Should fail to create a new client with a client name that doesn't start with an alphanumeric character",
               client : clientClientNameFirstCharNotAlphanumeric,
               getValidationProperties : function() {
                  return {
                     "keyword" : "pattern",
                     "dataPath" : ".clientName",
                     "schemaPath" : "#/properties/clientName/pattern"
                  };
               }
            },
            {
               description : "Should fail to create a new client with a client name that contains illegal characters",
               client : clientClientNameIllegalChars,
               getValidationProperties : function() {
                  return {
                     "keyword" : "pattern",
                     "dataPath" : ".clientName",
                     "schemaPath" : "#/properties/clientName/pattern"
                  };
               }
            },
            {
               description : "Should fail to create a new client with a client secret that's too short",
               client : clientClientSecretTooShort,
               getValidationProperties : function() {
                  return {
                     "keyword" : "minLength",
                     "dataPath" : ".clientSecret",
                     "schemaPath" : "#/properties/clientSecret/minLength"
                  };
               }
            },
            {
               description : "Should fail to create a new client with a client secret that's too long",
               client : clientClientSecretTooLong,
               getValidationProperties : function() {
                  return {
                     "keyword" : "maxLength",
                     "dataPath" : ".clientSecret",
                     "schemaPath" : "#/properties/clientSecret/maxLength"
                  };
               }
            },
            {
               description : "Should fail to create a new client with a reset password URL that's too short",
               client : clientResetPasswordUrlTooShort,
               getValidationProperties : function() {
                  return {
                     "keyword" : "minLength",
                     "dataPath" : ".resetPasswordUrl",
                     "schemaPath" : "#/properties/resetPasswordUrl/minLength"
                  };
               }
            },
            {
               description : "Should fail to create a new client with a verification URL that's too short",
               client : clientVerificationUrlTooShort,
               getValidationProperties : function() {
                  return {
                     "keyword" : "minLength",
                     "dataPath" : ".verificationUrl",
                     "schemaPath" : "#/properties/verificationUrl/minLength"
                  };
               }
            }
         ];

         validationFailureTests.forEach(function(test) {
            it(test.description, function(done) {
               superagent
                     .post(ESDR_CLIENTS_API_URL)
                     .set({ Authorization : "Bearer " + verifiedUser1['accessToken'] })
                     .send(test.client)
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
                        res.body.data.errors.should.have.length(1);
                        res.body.data.errors[0].should.have.properties(test.getValidationProperties());

                        done();
                     });
            });
         });

      });   // End Create

      describe("Find", function() {

         // define the expected values for each client's isPublic field
         const expectedIsPublic = {
            ESDR : 1,
            test_client_1 : 0,
            test_client_2 : 0,
            test_client_3 : 0,
            test_client_trimming : 0
         };

         it("Should be able to find clients (without authentication) and only see all fields for public clients", function(done) {

            superagent
                  .get(ESDR_CLIENTS_API_URL)
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
                                                             totalCount : Object.keys(expectedIsPublic).length,
                                                             offset : 0,
                                                             limit : 100
                                                          });

                     res.body.data.should.have.property('rows');
                     res.body.data.rows.should.have.length(Object.keys(expectedIsPublic).length);
                     res.body.data.rows.forEach(function(row) {
                        row.should.have.properties('id', 'displayName', 'clientName', 'creatorUserId', 'isPublic', 'created', 'modified');

                        row.should.have.property('isPublic', expectedIsPublic[row['clientName']]);
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

         const findWithAuthenticationTests = [
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
                     .get(ESDR_CLIENTS_API_URL)
                     .set({
                             Authorization : "Bearer " + test.user['accessToken']
                          })
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
                                                                totalCount : Object.keys(expectedIsPublic).length,
                                                                offset : 0,
                                                                limit : 100
                                                             });

                        res.body.data.should.have.property('rows');
                        res.body.data.rows.should.have.length(Object.keys(expectedIsPublic).length);

                        res.body.data.rows.forEach(function(row) {
                           row.should.have.properties('id', 'displayName', 'clientName', 'creatorUserId', 'isPublic', 'created', 'modified');

                           row.should.have.property('isPublic', expectedIsPublic[row['clientName']]);

                           // this user should be able to see the details of public clients and clients created by the user
                           if (row['isPublic'] || test.user.id === row.creatorUserId) {
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
                  .get(ESDR_CLIENTS_API_URL + "?whereOr=id=" + client2.id + ",clientName=" + client3['clientName'] + "&fields=id,clientName,email,creatorUserId&orderBy=-id")
                  .set({
                          Authorization : "Bearer " + verifiedUser2['accessToken']
                       })
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
                        if (client.creatorUserId === verifiedUser2.id) {
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
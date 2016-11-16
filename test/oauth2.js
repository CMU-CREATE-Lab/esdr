var should = require('should');
var flow = require('nimble');
var httpStatus = require('http-status');
var superagent = require('superagent-ls');
var requireNew = require('require-new');
var wipe = require('./fixture-helpers/wipe');
var setup = require('./fixture-helpers/setup');
var config = require('../config');

var ESDR_OAUTH_ROOT_URL = config.get("esdr:oauthRootUrl");

describe("OAuth2", function() {
   var unverifiedUser = requireNew('./fixtures/user1.json');
   var verifiedUser = requireNew('./fixtures/user2.json');
   var client1 = requireNew('./fixtures/client1.json');
   var tokens = null;
   var newTokens = null;

   before(function(initDone) {
      flow.series(
            [
               wipe.wipeAllData,
               function(done) {
                  setup.createUser(unverifiedUser, done);
               },
               function(done) {
                  setup.createUser(verifiedUser, done);
               },
               function(done) {
                  setup.verifyUser(verifiedUser, done);
               },
               function(done) {
                  client1.creatorUserId = unverifiedUser.id;
                  setup.createClient(client1, done);
               }
            ],
            initDone
      );
   });

   describe("Request Access Token", function() {

      it("Should be able to request access and refresh tokens for a verified user", function(done) {
         superagent
               .post(ESDR_OAUTH_ROOT_URL)
               .send({
                        grant_type : "password",
                        client_id : client1.clientName,
                        client_secret : client1.clientSecret,
                        username : verifiedUser.email,
                        password : verifiedUser.password
                     })
               .end(function(err, res) {
                  should.not.exist(err);
                  should.exist(res);

                  // save the tokens to compare with the next test
                  tokens = res.body;
                  res.should.have.property('status', httpStatus.OK);
                  res.should.have.property('body');
                  res.body.should.have.properties('access_token', 'refresh_token');
                  res.body.should.have.properties({
                                                     userId : verifiedUser.id,
                                                     expires_in : config.get("security:tokenLifeSecs"),
                                                     token_type : 'Bearer'
                                                  });

                  done();
               });
      });

      it("Should be able to request access and refresh tokens for the same user, and get back the same tokens", function(done) {
         superagent
               .post(ESDR_OAUTH_ROOT_URL)
               .send({
                        grant_type : "password",
                        client_id : client1.clientName,
                        client_secret : client1.clientSecret,
                        username : verifiedUser.email,
                        password : verifiedUser.password
                     })
               .end(function(err, res) {
                  should.not.exist(err);
                  should.exist(res);

                  res.should.have.property('status', httpStatus.OK);
                  res.should.have.property('body');
                  res.body.should.have.properties('access_token', 'refresh_token');
                  res.body.should.have.properties({
                                                     userId : verifiedUser.id,
                                                     expires_in : config.get("security:tokenLifeSecs"),
                                                     token_type : 'Bearer'
                                                  });
                  res.body.should.have.properties({
                                                     access_token : tokens.access_token,
                                                     refresh_token : tokens.refresh_token,
                                                     userId : tokens.userId,
                                                     expires_in : tokens.expires_in,
                                                     token_type : tokens.token_type
                                                  });
                  done();
               });
      });

      it("Should be able to request access and refresh tokens using Basic auth for the client ID and secret (and, again, get back the same tokens)", function(done) {
         superagent
               .post(ESDR_OAUTH_ROOT_URL)
               .auth(client1.clientName, client1.clientSecret)
               .send({
                        grant_type : "password",
                        username : verifiedUser.email,
                        password : verifiedUser.password
                     })
               .end(function(err, res) {
                  should.not.exist(err);
                  should.exist(res);

                  res.should.have.property('status', httpStatus.OK);
                  res.should.have.property('body');
                  res.body.should.have.properties('access_token', 'refresh_token');
                  res.body.should.have.properties({
                                                     userId : verifiedUser.id,
                                                     expires_in : config.get("security:tokenLifeSecs"),
                                                     token_type : 'Bearer'
                                                  });
                  res.body.should.have.properties({
                                                     access_token : tokens.access_token,
                                                     refresh_token : tokens.refresh_token,
                                                     userId : tokens.userId,
                                                     expires_in : tokens.expires_in,
                                                     token_type : tokens.token_type
                                                  });
                  done();
               });
      });

      it("Now force the existing tokens to be expired first, which should cause new tokens to be created", function(done) {
         setup.expireAccessToken(tokens.access_token, function() {
            superagent
                  .post(ESDR_OAUTH_ROOT_URL)
                  .auth(client1.clientName, client1.clientSecret)
                  .send({
                           grant_type : "password",
                           username : verifiedUser.email,
                           password : verifiedUser.password
                        })
                  .end(function(err, res) {
                     should.not.exist(err);
                     should.exist(res);

                     res.should.have.property('status', httpStatus.OK);
                     res.should.have.property('body');
                     res.body.should.have.properties('access_token', 'refresh_token');
                     res.body.should.have.properties({
                                                        userId : verifiedUser.id,
                                                        expires_in : config.get("security:tokenLifeSecs"),
                                                        token_type : 'Bearer'
                                                     });

                     // remember these tokens for the refresh tests below
                     tokens = res.body;

                     done();
                  });
         });
      });

      var failureTests = [
         {
            description : "Should fail to request access and refresh tokens with an invalid client ID",
            client : {
               clientName : "bogus",
               clientSecret : client1.clientSecret
            },
            user : verifiedUser,
            expectedStatusCode : httpStatus.UNAUTHORIZED
         },
         {
            description : "Should fail to request access and refresh tokens with an invalid client secret",
            client : {
               clientName : client1.clientName,
               clientSecret : "bogus"
            },
            user : verifiedUser,
            expectedStatusCode : httpStatus.UNAUTHORIZED
         },
         {
            description : "Should fail to request access and refresh tokens for an unverified user",
            client : client1,
            user : unverifiedUser,
            expectedStatusCode : httpStatus.FORBIDDEN,
            errorType : "invalid_grant"
         },
         {
            description : "Should fail to request access and refresh tokens with an invalid email (username)",
            client : client1,
            user : {
               email : "bogus",
               password : verifiedUser.password
            },
            expectedStatusCode : httpStatus.FORBIDDEN,
            errorType : "invalid_grant"
         },
         {
            description : "Should fail to request access and refresh tokens with an invalid password",
            client : client1,
            user : {
               email : verifiedUser.email,
               password : "bogus"
            },
            expectedStatusCode : httpStatus.FORBIDDEN,
            errorType : "invalid_grant"
         }
      ];

      failureTests.forEach(function(test) {
         it(test.description, function(done) {
            superagent
                  .post(ESDR_OAUTH_ROOT_URL)
                  .send({
                           grant_type : "password",
                           client_id : test.client.clientName,
                           client_secret : test.client.clientSecret,
                           username : test.user.email,
                           password : test.user.password
                        })
                  .end(function(err, res) {
                     should.not.exist(err);
                     should.exist(res);

                     res.should.have.property('status', test.expectedStatusCode);

                     if (typeof test.errorType !== 'undefined' && test.errorType != null) {
                        res.body.should.have.property('error', test.errorType);
                     }

                     done();
                  });
         });
      });

   });   // End Request Access Token

   describe("Refreshing Access Tokens", function() {

      it("Should be able to refresh a not-yet-expired access token", function(done) {
         superagent
               .post(ESDR_OAUTH_ROOT_URL)
               .send({
                        grant_type : "refresh_token",
                        client_id : client1.clientName,
                        client_secret : client1.clientSecret,
                        refresh_token : tokens.refresh_token
                     })
               .end(function(err, res) {
                  should.not.exist(err);
                  should.exist(res);

                  res.should.have.property('status', httpStatus.OK);
                  res.should.have.property('body');
                  res.body.should.have.properties('access_token', 'refresh_token');
                  res.body.should.have.properties({
                                                     expires_in : config.get("security:tokenLifeSecs"),
                                                     token_type : 'Bearer'
                                                  });

                  // remember these new tokens
                  newTokens = res.body;

                  // make sure the new tokens are different
                  newTokens.access_token.should.not.equal(tokens.access_token);
                  newTokens.refresh_token.should.not.equal(tokens.refresh_token);

                  done();
               });
      });

      it("Should be able to refresh an expired access token", function(done) {
         setup.expireAccessToken(newTokens.access_token, function() {
            superagent
                  .post(ESDR_OAUTH_ROOT_URL)
                  .send({
                           grant_type : "refresh_token",
                           client_id : client1.clientName,
                           client_secret : client1.clientSecret,
                           refresh_token : newTokens.refresh_token
                        })
                  .end(function(err, res) {
                     should.not.exist(err);
                     should.exist(res);

                     res.should.have.property('status', httpStatus.OK);
                     res.should.have.property('body');
                     res.body.should.have.properties('access_token', 'refresh_token');
                     res.body.should.have.properties({
                                                        expires_in : config.get("security:tokenLifeSecs"),
                                                        token_type : 'Bearer'
                                                     });

                     // remember these new tokens
                     var newerTokens = res.body;

                     // make sure the new tokens are different
                     newerTokens.access_token.should.not.equal(newTokens.access_token);
                     newerTokens.refresh_token.should.not.equal(newTokens.refresh_token);

                     // remember the tokens for the failure tests below
                     newTokens = newerTokens;

                     done();
                  });
         });
      });

      var failureTests = [
         {
            description : "Should not be able to refresh an access token with an invalid refresh token",
            client : client1,
            refreshToken : "bogus",
            expectedStatusCode : httpStatus.FORBIDDEN,
            errorType : "invalid_grant",
            errorDescription : "Invalid refresh token"
         },
         {
            description : "Should not be able to refresh an access token with a valid refresh token but invalid client ID",
            client : {
               clientName : "bogus",
               clientSecret : client1.clientSecret
            },
            refreshToken : function() {
               return newTokens.refresh_token;
            },
            expectedStatusCode : httpStatus.UNAUTHORIZED
         },
         {
            description : "Should not be able to refresh an access token with a valid refresh token but invalid client secret",
            client : {
               clientName : client1.clientName,
               clientSecret : "bogus"
            },
            refreshToken : function() {
               return newTokens.refresh_token;
            },
            expectedStatusCode : httpStatus.UNAUTHORIZED
         }
      ];

      failureTests.forEach(function(test) {
         it(test.description, function(done) {
            var refreshToken = typeof test.refreshToken === 'function' ? test.refreshToken() : test.refreshToken;
            superagent
                  .post(ESDR_OAUTH_ROOT_URL)
                  .send({
                           grant_type : "refresh_token",
                           client_id : test.client.clientName,
                           client_secret : test.client.clientSecret,
                           refresh_token : refreshToken
                        })
                  .end(function(err, res) {
                     should.not.exist(err);
                     should.exist(res);

                     res.should.have.property('status', test.expectedStatusCode);

                     if (typeof test.errorType !== 'undefined' && test.errorType != null) {
                        res.body.should.have.property('error', test.errorType);
                     }
                     if (typeof test.errorDescription !== 'undefined' && test.errorDescription != null) {
                        res.body.should.have.property('error_description', test.errorDescription);
                     }

                     done();
                  });
         });
      });

   });   // End Refreshing Access Tokens
});   // End Database
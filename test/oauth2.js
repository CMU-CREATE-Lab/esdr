var should = require('should');
var flow = require('nimble');
var httpStatus = require('http-status');
var superagent = require('superagent');
var wipe = require('./fixture-helpers/wipe');
var database = require('./fixture-helpers/database');
var config = require('../config');

var ESDR_API_ROOT_URL = config.get("esdr:apiRootUrl");
var ESDR_OAUTH_ROOT_URL = config.get("esdr:oauthRootUrl");

describe("OAuth2", function() {
   var unverifiedUser = require('./fixtures/user1.json');
   var verifiedUser = require('./fixtures/user2.json');
   var client1 = require('./fixtures/client1.json');
   var tokens = null;
   var newTokens = null;

   before(function(initDone) {
      flow.series(
            [
               wipe.wipeAllData,
               function(done) {
                  // insert the user and remember the id
                  database.insertUser(unverifiedUser, function(err, result) {
                     if (err) {
                        return done(err);
                     }
                     unverifiedUser.id = result.insertId;
                     done();
                  });
               },
               function(done) {
                  // insert the user and remember the id
                  database.insertUser(verifiedUser, function(err, result) {
                     if (err) {
                        return done(err);
                     }
                     verifiedUser.id = result.insertId;
                     done();
                  });
               },
               function(done) {
                  // mark verifiedUser as verified
                  superagent
                        .put(ESDR_API_ROOT_URL + "/user-verification")
                        .send({ token : verifiedUser.verificationToken })
                        .end(done);
               },
               function(done) {
                  // insert the client and remember the id
                  client1.creatorUserId = unverifiedUser.id;
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

      it("Should be able to request access and refresh tokens using Basic auth for the client ID and secret", function(done) {
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

                  // remember these tokens
                  tokens = res.body;

                  done();
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
      it("Should be able to refresh an access token", function(done) {
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
                  newTokens.should.not.equal(tokens);

                  done();
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
var should = require('should');
var flow = require('nimble');
var httpStatus = require('http-status');
var agent = require('supertest');
var wipe = require('./fixture-helpers/wipe');
var database = require('./fixture-helpers/database');
var config = require('../config');

var ESDR_OAUTH_ROOT_URL = config.get("esdr:oauthRootUrl");

describe("OAuth2", function() {
   var user1 = require('./fixtures/user1.json');
   var client1 = require('./fixtures/client1.json');

   before(function(initDone) {
      flow.series(
            [
               wipe.wipeAllData,
               function(done) {
                  // insert the user and remember the id
                  database.insertUser(user1, function(err, result) {
                     if (err) {
                        return done(err);
                     }

                     user1.id = result.insertId;
                     done();
                  });
               },
               function(done) {
                  // insert the user and remember the id
                  client1.creatorUserId = user1.id;
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

      it("Should fail to request access and refresh tokens for an unverified user", function(done) {
         agent(ESDR_OAUTH_ROOT_URL)
               .post("")
               .send({
                        grant_type : "password",
                        client_id : client1.clientName,
                        client_secret : client1.clientSecret,
                        username : user1.email,
                        password : user1.password
                     })
               .expect('Content-Type', /json/)
               .expect(httpStatus.FORBIDDEN)
               .end(function(err, res) {
                  should.not.exist(err);
                  should.exist(res);

                  res.body.should.have.property('error', 'invalid_grant');

                  done();
               });
      });

   });   // End Request Access Token
});   // End Database
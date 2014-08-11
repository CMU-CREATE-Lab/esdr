var assert = require('assert');
var should = require('should');
var agent = require('supertest');
var mysql = require('mysql');
var config = require('../config');
var flow = require('nimble');
var log = require('log4js').getLogger();
var Database = require("../models/Database");
var DuplicateRecordError = require('../lib/errors').DuplicateRecordError;

describe("ESDR", function() {
   var url = "http://localhost:3001";
   var testUser1 = {
      email : "test@user.com",
      password : "password",
      displayName : "Test User"
   };
   var testUser2 = {
      email : "test2@user.com",
      password : "password2"
   };
   var testUser3 = {
      email : "test3@user.com",
      password : "password3",
      displayName : ""
   };
   var testUser4 = {
      email : "test4@user.com",
      password : "password4",
      displayName : ""
   };
   var testUserNeedsTrimming = {
      email : "    test_trimming@user.com ",
      password : "password",
      displayName : "    Test User Trimming   "
   };
   var testClient = {
      displayName : "Test Client",
      clientName : "test_client",
      clientSecret : "I've got a secret / I've been hiding / Under my skin"
   };
   var testClientNeedsTrimming = {
      displayName : "   Test Client Trimming  ",
      clientName : "  test_client_trimming             ",
      clientSecret : "I've got a secret / I've been hiding / Under my skin"
   };
   var db = null;
   var verificationTokens = {};

   var pool = mysql.createPool({
                                  connectionLimit : config.get("database:pool:connectionLimit"),
                                  host : config.get("database:host"),
                                  port : config.get("database:port"),
                                  database : config.get("database:database"),
                                  user : config.get("database:username"),
                                  password : config.get("database:password")
                               });

   // make sure the database tables exist and, if so, wipe the tables clean
   before(function(initDone) {
      Database.create(function(err, theDatabase) {
         if (err) {
            throw err;
         }
         db = theDatabase;
         pool.getConnection(function(err, connection) {
            if (err) {
               throw err;
            }

            flow.series([
                           function(done) {
                              connection.query("DELETE FROM Tokens", function(err) {
                                 if (err) {
                                    throw err;
                                 }

                                 done();
                              });
                           },
                           function(done) {
                              connection.query("DELETE FROM Users", function(err) {
                                 if (err) {
                                    throw err;
                                 }

                                 done();
                              });
                           },
                           function(done) {
                              connection.query("DELETE FROM Clients", function(err) {
                                 if (err) {
                                    throw err;
                                 }

                                 done();
                              });
                           }
                        ],
                        function() {
                           initDone();
                        });
         });
      });
   });

   describe("REST API", function() {
      describe("Clients", function() {
         it("Should be able to create a new client", function(done) {
            agent(url)
                  .post("/api/v1/clients")
                  .send(testClient)
                  .end(function(err, res) {
                          if (err) {
                             return done(err);
                          }

                          res.should.have.property('status', 201);
                          res.body.should.have.property('code', 201);
                          res.body.should.have.property('status', 'success');
                          res.body.should.have.property('data');
                          res.body.data.should.have.property('displayName', testClient.displayName);
                          res.body.data.should.have.property('clientName', testClient.clientName);
                          done();
                       });
         });

         it("Should trim the displayName and clientName when creating a new client", function(done) {
            agent(url)
                  .post("/api/v1/clients")
                  .send(testClientNeedsTrimming)
                  .end(function(err, res) {
                          if (err) {
                             return done(err);
                          }

                          res.should.have.property('status', 201);
                          res.body.should.have.property('code', 201);
                          res.body.should.have.property('status', 'success');
                          res.body.should.have.property('data');
                          res.body.data.should.have.property('displayName', testClientNeedsTrimming.displayName.trim());
                          res.body.data.should.have.property('clientName', testClientNeedsTrimming.clientName.trim());
                          done();
                       });
         });

         it("Should fail to create the same client again", function(done) {
            agent(url)
                  .post("/api/v1/clients")
                  .send(testClient)
                  .end(function(err, res) {
                          if (err) {
                             return done(err);
                          }

                          res.should.have.property('status', 409);
                          res.body.should.have.property('code', 409);
                          res.body.should.have.property('status', 'error');
                          res.body.should.have.property('data');
                          res.body.data.should.have.property('clientName', testClient.clientName);
                          done();
                       });
         });

         it("Should fail to create a new client with missing required values", function(done) {
            agent(url)
                  .post("/api/v1/clients")
                  .send({ })
                  .end(function(err, res) {
                          if (err) {
                             return done(err);
                          }

                          res.should.have.property('status', 400);
                          res.body.should.have.property('code', 400);
                          res.body.should.have.property('status', 'error');
                          res.body.should.have.property('data');
                          res.body.data.should.have.length(2);
                          res.body.data[0].should.have.property('instanceContext', '#');
                          res.body.data[0].should.have.property('constraintName', 'required');
                          res.body.data[0].should.have.property('constraintValue', db.clients.jsonSchema.required);
                          res.body.data[0].should.have.property('constraintValue');
                          res.body.data[1].should.have.property('instanceContext', '#/clientSecret');
                          res.body.data[1].should.have.property('constraintName', 'type');
                          res.body.data[1].should.have.property('constraintValue', 'string');
                          res.body.data[1].should.have.property('constraintValue');
                          done();
                       });
         });

         it("Should fail to create a new client with a display name that's too short", function(done) {
            agent(url)
                  .post("/api/v1/clients")
                  .send({
                           displayName : "T",
                           clientName : testClient.clientName,
                           clientSecret : testClient.clientSecret
                        })
                  .end(function(err, res) {
                          if (err) {
                             return done(err);
                          }

                          res.should.have.property('status', 400);
                          res.body.should.have.property('code', 400);
                          res.body.should.have.property('status', 'error');
                          res.body.should.have.property('data');
                          res.body.data.should.have.length(1);
                          res.body.data[0].should.have.property('instanceContext', '#/displayName');
                          res.body.data[0].should.have.property('constraintName', 'minLength');
                          res.body.data[0].should.have.property('constraintValue', db.clients.jsonSchema.properties.displayName.minLength);
                          done();
                       });
         });

         it("Should fail to create a new client with a display name that's too long", function(done) {
            agent(url)
                  .post("/api/v1/clients")
                  .send({
                           displayName : "thisisareallylongstringthisisareallylongstringthisisareallylongstringthisisareallylongstringthisisareallylongstringthisisareallylongstringthisisareallylongstringthisisareallylongstringthisisareallylongstringthisisareallylongstringthisisareallylongstringthisisareallylongstring",
                           clientName : testClient.clientName,
                           clientSecret : testClient.clientSecret
                        })
                  .end(function(err, res) {
                          if (err) {
                             return done(err);
                          }

                          res.should.have.property('status', 400);
                          res.body.should.have.property('code', 400);
                          res.body.should.have.property('status', 'error');
                          res.body.should.have.property('data');
                          res.body.data.should.have.length(1);
                          res.body.data[0].should.have.property('instanceContext', '#/displayName');
                          res.body.data[0].should.have.property('constraintName', 'maxLength');
                          res.body.data[0].should.have.property('constraintValue', db.clients.jsonSchema.properties.displayName.maxLength);
                          done();
                       });
         });

         it("Should fail to create a new client with a client name that's too short", function(done) {
            agent(url)
                  .post("/api/v1/clients")
                  .send({
                           displayName : testClient.displayName,
                           clientName : "t",
                           clientSecret : testClient.clientSecret
                        })
                  .end(function(err, res) {
                          if (err) {
                             return done(err);
                          }

                          res.should.have.property('status', 400);
                          res.body.should.have.property('code', 400);
                          res.body.should.have.property('status', 'error');
                          res.body.should.have.property('data');
                          res.body.data.should.have.length(1);
                          res.body.data[0].should.have.property('instanceContext', '#/clientName');
                          res.body.data[0].should.have.property('constraintName', 'minLength');
                          res.body.data[0].should.have.property('constraintValue', db.clients.jsonSchema.properties.clientName.minLength);
                          done();
                       });
         });

         it("Should fail to create a new client with a client name that's too long", function(done) {
            agent(url)
                  .post("/api/v1/clients")
                  .send({
                           displayName : testClient.displayName,
                           clientName : "thisisareallylongstringthisisareallylongstringthisisareallylongstringthisisareallylongstringthisisareallylongstringthisisareallylongstringthisisareallylongstringthisisareallylongstringthisisareallylongstringthisisareallylongstringthisisareallylongstringthisisareallylongstring",
                           clientSecret : testClient.clientSecret
                        })
                  .end(function(err, res) {
                          if (err) {
                             return done(err);
                          }

                          res.should.have.property('status', 400);
                          res.body.should.have.property('code', 400);
                          res.body.should.have.property('status', 'error');
                          res.body.should.have.property('data');
                          res.body.data.should.have.length(1);
                          res.body.data[0].should.have.property('instanceContext', '#/clientName');
                          res.body.data[0].should.have.property('constraintName', 'maxLength');
                          res.body.data[0].should.have.property('constraintValue', db.clients.jsonSchema.properties.clientName.maxLength);
                          done();
                       });
         });

         it("Should fail to create a new client with a client secret that's too short", function(done) {
            agent(url)
                  .post("/api/v1/clients")
                  .send({
                           displayName : testClient.displayName,
                           clientName : testClient.clientName,
                           clientSecret : "I"
                        })
                  .end(function(err, res) {
                          if (err) {
                             return done(err);
                          }

                          res.should.have.property('status', 400);
                          res.body.should.have.property('code', 400);
                          res.body.should.have.property('status', 'error');
                          res.body.should.have.property('data');
                          res.body.data.should.have.length(1);
                          res.body.data[0].should.have.property('instanceContext', '#/clientSecret');
                          res.body.data[0].should.have.property('constraintName', 'minLength');
                          res.body.data[0].should.have.property('constraintValue', db.clients.jsonSchema.properties.clientSecret.minLength);
                          done();
                       });
         });

         it("Should fail to create a new client with a client secret that's too long", function(done) {
            agent(url)
                  .post("/api/v1/clients")
                  .send({
                           displayName : testClient.displayName,
                           clientName : testClient.clientName,
                           clientSecret : "thisisareallylongstringthisisareallylongstringthisisareallylongstringthisisareallylongstringthisisareallylongstringthisisareallylongstringthisisareallylongstringthisisareallylongstringthisisareallylongstringthisisareallylongstringthisisareallylongstringthisisareallylongstring"
                        })
                  .end(function(err, res) {
                          if (err) {
                             return done(err);
                          }

                          res.should.have.property('status', 400);
                          res.body.should.have.property('code', 400);
                          res.body.should.have.property('status', 'error');
                          res.body.should.have.property('data');
                          res.body.data.should.have.length(1);
                          res.body.data[0].should.have.property('instanceContext', '#/clientSecret');
                          res.body.data[0].should.have.property('constraintName', 'maxLength');
                          res.body.data[0].should.have.property('constraintValue', db.clients.jsonSchema.properties.clientSecret.maxLength);
                          done();
                       });
         });

         it("Should fail to create a new client with a client name that's already in use", function(done) {
            agent(url)
                  .post("/api/v1/clients")
                  .send(testClient)
                  .end(function(err, res) {
                          if (err) {
                             return done(err);
                          }

                          res.should.have.property('status', 409);
                          res.body.should.have.property('code', 409);
                          res.body.should.have.property('status', 'error');
                          done();
                       });
         });
      });

      describe("Users", function() {

         it("Should be able to create a new user", function(done) {
            agent(url)
                  .post("/api/v1/users")
                  .send({user : testUser1, client : testClient})
                  .end(function(err, res) {
                          if (err) {
                             return done(err);
                          }

                          res.should.have.property('status', 201);
                          res.body.should.have.property('code', 201);
                          res.body.should.have.property('status', 'success');
                          res.body.should.have.property('data');
                          res.body.data.should.have.property('id');
                          res.body.data.should.have.property('email', testUser1.email);
                          res.body.data.should.have.property('displayName', testUser1.displayName);
                          res.body.data.should.have.property('verificationToken');

                          // remember the verification token so we can verify this user
                          verificationTokens.testUser1 = res.body.data.verificationToken;
                          done();
                       });
         });

         it("Should trim the email and displayName when creating a new user", function(done) {
            agent(url)
                  .post("/api/v1/users")
                  .send({user : testUserNeedsTrimming, client : testClient})
                  .end(function(err, res) {
                          if (err) {
                             return done(err);
                          }

                          res.should.have.property('status', 201);
                          res.body.should.have.property('code', 201);
                          res.body.should.have.property('status', 'success');
                          res.body.should.have.property('data');
                          res.body.data.should.have.property('id');
                          res.body.data.should.have.property('email', testUserNeedsTrimming.email.trim());
                          res.body.data.should.have.property('displayName', testUserNeedsTrimming.displayName.trim());
                          res.body.data.should.have.property('verificationToken');

                          done();
                       });
         });

         it("Should fail to create the same user again", function(done) {
            agent(url)
                  .post("/api/v1/users")
                  .send({user : testUser1, client : testClient})
                  .end(function(err, res) {
                          if (err) {
                             return done(err);
                          }

                          res.should.have.property('status', 409);
                          res.body.should.have.property('code', 409);
                          res.body.should.have.property('status', 'error');
                          res.body.should.have.property('data');
                          res.body.data.should.have.property('email', testUser1.email);
                          done();
                       });
         });

         it("Should be able to create a new user with no display name", function(done) {
            agent(url)
                  .post("/api/v1/users")
                  .send({user : testUser2, client : testClient})
                  .end(function(err, res) {
                          if (err) {
                             return done(err);
                          }

                          res.should.have.property('status', 201);
                          res.body.should.have.property('code', 201);
                          res.body.should.have.property('status', 'success');
                          res.body.should.have.property('data');
                          res.body.data.should.have.property('id');
                          res.body.data.should.have.property('email', testUser2.email);
                          res.body.data.should.not.have.property('displayName');
                          res.body.data.should.have.property('verificationToken');

                          // remember the verification token so we can verify this user
                          verificationTokens.testUser2 = res.body.data.verificationToken;
                          done();
                       });
         });

         it("Should be able to create a new user with empty display name", function(done) {
            agent(url)
                  .post("/api/v1/users")
                  .send({user : testUser3, client : testClient})
                  .end(function(err, res) {
                          if (err) {
                             return done(err);
                          }

                          res.should.have.property('status', 201);
                          res.body.should.have.property('code', 201);
                          res.body.should.have.property('status', 'success');
                          res.body.should.have.property('data');
                          res.body.data.should.have.property('id');
                          res.body.data.should.have.property('email', testUser3.email);
                          res.body.data.should.not.have.property('displayName', null);
                          res.body.data.should.have.property('verificationToken');

                          // remember the verification token so we can verify this user
                          verificationTokens.testUser3 = res.body.data.verificationToken;
                          done();
                       });
         });

         it("Should be able to create a new user with no client specified", function(done) {
            agent(url)
                  .post("/api/v1/users")
                  .send({user : testUser4})
                  .end(function(err, res) {
                          if (err) {
                             return done(err);
                          }

                          res.should.have.property('status', 201);
                          res.body.should.have.property('code', 201);
                          res.body.should.have.property('status', 'success');
                          res.body.should.have.property('data');
                          res.body.data.should.have.property('id');
                          res.body.data.should.have.property('email', testUser4.email);
                          res.body.data.should.not.have.property('displayName', null);
                          res.body.data.should.have.property('verificationToken');

                          // remember the verification token so we can verify this user
                          verificationTokens.testUser4 = res.body.data.verificationToken;
                          done();
                       });
         });

         it("Should fail to create a new user with missing user and client", function(done) {
            agent(url)
                  .post("/api/v1/users")
                  .send({})
                  .end(function(err, res) {
                          if (err) {
                             return done(err);
                          }

                          res.should.have.property('status', 400);
                          res.body.should.have.property('code', 400);
                          res.body.should.have.property('status', 'error');
                          res.body.should.have.property('data');
                          res.body.data.should.have.length(2);
                          res.body.data[0].should.have.property('instanceContext', '#');
                          res.body.data[0].should.have.property('constraintName', 'required');
                          res.body.data[0].should.have.property('constraintValue', db.users.jsonSchema.required);
                          res.body.data[1].should.have.property('instanceContext', '#/password');
                          res.body.data[1].should.have.property('constraintName', 'type');
                          res.body.data[1].should.have.property('constraintValue', "string");
                          done();
                       });
         });

         it("Should fail to create a new user with missing user but present client", function(done) {
            agent(url)
                  .post("/api/v1/users")
                  .send({user : {}, client : testClient})
                  .end(function(err, res) {
                          if (err) {
                             return done(err);
                          }

                          res.should.have.property('status', 400);
                          res.body.should.have.property('code', 400);
                          res.body.should.have.property('status', 'error');
                          res.body.should.have.property('data');
                          res.body.data.should.have.length(2);
                          res.body.data[0].should.have.property('instanceContext', '#');
                          res.body.data[0].should.have.property('constraintName', 'required');
                          res.body.data[0].should.have.property('constraintValue', db.users.jsonSchema.required);
                          res.body.data[1].should.have.property('instanceContext', '#/password');
                          res.body.data[1].should.have.property('constraintName', 'type');
                          res.body.data[1].should.have.property('constraintValue', "string");
                          done();
                       });
         });

         it("Should fail to create a new user with an email address that's too short", function(done) {
            agent(url)
                  .post("/api/v1/users")
                  .send({
                           user : {
                              email : "t@t.c",
                              password : testUser1.password,
                              displayName : testUser1.displayName
                           },
                           client : testClient
                        })
                  .end(function(err, res) {
                          if (err) {
                             return done(err);
                          }

                          res.should.have.property('status', 400);
                          res.body.should.have.property('code', 400);
                          res.body.should.have.property('status', 'error');
                          res.body.should.have.property('data');
                          res.body.data.should.have.length(1);
                          res.body.data[0].should.have.property('instanceContext', '#/email');
                          res.body.data[0].should.have.property('constraintName', 'minLength');
                          res.body.data[0].should.have.property('constraintValue', db.users.jsonSchema.properties.email.minLength);
                          done();
                       });
         });

         it("Should fail to create a new user with an email address that's too long", function(done) {
            agent(url)
                  .post("/api/v1/users")
                  .send({
                           user : {
                              email : "thisisaverylongemailaddressthatismuchtoolongandsoitwillfailvalidation@domainnamedomainnamedomainnamedomainnamedomainnamedomainnamedomainnamedomainnamedomainnamedomainnamedomainnamedomainnamedomainnamedomainnamedomainnamedomainnamedomainnamedomainnamedomainname.com",
                              password : testUser1.password,
                              displayName : testUser1.displayName
                           },
                           client : testClient
                        })
                  .end(function(err, res) {
                          if (err) {
                             return done(err);
                          }

                          res.should.have.property('status', 400);
                          res.body.should.have.property('code', 400);
                          res.body.should.have.property('status', 'error');
                          res.body.should.have.property('data');
                          res.body.data.should.have.length(1);
                          res.body.data[0].should.have.property('instanceContext', '#/email');
                          res.body.data[0].should.have.property('constraintName', 'maxLength');
                          res.body.data[0].should.have.property('constraintValue', db.users.jsonSchema.properties.email.maxLength);
                          done();
                       });
         });

         it("Should fail to create a new user with a password that's too short", function(done) {
            agent(url)
                  .post("/api/v1/users")
                  .send({
                           user : {
                              email : testUser1.email,
                              password : "p",
                              displayName : testUser1.displayName
                           },
                           client : testClient
                        })
                  .end(function(err, res) {
                          if (err) {
                             return done(err);
                          }

                          res.should.have.property('status', 400);
                          res.body.should.have.property('code', 400);
                          res.body.should.have.property('status', 'error');
                          res.body.should.have.property('data');
                          res.body.data.should.have.length(1);
                          res.body.data[0].should.have.property('instanceContext', '#/password');
                          res.body.data[0].should.have.property('constraintName', 'minLength');
                          res.body.data[0].should.have.property('constraintValue', db.users.jsonSchema.properties.password.minLength);
                          done();
                       });
         });

         it("Should fail to create a new user with a password that's too long", function(done) {
            agent(url)
                  .post("/api/v1/users")
                  .send({
                           user : {
                              email : testUser1.email,
                              password : "thisisareallylongstringthisisareallylongstringthisisareallylongstringthisisareallylongstringthisisareallylongstringthisisareallylongstringthisisareallylongstringthisisareallylongstringthisisareallylongstringthisisareallylongstringthisisareallylongstringthisisareallylongstring",
                              displayName : testUser1.displayName
                           },
                           client : testClient
                        })
                  .end(function(err, res) {
                          if (err) {
                             return done(err);
                          }

                          res.should.have.property('status', 400);
                          res.body.should.have.property('code', 400);
                          res.body.should.have.property('status', 'error');
                          res.body.should.have.property('data');
                          res.body.data.should.have.length(1);
                          res.body.data[0].should.have.property('instanceContext', '#/password');
                          res.body.data[0].should.have.property('constraintName', 'maxLength');
                          res.body.data[0].should.have.property('constraintValue', db.users.jsonSchema.properties.password.maxLength);
                          done();
                       });
         });

         it("Should fail to create a new user with a display name that's too long", function(done) {
            agent(url)
                  .post("/api/v1/users")
                  .send({
                           user : {
                              email : testUser1.email,
                              password : testUser1.password,
                              displayName : "thisisareallylongstringthisisareallylongstringthisisareallylongstringthisisareallylongstringthisisareallylongstringthisisareallylongstringthisisareallylongstringthisisareallylongstringthisisareallylongstringthisisareallylongstringthisisareallylongstringthisisareallylongstring"
                           },
                           client : testClient
                        })
                  .end(function(err, res) {
                          if (err) {
                             return done(err);
                          }

                          res.should.have.property('status', 400);
                          res.body.should.have.property('code', 400);
                          res.body.should.have.property('status', 'error');
                          res.body.should.have.property('data');
                          res.body.data.should.have.length(1);
                          res.body.data[0].should.have.property('instanceContext', '#/displayName');
                          res.body.data[0].should.have.property('constraintName', 'maxLength');
                          res.body.data[0].should.have.property('constraintValue', db.users.jsonSchema.properties.displayName.maxLength);
                          done();
                       });
         });

         it("Should fail to create a new user with a email address that's invalid", function(done) {
            agent(url)
                  .post("/api/v1/users")
                  .send({
                           user : {
                              email : "not_a_real_email_address",
                              password : testUser1.password,
                              displayName : testUser1.displayName
                           },
                           client : testClient
                        })
                  .end(function(err, res) {
                          if (err) {
                             return done(err);
                          }

                          res.should.have.property('status', 400);
                          res.body.should.have.property('code', 400);
                          res.body.should.have.property('status', 'error');
                          res.body.should.have.property('data');
                          res.body.data.should.have.length(1);
                          res.body.data[0].should.have.property('instanceContext', '#/email');
                          res.body.data[0].should.have.property('constraintName', 'format');
                          res.body.data[0].should.have.property('constraintValue', 'email');
                          res.body.data[0].should.have.property('kind', 'FormatValidationError');
                          done();
                       });
         });

         it("Should fail to create a new user with a email address that's already in use", function(done) {
            agent(url)
                  .post("/api/v1/users")
                  .send({user : testUser1})
                  .end(function(err, res) {
                          if (err) {
                             return done(err);
                          }

                          res.should.have.property('status', 409);
                          res.body.should.have.property('code', 409);
                          res.body.should.have.property('status', 'error');
                          done();
                       });
         });

         describe("Account Verification", function() {
            it("Should be able to request that the verification token be sent again (after creation, before verification)", function(done) {
               agent(url)
                     .post("/api/v1/users/"+testUser1.email+"/resendVerification")
                     .send({client : testClient})
                     .end(function(err, res) {
                             if (err) {
                                return done(err);
                             }

                             res.should.have.property('status', 201);
                             res.body.should.have.property('code', 201);
                             res.body.should.have.property('status', 'success');
                             res.body.should.have.property('data');
                             res.body.data.should.have.property('email', testUser1.email);
                             res.body.data.should.have.property('isVerified', false);
                             res.body.data.should.have.property('verified', '0000-00-00 00:00:00');
                             res.body.data.should.have.property('verificationToken', verificationTokens.testUser1);

                             done();
                          });
            });

            it("Should be able to verify a user", function(done) {

               agent(url)
                     .get("/api/v1/users/" + verificationTokens.testUser1 + "/verify")
                     .end(function(err, res) {
                             if (err) {
                                return done(err);
                             }

                             res.should.have.property('status', 200);
                             res.body.should.have.property('code', 200);
                             res.body.should.have.property('status', 'success');
                             res.body.should.have.property('data');
                             res.body.data.should.have.property('isVerified', true);

                             done();
                          });
            });

            it("Should be able to request that the verification token be sent again (after creation, after verification)", function(done) {
               agent(url)
                     .post("/api/v1/users/"+testUser1.email+"/resendVerification")
                     .send({client : testClient})
                     .end(function(err, res) {
                             if (err) {
                                return done(err);
                             }

                             res.should.have.property('status', 200);
                             res.body.should.have.property('code', 200);
                             res.body.should.have.property('status', 'success');
                             res.body.should.have.property('data');
                             res.body.data.should.have.property('email', testUser1.email);
                             res.body.data.should.have.property('isVerified', true);
                             res.body.data.should.have.property('verificationToken', verificationTokens.testUser1);

                             done();
                          });
            });

            it("Verification should return the same thing if called again", function(done) {

               agent(url)
                     .get("/api/v1/users/" + verificationTokens.testUser1 + "/verify")
                     .end(function(err, res) {
                             if (err) {
                                return done(err);
                             }

                             res.should.have.property('status', 200);
                             res.body.should.have.property('code', 200);
                             res.body.should.have.property('status', 'success');
                             res.body.should.have.property('data');
                             res.body.data.should.have.property('isVerified', true);

                             done();
                          });

            });

            it("Verification should fail for a bogus verification token", function(done) {

               agent(url)
                     .get("/api/v1/users/" + "bogus_token" + "/verify")
                     .end(function(err, res) {
                             if (err) {
                                return done(err);
                             }

                             res.should.have.property('status', 400);
                             res.body.should.have.property('code', 400);
                             res.body.should.have.property('status', 'error');
                             res.body.should.have.property('data');
                             res.body.data.should.have.property('isVerified', false);

                             done();
                          });
            });

            it("Should fail when requesting that the verification token be sent again for an unknown user", function(done) {
               var unknownUser = {email : 'unknown@unknown.com'};
               agent(url)
                     .post("/api/v1/users/"+unknownUser.email+"/resendVerification")
                     .end(function(err, res) {
                             if (err) {
                                return done(err);
                             }

                             res.should.have.property('status', 400);
                             res.body.should.have.property('code', 400);
                             res.body.should.have.property('status', 'error');
                             res.body.should.have.property('data');
                             res.body.should.have.property('data');
                             should(res.body.data).eql({email : unknownUser.email});

                             done();
                          });
            });

         });
      });
   });

   describe("OAuth 2.0", function() {
      var tokens = null;
      var newTokens = null;

      it("Should fail to request access and refresh tokens for an unverified user", function(done) {
         agent(url)
               .post("/oauth/token")
               .send({
                        grant_type : "password",
                        client_id : testClient.clientName,
                        client_secret : testClient.clientSecret,
                        username : testUser2.email,
                        password : testUser2.password
                     })
               .end(function(err, res) {
                       if (err) {
                          return done(err);
                       }

                       res.should.have.property('status', 403);
                       res.body.should.have.property('error', 'invalid_grant');

                       done();
                    });
      });

      it("Should be able to request access and refresh tokens after verifying the user", function(done) {
         agent(url)
               .get("/api/v1/users/" + verificationTokens.testUser2 + "/verify")
               .end(function(err, res) {
                       if (err) {
                          return done(err);
                       }

                       res.should.have.property('status', 200);
                       res.body.should.have.property('code', 200);
                       res.body.should.have.property('status', 'success');
                       res.body.should.have.property('data');
                       res.body.data.should.have.property('isVerified', true);

                       // now that the user is verified, request access and refresh tokens
                       agent(url)
                             .post("/oauth/token")
                             .send({
                                      grant_type : "password",
                                      client_id : testClient.clientName,
                                      client_secret : testClient.clientSecret,
                                      username : testUser1.email,
                                      password : testUser1.password
                                   })
                             .end(function(err, res) {
                                     if (err) {
                                        return done(err);
                                     }

                                     res.should.have.property('status', 200);
                                     res.body.should.have.property('access_token');
                                     res.body.should.have.property('refresh_token');
                                     res.body.should.have.property('expires_in', 3600);
                                     res.body.should.have.property('token_type', "Bearer");

                                     // remember these tokens
                                     tokens = res.body;

                                     done();
                                  });
                    });
      });

      it("Should not be able to request access and refresh tokens with an invalid client ID", function(done) {
         agent(url)
               .post("/oauth/token")
               .send({
                        grant_type : "password",
                        client_id : "bogus",
                        client_secret : testClient.clientSecret,
                        username : testUser1.email,
                        password : testUser1.password
                     })
               .end(function(err, res) {
                       if (err) {
                          return done(err);
                       }

                       res.should.have.property('status', 401);

                       done();
                    });
      });

      it("Should not be able to request access and refresh tokens with an invalid client secret", function(done) {
         agent(url)
               .post("/oauth/token")
               .send({
                        grant_type : "password",
                        client_id : testClient.clientName,
                        client_secret : "bogus",
                        username : testUser1.email,
                        password : testUser1.password
                     })
               .end(function(err, res) {
                       if (err) {
                          return done(err);
                       }

                       res.should.have.property('status', 401);

                       done();
                    });
      });

      it("Should not be able to request access and refresh tokens with an invalid email (username)", function(done) {
         agent(url)
               .post("/oauth/token")
               .send({
                        grant_type : "password",
                        client_id : testClient.clientName,
                        client_secret : testClient.clientSecret,
                        username : "bogus",
                        password : testUser1.password
                     })
               .end(function(err, res) {
                       if (err) {
                          return done(err);
                       }

                       res.should.have.property('status', 403);

                       done();
                    });
      });

      it("Should not be able to request access and refresh tokens with an invalid password", function(done) {
         agent(url)
               .post("/oauth/token")
               .send({
                        grant_type : "password",
                        client_id : testClient.clientName,
                        client_secret : testClient.clientSecret,
                        username : testUser1.email,
                        password : "bogus"
                     })
               .end(function(err, res) {
                       if (err) {
                          return done(err);
                       }

                       res.should.have.property('status', 403);

                       done();
                    });
      });

      it("Should be able to access a protected resource with the access token", function(done) {
         agent(url)
               .get("/api/v1/users")
               .set({
                       Authorization : "Bearer " + tokens.access_token
                    })
               .end(function(err, res) {
                       if (err) {
                          return done(err);
                       }

                       res.should.have.property('status', 200);
                       done();
                    });
      });

      it("Should not be able to access a protected resource without the access token", function(done) {
         agent(url)
               .get("/api/v1/users")
               .end(function(err, res) {
                       if (err) {
                          return done(err);
                       }

                       res.should.have.property('status', 401);

                       done();
                    });
      });

      it("Should not be able to access a protected resource with an invalid access token", function(done) {
         agent(url)
               .get("/api/v1/users")
               .set({
                       Authorization : "Bearer bogus"
                    })
               .end(function(err, res) {
                       if (err) {
                          return done(err);
                       }

                       res.should.have.property('status', 401);

                       done();
                    });
      });

      it("Should be able to refresh an access token", function(done) {
         agent(url)
               .post("/oauth/token")
               .send({
                        grant_type : "refresh_token",
                        client_id : testClient.clientName,
                        client_secret : testClient.clientSecret,
                        refresh_token : tokens.refresh_token
                     })
               .end(function(err, res) {
                       if (err) {
                          return done(err);
                       }

                       res.should.have.property('status', 200);
                       res.body.should.have.property('access_token');
                       res.body.should.have.property('refresh_token');
                       res.body.should.have.property('expires_in', 3600);
                       res.body.should.have.property('token_type', "Bearer");

                       // remember these new tokens
                       newTokens = res.body;

                       // make sure the new tokens are different
                       newTokens.should.not.equal(tokens);

                       done();
                    });
      });

      it("Should be able to access a protected resource with the new access token", function(done) {
         agent(url)
               .get("/api/v1/users")
               .set({
                       Authorization : "Bearer " + newTokens.access_token
                    })
               .end(function(err, res) {
                       if (err) {
                          return done(err);
                       }

                       res.should.have.property('status', 200);
                       done();
                    });
      });

      it("Should not be able to access a protected resource with the old access token", function(done) {
         agent(url)
               .get("/api/v1/users")
               .set({
                       Authorization : "Bearer " + tokens.access_token
                    })
               .end(function(err, res) {
                       if (err) {
                          return done(err);
                       }

                       res.should.have.property('status', 401);
                       done();
                    });
      });

      it("Should not be able to refresh an access token with an invalid refresh token", function(done) {
         agent(url)
               .post("/oauth/token")
               .send({
                        grant_type : "refresh_token",
                        client_id : testClient.clientName,
                        client_secret : testClient.clientSecret,
                        refresh_token : "bogus"
                     })
               .end(function(err, res) {
                       if (err) {
                          return done(err);
                       }

                       res.should.have.property('status', 403);
                       res.body.should.have.property('error', 'invalid_grant');
                       res.body.should.have.property('error_description', 'Invalid refresh token');

                       done();
                    });
      });

      it("Should not be able to refresh an access token with a valid refresh token but invalid client ID", function(done) {
         agent(url)
               .post("/oauth/token")
               .send({
                        grant_type : "refresh_token",
                        client_id : "bogus",
                        client_secret : testClient.clientSecret,
                        refresh_token : newTokens.refresh_token
                     })
               .end(function(err, res) {
                       if (err) {
                          return done(err);
                       }

                       res.should.have.property('status', 401);

                       done();
                    });
      });

      it("Should not be able to refresh an access token with a valid refresh token but invalid client secret", function(done) {
         agent(url)
               .post("/oauth/token")
               .send({
                        grant_type : "refresh_token",
                        client_id : testClient.clientName,
                        client_secret : "bogus",
                        refresh_token : newTokens.refresh_token
                     })
               .end(function(err, res) {
                       if (err) {
                          return done(err);
                       }

                       res.should.have.property('status', 401);

                       done();
                    });
      });

   });

   describe("Database", function() {
      describe("Clients", function() {
         it("Should not be able to create the same client again", function(done) {
            db.clients.create(testClient, function(err, result) {
               (err != null).should.be.true;
               (result == null).should.be.true;
               (err instanceof DuplicateRecordError).should.be.true;
               err.should.have.property("data");
               err.data.should.have.property("code", "ER_DUP_ENTRY");
               done();
            });
         });

         it("Should be able to find a client by name", function(done) {
            db.clients.findByName(testClient.clientName, function(err, client) {
               if (err) {
                  return done(err);
               }
               client.should.have.property("id");
               client.should.have.property("displayName", testClient.displayName);
               client.should.have.property("clientName", testClient.clientName);
               client.should.have.property("clientSecret", testClient.clientSecret);
               client.should.have.property("created");
               done();
            });
         });

         it("Should be able to find a client by name and secret", function(done) {
            db.clients.findByNameAndSecret(testClient.clientName, testClient.clientSecret, function(err, client) {
               if (err) {
                  return done(err);
               }
               client.should.have.property("id");
               client.should.have.property("displayName", testClient.displayName);
               client.should.have.property("clientName", testClient.clientName);
               client.should.have.property("clientSecret", testClient.clientSecret);
               client.should.have.property("created");
               done();
            });
         });

         it("Should not be able to find a client with a non-existent name", function(done) {
            db.clients.findByName("bogus", function(err, client) {
               if (err) {
                  return done(err);
               }
               assert.equal(client, null);
               done();
            });
         });

         it("Should not be able to find a client by name and secret with a non-existent name", function(done) {
            db.clients.findByNameAndSecret("bogus", testClient.clientSecret, function(err, client) {
               if (err) {
                  return done(err);
               }
               assert.equal(client, null);
               done();
            });
         });

         it("Should not be able to find a client by name and secret with an incorrect secret", function(done) {
            db.clients.findByNameAndSecret(testClient.clientName, "bogus", function(err, client) {
               if (err) {
                  return done(err);
               }
               assert.equal(client, null);
               done();
            });
         });
      });

      describe("Users", function() {
         var foundUser = null;

         it("Should not be able to create the same user again", function(done) {
            db.users.create(testUser1, function(err, result) {
               (err != null).should.be.true;
               (result == null).should.be.true;
               (err instanceof DuplicateRecordError).should.be.true;
               err.should.have.property("data");
               err.data.should.have.property("code", "ER_DUP_ENTRY");
               done();
            });
         });

         it("Should be able to find a user by email", function(done) {
            db.users.findByEmail(testUser1.email, function(err, user) {
               if (err) {
                  return done(err);
               }
               user.should.have.property("id");
               user.should.have.property("email", testUser1.email);
               user.should.have.property("password");
               user.should.have.property("displayName", testUser1.displayName);
               user.should.have.property("created");
               user.should.have.property("modified");

               // remember this user so we can do the next test
               foundUser = user;

               done();
            });
         });

         it("Should be able to find a user by ID", function(done) {
            db.users.findById(foundUser.id, function(err, user) {
               if (err) {
                  return done(err);
               }

               // do a deep equal
               should(user).eql(foundUser);

               done();
            });
         });

         it("Should be able to find a user by email and password", function(done) {
            db.users.findByEmailAndPassword(testUser1.email, testUser1.password, function(err, user) {
               if (err) {
                  return done(err);
               }
               user.should.have.property("id");
               user.should.have.property("email", testUser1.email);
               user.should.have.property("password");
               user.should.have.property("displayName", testUser1.displayName);
               user.should.have.property("created");
               user.should.have.property("modified");

               done();
            });
         });

         it("Should not be able to find a user by a non-existent email", function(done) {
            db.users.findByEmail("bogus", function(err, user) {
               if (err) {
                  return done(err);
               }
               assert.equal(user, null);

               done();
            });
         });

         it("Should not be able to find a user by a non-existent ID", function(done) {
            db.users.findById(-1, function(err, user) {
               if (err) {
                  return done(err);
               }
               assert.equal(user, null);

               done();
            });
         });

         it("Should not be able to find a user by email and password with a non-existent email", function(done) {
            db.users.findByEmailAndPassword("bogus", testUser1.password, function(err, user) {
               if (err) {
                  return done(err);
               }
               assert.equal(user, null);

               done();
            });
         });

         it("Should not be able to find a user by email and password with an incorrect password", function(done) {
            db.users.findByEmailAndPassword(testUser1.email, "bogus", function(err, user) {
               if (err) {
                  return done(err);
               }
               assert.equal(user, null);

               done();
            });
         });
      });
   });
});
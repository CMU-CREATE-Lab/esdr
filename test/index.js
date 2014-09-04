var assert = require('assert');
var should = require('should');
var agent = require('supertest');
var mysql = require('mysql');
var config = require('../config');
var flow = require('nimble');
var httpStatus = require('http-status');
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
      clientSecret : "I've got a secret / I've been hiding / Under my skin",
      resetPasswordUrl : "http://localhost:3333/password-reset/:resetPasswordToken",
      verificationUrl : "http://localhost:3333/user-verification/:verificationToken"
   };
   var testClientNeedsTrimming = {
      displayName : "   Test Client Trimming  ",
      clientName : "  test_client_trimming             ",
      clientSecret : "I've got a secret / I've been hiding / Under my skin",
      resetPasswordUrl : "http://localhost:3333/password-reset/:resetPasswordToken",
      verificationUrl : "http://localhost:3333/user-verification/:verificationToken"
   };
   var testProduct1 = {
      name : 'cattfish_v1',
      prettyName : 'CATTfish v1',
      vendor : 'CMU CREATE Lab',
      description : 'The CATTfish v1 water temperature and conductivity sensor.',
      isPublic : true,
      defaultChannelSpec : { "temperature" : { "prettyName" : "Temperature", "units" : "C" }, "conductivity" : { "prettyName" : "Conductivity", "units" : "uS/cm" }}
   };
   var testProduct2 = {
      name : 'cattfish_v2',
      prettyName : 'CATTfish v2',
      vendor : 'CMU CREATE Lab',
      description : 'The CATTfish v2 water temperature and conductivity sensor.',
      isPublic : false,
      defaultChannelSpec : { "temperature" : { "prettyName" : "Temperature", "units" : "C" }, "conductivity" : { "prettyName" : "Conductivity", "units" : "uS/cm" }, "error_codes" : { "prettyName" : "Error Codes", "units" : null }}
   };
   var testProduct3 = {
      name : 'cattfish_v3',
      prettyName : 'CATTfish v3',
      vendor : 'CMU CREATE Lab',
      description : 'The CATTfish v3 water temperature and conductivity sensor.',
      isPublic : true,
      defaultChannelSpec : { "temperature" : { "prettyName" : "Temperature", "units" : "C" }, "conductivity" : { "prettyName" : "Conductivity", "units" : "uS/cm" }, "error_codes" : { "prettyName" : "Error Codes", "units" : null }, "battery_voltage" : { "prettyName" : "Battery Voltage", "units" : "V" }}
   };
   var testProduct4 = {
      name : 'cattfish_v4',
      prettyName : 'CATTfish v4',
      vendor : 'CMU CREATE Lab',
      description : 'The CATTfish v4 water temperature and conductivity sensor.',
      isPublic : true,
      defaultChannelSpec : { "temperature" : { "prettyName" : "Temperature", "units" : "C" }, "conductivity" : { "prettyName" : "Conductivity", "units" : "uS/cm" }, "error_codes" : { "prettyName" : "Error Codes", "units" : null }, "battery_voltage" : { "prettyName" : "Battery Voltage", "units" : "V" }, "humidity" : { "prettyName" : "Humidity", "units" : "%" }}
   };
   var testDevice1 = {
      serialNumber : '03e7322a7d3630530218ff6b0dcc2e28',
      isPublic : true
   };
   var testDevice2 = {
      serialNumber : 'b5129637a32268fcf72b78f63a0b42db',
      isPublic : false
   };
   var testDevice3 = {
      serialNumber : 'fbf11c1a9befe54852ab453bcaae6fda',
      isPublic : true
   };
   var testDevice4 = {
      serialNumber : '0e66d7a06c77a561ebc23646a57fc76e',
      isPublic : false
   };

   var testFeed3 = {
      name : "Upstairs Bathroom",
      exposure : "indoor",
      isPublic : false,
      isMobile : false,
      latitude : 40.443679814953626,
      longitude : -79.94643892510089
   };

   var shallowClone = function(obj) {
      if (obj) {
         var clone = {};
         Object.keys(obj).forEach(function(key) {
            clone[key] = obj[key];
         });
         return clone;
      }
      return obj;
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
                              connection.query("DELETE FROM Feeds", function(err) {
                                 if (err) {
                                    throw err;
                                 }

                                 done();
                              });
                           },
                           function(done) {
                              connection.query("DELETE FROM Devices", function(err) {
                                 if (err) {
                                    throw err;
                                 }

                                 done();
                              });
                           },
                           function(done) {
                              connection.query("DELETE FROM Products", function(err) {
                                 if (err) {
                                    throw err;
                                 }

                                 done();
                              });
                           },
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

                          res.should.have.property('status', httpStatus.CREATED);
                          res.body.should.have.property('code', httpStatus.CREATED);
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

                          res.should.have.property('status', httpStatus.CREATED);
                          res.body.should.have.property('code', httpStatus.CREATED);
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

                          res.should.have.property('status', httpStatus.CONFLICT);
                          res.body.should.have.property('code', httpStatus.CONFLICT);
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

                          res.should.have.property('status', httpStatus.UNPROCESSABLE_ENTITY);
                          res.body.should.have.property('code', httpStatus.UNPROCESSABLE_ENTITY);
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
                           clientSecret : testClient.clientSecret,
                           resetPasswordUrl : testClient.resetPasswordUrl,
                           verificationUrl : testClient.verificationUrl
                        })
                  .end(function(err, res) {
                          if (err) {
                             return done(err);
                          }

                          res.should.have.property('status', httpStatus.UNPROCESSABLE_ENTITY);
                          res.body.should.have.property('code', httpStatus.UNPROCESSABLE_ENTITY);
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
                           clientSecret : testClient.clientSecret,
                           resetPasswordUrl : testClient.resetPasswordUrl,
                           verificationUrl : testClient.verificationUrl
                        })
                  .end(function(err, res) {
                          if (err) {
                             return done(err);
                          }

                          res.should.have.property('status', httpStatus.UNPROCESSABLE_ENTITY);
                          res.body.should.have.property('code', httpStatus.UNPROCESSABLE_ENTITY);
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
                           clientSecret : testClient.clientSecret,
                           resetPasswordUrl : testClient.resetPasswordUrl,
                           verificationUrl : testClient.verificationUrl
                        })
                  .end(function(err, res) {
                          if (err) {
                             return done(err);
                          }

                          res.should.have.property('status', httpStatus.UNPROCESSABLE_ENTITY);
                          res.body.should.have.property('code', httpStatus.UNPROCESSABLE_ENTITY);
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
                           clientSecret : testClient.clientSecret,
                           resetPasswordUrl : testClient.resetPasswordUrl,
                           verificationUrl : testClient.verificationUrl
                        })
                  .end(function(err, res) {
                          if (err) {
                             return done(err);
                          }

                          res.should.have.property('status', httpStatus.UNPROCESSABLE_ENTITY);
                          res.body.should.have.property('code', httpStatus.UNPROCESSABLE_ENTITY);
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
                           clientSecret : "I",
                           resetPasswordUrl : testClient.resetPasswordUrl,
                           verificationUrl : testClient.verificationUrl
                        })
                  .end(function(err, res) {
                          if (err) {
                             return done(err);
                          }

                          res.should.have.property('status', httpStatus.UNPROCESSABLE_ENTITY);
                          res.body.should.have.property('code', httpStatus.UNPROCESSABLE_ENTITY);
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
                           clientSecret : "thisisareallylongstringthisisareallylongstringthisisareallylongstringthisisareallylongstringthisisareallylongstringthisisareallylongstringthisisareallylongstringthisisareallylongstringthisisareallylongstringthisisareallylongstringthisisareallylongstringthisisareallylongstring",
                           resetPasswordUrl : testClient.resetPasswordUrl,
                           verificationUrl : testClient.verificationUrl
                        })
                  .end(function(err, res) {
                          if (err) {
                             return done(err);
                          }

                          res.should.have.property('status', httpStatus.UNPROCESSABLE_ENTITY);
                          res.body.should.have.property('code', httpStatus.UNPROCESSABLE_ENTITY);
                          res.body.should.have.property('status', 'error');
                          res.body.should.have.property('data');
                          res.body.data.should.have.length(1);
                          res.body.data[0].should.have.property('instanceContext', '#/clientSecret');
                          res.body.data[0].should.have.property('constraintName', 'maxLength');
                          res.body.data[0].should.have.property('constraintValue', db.clients.jsonSchema.properties.clientSecret.maxLength);
                          done();
                       });
         });

         it("Should fail to create a new client with a reset password URL that's too short", function(done) {
            agent(url)
                  .post("/api/v1/clients")
                  .send({
                           displayName : testClient.displayName,
                           clientName : testClient.clientName,
                           clientSecret : testClient.clientSecret,
                           resetPasswordUrl : "foo",
                           verificationUrl : testClient.verificationUrl
                        })
                  .end(function(err, res) {
                          if (err) {
                             return done(err);
                          }

                          res.should.have.property('status', httpStatus.UNPROCESSABLE_ENTITY);
                          res.body.should.have.property('code', httpStatus.UNPROCESSABLE_ENTITY);
                          res.body.should.have.property('status', 'error');
                          res.body.should.have.property('data');
                          res.body.data.should.have.length(1);
                          res.body.data[0].should.have.property('instanceContext', '#/resetPasswordUrl');
                          res.body.data[0].should.have.property('constraintName', 'minLength');
                          res.body.data[0].should.have.property('constraintValue', db.clients.jsonSchema.properties.resetPasswordUrl.minLength);
                          done();
                       });
         });

         it("Should fail to create a new client with a verification URL that's too short", function(done) {
            agent(url)
                  .post("/api/v1/clients")
                  .send({
                           displayName : testClient.displayName,
                           clientName : testClient.clientName,
                           clientSecret : testClient.clientSecret,
                           resetPasswordUrl : testClient.resetPasswordUrl,
                           verificationUrl : "foo"
                        })
                  .end(function(err, res) {
                          if (err) {
                             return done(err);
                          }

                          res.should.have.property('status', httpStatus.UNPROCESSABLE_ENTITY);
                          res.body.should.have.property('code', httpStatus.UNPROCESSABLE_ENTITY);
                          res.body.should.have.property('status', 'error');
                          res.body.should.have.property('data');
                          res.body.data.should.have.length(1);
                          res.body.data[0].should.have.property('instanceContext', '#/verificationUrl');
                          res.body.data[0].should.have.property('constraintName', 'minLength');
                          res.body.data[0].should.have.property('constraintValue', db.clients.jsonSchema.properties.verificationUrl.minLength);
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

                          res.should.have.property('status', httpStatus.CONFLICT);
                          res.body.should.have.property('code', httpStatus.CONFLICT);
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

                          res.should.have.property('status', httpStatus.CREATED);
                          res.body.should.have.property('code', httpStatus.CREATED);
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

                          res.should.have.property('status', httpStatus.CREATED);
                          res.body.should.have.property('code', httpStatus.CREATED);
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

                          res.should.have.property('status', httpStatus.CONFLICT);
                          res.body.should.have.property('code', httpStatus.CONFLICT);
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

                          res.should.have.property('status', httpStatus.CREATED);
                          res.body.should.have.property('code', httpStatus.CREATED);
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

                          res.should.have.property('status', httpStatus.CREATED);
                          res.body.should.have.property('code', httpStatus.CREATED);
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

         it("Should fail to create a new user with missing user and client", function(done) {
            agent(url)
                  .post("/api/v1/users")
                  .send({})
                  .end(function(err, res) {
                          if (err) {
                             return done(err);
                          }

                          res.should.have.property('status', httpStatus.UNPROCESSABLE_ENTITY);
                          res.body.should.have.property('code', httpStatus.UNPROCESSABLE_ENTITY);
                          res.body.should.have.property('status', 'error');
                          res.body.should.have.property('data', null);
                          done();
                       });
         });

         it("Should fail to create a new user with no client specified", function(done) {
            agent(url)
                  .post("/api/v1/users")
                  .send({user : testUser4})
                  .end(function(err, res) {
                          if (err) {
                             return done(err);
                          }

                          res.should.have.property('status', httpStatus.UNPROCESSABLE_ENTITY);
                          res.body.should.have.property('code', httpStatus.UNPROCESSABLE_ENTITY);
                          res.body.should.have.property('status', 'error');
                          res.body.should.have.property('data', null);

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

                          res.should.have.property('status', httpStatus.UNPROCESSABLE_ENTITY);
                          res.body.should.have.property('code', httpStatus.UNPROCESSABLE_ENTITY);
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

                          res.should.have.property('status', httpStatus.UNPROCESSABLE_ENTITY);
                          res.body.should.have.property('code', httpStatus.UNPROCESSABLE_ENTITY);
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

                          res.should.have.property('status', httpStatus.UNPROCESSABLE_ENTITY);
                          res.body.should.have.property('code', httpStatus.UNPROCESSABLE_ENTITY);
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

                          res.should.have.property('status', httpStatus.UNPROCESSABLE_ENTITY);
                          res.body.should.have.property('code', httpStatus.UNPROCESSABLE_ENTITY);
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

                          res.should.have.property('status', httpStatus.UNPROCESSABLE_ENTITY);
                          res.body.should.have.property('code', httpStatus.UNPROCESSABLE_ENTITY);
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

                          res.should.have.property('status', httpStatus.UNPROCESSABLE_ENTITY);
                          res.body.should.have.property('code', httpStatus.UNPROCESSABLE_ENTITY);
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

                          res.should.have.property('status', httpStatus.UNPROCESSABLE_ENTITY);
                          res.body.should.have.property('code', httpStatus.UNPROCESSABLE_ENTITY);
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
                  .send({user : testUser1, client : testClient})
                  .end(function(err, res) {
                          if (err) {
                             return done(err);
                          }

                          res.should.have.property('status', httpStatus.CONFLICT);
                          res.body.should.have.property('code', httpStatus.CONFLICT);
                          res.body.should.have.property('status', 'error');
                          done();
                       });
         });

         describe("Account Verification", function() {
            it("Should be able to request that the verification token be sent again (after creation, before verification)", function(done) {
               agent(url)
                     .post("/api/v1/user-verification")
                     .send({user : {email : testUser1.email}, client : testClient})
                     .end(function(err, res) {
                             if (err) {
                                return done(err);
                             }

                             res.should.have.property('status', httpStatus.CREATED);
                             res.body.should.have.property('code', httpStatus.CREATED);
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
                     .put("/api/v1/user-verification")
                     .send({token : verificationTokens.testUser1})
                     .end(function(err, res) {
                             if (err) {
                                return done(err);
                             }

                             res.should.have.property('status', httpStatus.OK);
                             res.body.should.have.property('code', httpStatus.OK);
                             res.body.should.have.property('status', 'success');
                             res.body.should.have.property('data');
                             res.body.data.should.have.property('isVerified', true);

                             done();
                          });
            });

            it("Should be able to verify another user", function(done) {

               agent(url)
                     .put("/api/v1/user-verification")
                     .send({token : verificationTokens.testUser2})
                     .end(function(err, res) {
                             if (err) {
                                return done(err);
                             }

                             res.should.have.property('status', httpStatus.OK);
                             res.body.should.have.property('code', httpStatus.OK);
                             res.body.should.have.property('status', 'success');
                             res.body.should.have.property('data');
                             res.body.data.should.have.property('isVerified', true);

                             done();
                          });
            });

            it("Should be able to request that the verification token be sent again (after creation, after verification)", function(done) {
               agent(url)
                     .post("/api/v1/user-verification")
                     .send({user : {email : testUser1.email}, client : testClient})
                     .end(function(err, res) {
                             if (err) {
                                return done(err);
                             }

                             res.should.have.property('status', httpStatus.OK);
                             res.body.should.have.property('code', httpStatus.OK);
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
                     .post("/api/v1/user-verification")
                     .send({user : {email : testUser1.email}, client : testClient})
                     .end(function(err, res) {
                             if (err) {
                                return done(err);
                             }

                             res.should.have.property('status', httpStatus.OK);
                             res.body.should.have.property('code', httpStatus.OK);
                             res.body.should.have.property('status', 'success');
                             res.body.should.have.property('data');
                             res.body.data.should.have.property('isVerified', true);

                             done();
                          });

            });

            it("Verification should fail for a missing verification token", function(done) {

               agent(url)
                     .put("/api/v1/user-verification")
                     .end(function(err, res) {
                             if (err) {
                                return done(err);
                             }

                             res.should.have.property('status', httpStatus.UNPROCESSABLE_ENTITY);
                             res.body.should.have.property('code', httpStatus.UNPROCESSABLE_ENTITY);
                             res.body.should.have.property('status', 'error');
                             res.body.should.have.property('data', null);

                             done();
                          });
            });

            it("Verification should fail for a bogus verification token", function(done) {

               agent(url)
                     .put("/api/v1/user-verification")
                     .send({token : "bogus_token"})
                     .end(function(err, res) {
                             if (err) {
                                return done(err);
                             }

                             res.should.have.property('status', httpStatus.BAD_REQUEST);
                             res.body.should.have.property('code', httpStatus.BAD_REQUEST);
                             res.body.should.have.property('status', 'error');
                             res.body.should.have.property('data');
                             res.body.data.should.have.property('isVerified', false);

                             done();
                          });
            });

            it("Should fail when requesting that the verification token be sent again for an unknown user", function(done) {
               var unknownUser = {email : 'unknown@unknown.com'};
               agent(url)
                     .post("/api/v1/user-verification")
                     .send({user : {email : unknownUser.email}, client : testClient})
                     .end(function(err, res) {
                             if (err) {
                                return done(err);
                             }

                             res.should.have.property('status', httpStatus.BAD_REQUEST);
                             res.body.should.have.property('code', httpStatus.BAD_REQUEST);
                             res.body.should.have.property('status', 'error');
                             res.body.should.have.property('data');
                             res.body.should.have.property('data');
                             should(res.body.data).eql({email : unknownUser.email});

                             done();
                          });
            });

            it("Should fail when requesting that the verification token be sent again but the email address is not given", function(done) {
               agent(url)
                     .post("/api/v1/user-verification")
                     .send({user : {}, client : testClient})
                     .end(function(err, res) {
                             if (err) {
                                return done(err);
                             }

                             res.should.have.property('status', httpStatus.UNPROCESSABLE_ENTITY);
                             res.body.should.have.property('code', httpStatus.UNPROCESSABLE_ENTITY);
                             res.body.should.have.property('status', 'error');
                             res.body.should.have.property('data', null);

                             done();
                          });
            });

            it("Should fail when requesting that the verification token be sent again but the client is not given", function(done) {
               agent(url)
                     .post("/api/v1/user-verification")
                     .send({user : {email : testUser1.email} })
                     .end(function(err, res) {
                             if (err) {
                                return done(err);
                             }

                             res.should.have.property('status', httpStatus.UNPROCESSABLE_ENTITY);
                             res.body.should.have.property('code', httpStatus.UNPROCESSABLE_ENTITY);
                             res.body.should.have.property('status', 'error');
                             res.body.should.have.property('data', null);

                             done();
                          });
            });

         });

      });

      describe("Reset Password Request", function() {
         var resetPasswordToken = null;
         var oldPassword = testUser1.password;
         var newPassword = "this is the new password";

         it("Should be able to request a password reset token", function(done) {
            agent(url)
                  .post("/api/v1/password-reset")
                  .send({user : {email : testUser1.email}, client : testClient})
                  .end(function(err, res) {
                          if (err) {
                             return done(err);
                          }

                          res.should.have.property('status', httpStatus.CREATED);
                          res.body.should.have.property('code', httpStatus.CREATED);
                          res.body.should.have.property('status', 'success');
                          res.body.should.have.property('data');
                          res.body.data.should.have.property('email', testUser1.email);
                          res.body.data.should.have.property('resetPasswordToken');

                          // remember the reset password token
                          resetPasswordToken = res.body.data.resetPasswordToken;
                          done();
                       });
         });

         it("Should be able to request a password reset token again, and get a different token", function(done) {
            agent(url)
                  .post("/api/v1/password-reset")
                  .send({user : {email : testUser1.email}, client : testClient})
                  .end(function(err, res) {
                          if (err) {
                             return done(err);
                          }

                          res.should.have.property('status', httpStatus.CREATED);
                          res.body.should.have.property('code', httpStatus.CREATED);
                          res.body.should.have.property('status', 'success');
                          res.body.should.have.property('data');
                          res.body.data.should.have.property('email', testUser1.email);
                          res.body.data.should.have.property('resetPasswordToken');
                          (resetPasswordToken != res.body.data.resetPasswordToken).should.be.true;

                          // remember the reset password token
                          resetPasswordToken = res.body.data.resetPasswordToken;
                          done();
                       });
         });

         it("Should fail to set the password if the reset password token is missing", function(done) {
            agent(url)
                  .put("/api/v1/password-reset")
                  .send({password : newPassword})
                  .end(function(err, res) {
                          if (err) {
                             return done(err);
                          }

                          res.should.have.property('status', httpStatus.UNPROCESSABLE_ENTITY);
                          res.body.should.have.property('code', httpStatus.UNPROCESSABLE_ENTITY);
                          res.body.should.have.property('status', 'error');
                          res.body.should.have.property('data', null);

                          done();
                       });
         });

         it("Should fail to set the password using an invalid reset password token", function(done) {
            agent(url)
                  .put("/api/v1/password-reset")
                  .send({password : newPassword, token : "bogus"})
                  .end(function(err, res) {
                          if (err) {
                             return done(err);
                          }

                          res.should.have.property('status', httpStatus.BAD_REQUEST);
                          res.body.should.have.property('code', httpStatus.BAD_REQUEST);
                          res.body.should.have.property('status', 'error');
                          res.body.should.have.property('data', null);

                          done();
                       });
         });

         it("Should fail to set the password using an invalid password", function(done) {
            var invalidPassword = "a";
            agent(url)
                  .put("/api/v1/password-reset")
                  .send({password : invalidPassword, token : resetPasswordToken})
                  .end(function(err, res) {
                          if (err) {
                             return done(err);
                          }

                          res.should.have.property('status', httpStatus.UNPROCESSABLE_ENTITY);
                          res.body.should.have.property('code', httpStatus.UNPROCESSABLE_ENTITY);
                          res.body.should.have.property('status', 'error');
                          res.body.should.have.property('data');
                          res.body.data.should.have.length(1);
                          res.body.data[0].should.have.property('instanceContext', '#/password');
                          res.body.data[0].should.have.property('constraintName', 'minLength');
                          res.body.data[0].should.have.property('constraintValue', '5');
                          res.body.data[0].should.have.property('testedValue', invalidPassword.length);
                          res.body.data[0].should.have.property('kind', 'StringValidationError');

                          done();
                       });
         });

         it("Should be able to set the password using the reset password token", function(done) {
            agent(url)
                  .put("/api/v1/password-reset")
                  .send({password : newPassword, token : resetPasswordToken})
                  .end(function(err, res) {
                          if (err) {
                             return done(err);
                          }

                          res.should.have.property('status', httpStatus.OK);
                          res.body.should.have.property('code', httpStatus.OK);
                          res.body.should.have.property('status', 'success');
                          res.body.should.have.property('data', null);

                          testUser1.password = newPassword;
                          done();
                       });
         });

         it("Should fail to find the user by email and the old password", function(done) {
            db.users.findByEmailAndPassword(testUser1.email, oldPassword, function(err, user) {
               if (err) {
                  return done(err);
               }
               (user == null).should.be.true;

               done();
            });
         });

         it("Should be able to find the user by email and the new password", function(done) {
            db.users.findByEmailAndPassword(testUser1.email, newPassword, function(err, user) {
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

         it("Should fail to request a password reset token if user is not specified", function(done) {
            agent(url)
                  .post("/api/v1/password-reset")
                  .send({client : testClient})
                  .end(function(err, res) {
                          if (err) {
                             return done(err);
                          }

                          res.should.have.property('status', httpStatus.UNPROCESSABLE_ENTITY);
                          res.body.should.have.property('code', httpStatus.UNPROCESSABLE_ENTITY);
                          res.body.should.have.property('status', 'error');
                          res.body.should.have.property('data', null);
                          done();
                       });
         });

         it("Should fail to request a password reset token if email is not specified", function(done) {
            agent(url)
                  .post("/api/v1/password-reset")
                  .send({user : {foo : "bar"}, client : testClient})
                  .end(function(err, res) {
                          if (err) {
                             return done(err);
                          }

                          res.should.have.property('status', httpStatus.UNPROCESSABLE_ENTITY);
                          res.body.should.have.property('code', httpStatus.UNPROCESSABLE_ENTITY);
                          res.body.should.have.property('status', 'error');
                          res.body.should.have.property('data', null);
                          done();
                       });
         });

         it("Should fail to request a password reset token for an invalid email", function(done) {
            var invalidEmail = {email : 'invalid'};
            agent(url)
                  .post("/api/v1/password-reset")
                  .send({user : {email : invalidEmail.email}, client : testClient})
                  .end(function(err, res) {
                          if (err) {
                             return done(err);
                          }

                          res.should.have.property('status', httpStatus.UNPROCESSABLE_ENTITY);
                          res.body.should.have.property('code', httpStatus.UNPROCESSABLE_ENTITY);
                          res.body.should.have.property('status', 'error');
                          res.body.should.have.property('data');
                          res.body.data.should.have.property('email', invalidEmail.email);

                          done();
                       });
         });

         it("Should fail to request a password reset token for an unknown email", function(done) {
            var unknownUser = {email : 'unknown@unknown.com'};
            agent(url)
                  .post("/api/v1/password-reset")
                  .send({user : {email : unknownUser.email}, client : testClient})
                  .end(function(err, res) {
                          if (err) {
                             return done(err);
                          }

                          res.should.have.property('status', httpStatus.BAD_REQUEST);
                          res.body.should.have.property('code', httpStatus.BAD_REQUEST);
                          res.body.should.have.property('status', 'error');
                          res.body.should.have.property('data');
                          res.body.data.should.have.property('email', unknownUser.email);

                          done();
                       });
         });

         it("Should fail to request a password reset token for an invalid client", function(done) {
            var bogusClient = {
               displayName : "Bogus Client",
               clientName : "bogus_client",
               clientSecret : "I am bogus"
            };
            agent(url)
                  .post("/api/v1/password-reset")
                  .send({user : {email : testUser1.email}, client : bogusClient})
                  .end(function(err, res) {
                          if (err) {
                             return done(err);
                          }

                          res.should.have.property('status', httpStatus.UNAUTHORIZED);
                          res.body.should.have.property('code', httpStatus.UNAUTHORIZED);
                          res.body.should.have.property('status', 'error');
                          res.body.should.have.property('data');
                          res.body.data.should.have.property('clientName', bogusClient.clientName);
                          done();
                       });
         });

         it("Should fail to request a password reset token if not client is specified", function(done) {

            agent(url)
                  .post("/api/v1/password-reset")
                  .send({user : {email : testUser1.email}})
                  .end(function(err, res) {
                          if (err) {
                             return done(err);
                          }

                          res.should.have.property('status', httpStatus.UNPROCESSABLE_ENTITY);
                          res.body.should.have.property('code', httpStatus.UNPROCESSABLE_ENTITY);
                          res.body.should.have.property('status', 'error');
                          res.body.should.have.property('data', null);
                          done();
                       });
         });

      });   // end Reset Password Request

      describe("Products, Devices, and Feeds", function() {

         var accessTokens = {};

         before(function(initDone) {
            // request access and refresh tokens
            var requestTokens = function(user, callback) {
               agent(url)
                     .post("/oauth/token")
                     .send({
                              grant_type : "password",
                              client_id : testClient.clientName,
                              client_secret : testClient.clientSecret,
                              username : user.email,
                              password : user.password
                           })
                     .end(function(err, res) {
                             if (err) {
                                return initDone(err);
                             }

                             res.should.have.property('status', httpStatus.OK);
                             res.body.should.have.property('access_token');
                             res.body.should.have.property('refresh_token');
                             res.body.should.have.property('token_type', "Bearer");

                             // return the tokens
                             callback(res.body);
                          });
            };

            flow.series([
                           function(done) {
                              requestTokens(testUser1, function(theTokens) {
                                 accessTokens.testUser1 = theTokens;
                                 done();
                              });
                           },
                           function(done) {
                              requestTokens(testUser2, function(theTokens) {
                                 accessTokens.testUser2 = theTokens;
                                 done();
                              });
                           }
                        ],
                        function() {
                           initDone();
                        });
         });

         describe("Products", function() {

            it("Should be able to create a new public product", function(done) {
               agent(url)
                     .post("/api/v1/products")
                     .set({
                             Authorization : "Bearer " + accessTokens.testUser1.access_token
                          })
                     .send(testProduct1)
                     .end(function(err, res) {
                             if (err) {
                                return done(err);
                             }

                             res.should.have.property('status', httpStatus.CREATED);
                             res.body.should.have.property('code', httpStatus.CREATED);
                             res.body.should.have.property('status', 'success');
                             res.body.should.have.property('data');
                             res.body.data.should.have.property('name', testProduct1.name);

                             done();
                          });
            });

            it("Should be able to create a new private product", function(done) {
               agent(url)
                     .post("/api/v1/products")
                     .set({
                             Authorization : "Bearer " + accessTokens.testUser2.access_token
                          })
                     .send(testProduct2)
                     .end(function(err, res) {
                             if (err) {
                                return done(err);
                             }

                             res.should.have.property('status', httpStatus.CREATED);
                             res.body.should.have.property('code', httpStatus.CREATED);
                             res.body.should.have.property('status', 'success');
                             res.body.should.have.property('data');
                             res.body.data.should.have.property('name', testProduct2.name);

                             done();
                          });
            });

            it("Should fail to create a new product if the name is already in use", function(done) {
               agent(url)
                     .post("/api/v1/products")
                     .set({
                             Authorization : "Bearer " + accessTokens.testUser1.access_token
                          })
                     .send(testProduct1)
                     .end(function(err, res) {
                             if (err) {
                                return done(err);
                             }

                             res.should.have.property('status', httpStatus.CONFLICT);
                             res.body.should.have.property('code', httpStatus.CONFLICT);
                             res.body.should.have.property('status', 'error');
                             res.body.should.have.property('data');
                             res.body.data.should.have.property('name', testProduct1.name);

                             done();
                          });
            });

            it("Should fail to create a new product if the required fields are missing", function(done) {
               var product = shallowClone(testProduct1);
               delete product.name;
               delete product.prettyName;
               delete product.defaultChannelSpec;

               agent(url)
                     .post("/api/v1/products")
                     .set({
                             Authorization : "Bearer " + accessTokens.testUser1.access_token
                          })
                     .send(product)
                     .end(function(err, res) {
                             if (err) {
                                return done(err);
                             }

                             res.should.have.property('status', httpStatus.UNPROCESSABLE_ENTITY);
                             res.body.should.have.property('code', httpStatus.UNPROCESSABLE_ENTITY);
                             res.body.should.have.property('status', 'error');
                             res.body.should.have.property('data');
                             res.body.data.should.have.length(1);
                             res.body.data[0].should.have.property('instanceContext', '#');
                             res.body.data[0].should.have.property('constraintName', 'required');
                             res.body.data[0].should.have.property('desc', 'missing: name,prettyName,defaultChannelSpec');
                             res.body.data[0].should.have.property('kind', 'ObjectValidationError');

                             done();
                          });
            });

            it("Should fail to create a new product if the fields with minLength are too short", function(done) {
               var product = shallowClone(testProduct1);
               product.name = "Yo";
               product.prettyName = "Ya";
               product.defaultChannelSpec = 1;

               agent(url)
                     .post("/api/v1/products")
                     .set({
                             Authorization : "Bearer " + accessTokens.testUser1.access_token
                          })
                     .send(product)
                     .end(function(err, res) {
                             if (err) {
                                return done(err);
                             }

                             res.should.have.property('status', httpStatus.UNPROCESSABLE_ENTITY);
                             res.body.should.have.property('code', httpStatus.UNPROCESSABLE_ENTITY);
                             res.body.should.have.property('status', 'error');
                             res.body.should.have.property('data');
                             res.body.data.should.have.length(3);
                             res.body.data[0].should.have.property('instanceContext', '#/name');
                             res.body.data[0].should.have.property('constraintName', 'minLength');
                             res.body.data[0].should.have.property('constraintValue', db.products.jsonSchema.properties.name.minLength);
                             res.body.data[0].should.have.property('testedValue', product.name.length);
                             res.body.data[1].should.have.property('instanceContext', '#/prettyName');
                             res.body.data[1].should.have.property('constraintName', 'minLength');
                             res.body.data[1].should.have.property('constraintValue', db.products.jsonSchema.properties.prettyName.minLength);
                             res.body.data[1].should.have.property('testedValue', product.prettyName.length);
                             res.body.data[2].should.have.property('instanceContext', '#/defaultChannelSpec');
                             res.body.data[2].should.have.property('constraintName', 'minLength');
                             res.body.data[2].should.have.property('constraintValue', db.products.jsonSchema.properties.defaultChannelSpec.minLength);
                             res.body.data[2].should.have.property('testedValue', 1);

                             done();
                          });
            });

            it("Should be able to get a public product by name, with no access token provided", function(done) {
               agent(url)
                     .get("/api/v1/products/" + testProduct1.name)
                     .end(function(err, res) {
                             if (err) {
                                return done(err);
                             }

                             res.should.have.property('status', httpStatus.OK);
                             res.body.should.have.property('code', httpStatus.OK);
                             res.body.should.have.property('status', 'success');
                             res.body.should.have.property('data');
                             res.body.data.should.have.property('id');
                             res.body.data.should.have.property('name', testProduct1.name);
                             res.body.data.should.have.property('prettyName', testProduct1.prettyName);
                             res.body.data.should.have.property('vendor', testProduct1.vendor);
                             res.body.data.should.have.property('description', testProduct1.description);
                             res.body.data.should.have.property('creatorUserId', accessTokens.testUser1.userId);
                             res.body.data.should.have.property('isPublic', testProduct1.isPublic);
                             should(res.body.data.defaultChannelSpec).eql(testProduct1.defaultChannelSpec); // deep equal
                             res.body.data.should.have.property('created');
                             res.body.data.should.have.property('modified');

                             done();
                          });
            });

            it("Should be able to get a public product by name, with an access token provided", function(done) {
               agent(url)
                     .get("/api/v1/products/" + testProduct1.name)
                     .set({
                             Authorization : "Bearer " + accessTokens.testUser2.access_token
                          })
                     .end(function(err, res) {
                             if (err) {
                                return done(err);
                             }

                             res.should.have.property('status', httpStatus.OK);
                             res.body.should.have.property('code', httpStatus.OK);
                             res.body.should.have.property('status', 'success');
                             res.body.should.have.property('data');
                             res.body.data.should.have.property('id');
                             res.body.data.should.have.property('name', testProduct1.name);
                             res.body.data.should.have.property('prettyName', testProduct1.prettyName);
                             res.body.data.should.have.property('vendor', testProduct1.vendor);
                             res.body.data.should.have.property('description', testProduct1.description);
                             res.body.data.should.have.property('creatorUserId', accessTokens.testUser1.userId);
                             res.body.data.should.have.property('isPublic', testProduct1.isPublic);
                             should(res.body.data.defaultChannelSpec).eql(testProduct1.defaultChannelSpec); // deep equal
                             res.body.data.should.have.property('created');
                             res.body.data.should.have.property('modified');

                             done();
                          });
            });

            it("Should be able to get a private product by name, with an access token for the product creator provided", function(done) {
               agent(url)
                     .get("/api/v1/products/" + testProduct2.name)
                     .set({
                             Authorization : "Bearer " + accessTokens.testUser2.access_token
                          })
                     .end(function(err, res) {
                             if (err) {
                                return done(err);
                             }

                             res.should.have.property('status', httpStatus.OK);
                             res.body.should.have.property('code', httpStatus.OK);
                             res.body.should.have.property('status', 'success');
                             res.body.should.have.property('data');
                             res.body.data.should.have.property('id');
                             res.body.data.should.have.property('name', testProduct2.name);
                             res.body.data.should.have.property('prettyName', testProduct2.prettyName);
                             res.body.data.should.have.property('vendor', testProduct2.vendor);
                             res.body.data.should.have.property('description', testProduct2.description);
                             res.body.data.should.have.property('creatorUserId', accessTokens.testUser2.userId);
                             res.body.data.should.have.property('isPublic', testProduct2.isPublic);
                             should(res.body.data.defaultChannelSpec).eql(testProduct2.defaultChannelSpec); // deep equal
                             res.body.data.should.have.property('created');
                             res.body.data.should.have.property('modified');

                             done();
                          });
            });

            it("Should fail to get a private product by name, with no access token provided", function(done) {
               agent(url)
                     .get("/api/v1/products/" + testProduct2.name)
                     .end(function(err, res) {
                             if (err) {
                                return done(err);
                             }

                             res.should.have.property('status', httpStatus.UNAUTHORIZED);
                             res.body.should.have.property('code', httpStatus.UNAUTHORIZED);
                             res.body.should.have.property('status', 'error');
                             res.body.should.have.property('data', null);

                             done();
                          });
            });

            it("Should fail to get a private product by name, with an access token provided for a user other than the product creator", function(done) {
               agent(url)
                     .get("/api/v1/products/" + testProduct2.name)
                     .set({
                             Authorization : "Bearer " + accessTokens.testUser1.access_token
                          })
                     .end(function(err, res) {
                             if (err) {
                                return done(err);
                             }

                             res.should.have.property('status', httpStatus.FORBIDDEN);
                             res.body.should.have.property('code', httpStatus.FORBIDDEN);
                             res.body.should.have.property('status', 'error');
                             res.body.should.have.property('data', null);

                             done();
                          });
            });

            it("Should fail to get a product with a bogus name", function(done) {
               agent(url)
                     .get("/api/v1/products/" + "bogus")
                     .set({
                             Authorization : "Bearer " + accessTokens.testUser1.access_token
                          })
                     .end(function(err, res) {
                             if (err) {
                                return done(err);
                             }

                             res.should.have.property('status', httpStatus.BAD_REQUEST);
                             res.body.should.have.property('code', httpStatus.BAD_REQUEST);
                             res.body.should.have.property('status', 'error');
                             res.body.should.have.property('data', null);

                             done();
                          });
            });

            describe("Devices", function() {

               it("Should be able to create a new device", function(done) {
                  agent(url)
                        .post("/api/v1/products/" + testProduct1.name + "/devices")
                        .set({
                                Authorization : "Bearer " + accessTokens.testUser1.access_token
                             })
                        .send(testDevice1)
                        .end(function(err, res) {
                                if (err) {
                                   return done(err);
                                }

                                res.should.have.property('status', httpStatus.CREATED);
                                res.body.should.have.property('code', httpStatus.CREATED);
                                res.body.should.have.property('status', 'success');
                                res.body.should.have.property('data');
                                res.body.data.should.have.property('id');
                                res.body.data.should.have.property('serialNumber', testDevice1.serialNumber);

                                done();
                             });
               });

               it("Should fail to create the same device for the same product again", function(done) {
                  agent(url)
                        .post("/api/v1/products/" + testProduct1.name + "/devices")
                        .set({
                                Authorization : "Bearer " + accessTokens.testUser1.access_token
                             })
                        .send(testDevice1)
                        .end(function(err, res) {
                                if (err) {
                                   return done(err);
                                }

                                res.should.have.property('status', httpStatus.CONFLICT);
                                res.body.should.have.property('code', httpStatus.CONFLICT);
                                res.body.should.have.property('status', 'error');
                                res.body.should.have.property('data');
                                res.body.data.should.have.property('serialNumber', testDevice1.serialNumber);

                                done();
                             });
               });

               it("Should fail to create a new device for a bogus product", function(done) {
                  agent(url)
                        .post("/api/v1/products/bogus/devices")
                        .set({
                                Authorization : "Bearer " + accessTokens.testUser1.access_token
                             })
                        .send(testDevice1)
                        .end(function(err, res) {
                                if (err) {
                                   return done(err);
                                }

                                res.should.have.property('status', httpStatus.BAD_REQUEST);
                                res.body.should.have.property('code', httpStatus.BAD_REQUEST);
                                res.body.should.have.property('status', 'error');
                                res.body.should.have.property('data', null);

                                done();
                             });
               });

               it("Should fail to create a new device for a private product by the wrong user", function(done) {
                  agent(url)
                        .post("/api/v1/products/" + testProduct2.name + "/devices")
                        .set({
                                Authorization : "Bearer " + accessTokens.testUser1.access_token
                             })
                        .send(testDevice2)
                        .end(function(err, res) {
                                if (err) {
                                   return done(err);
                                }

                                res.should.have.property('status', httpStatus.FORBIDDEN);
                                res.body.should.have.property('code', httpStatus.FORBIDDEN);
                                res.body.should.have.property('status', 'error');
                                res.body.should.have.property('data', null);

                                done();
                             });
               });

               it("Should be able to create a new device for a private product by the correct user", function(done) {
                  agent(url)
                        .post("/api/v1/products/" + testProduct2.name + "/devices")
                        .set({
                                Authorization : "Bearer " + accessTokens.testUser2.access_token
                             })
                        .send(testDevice2)
                        .end(function(err, res) {
                                if (err) {
                                   return done(err);
                                }

                                res.should.have.property('status', httpStatus.CREATED);
                                res.body.should.have.property('code', httpStatus.CREATED);
                                res.body.should.have.property('status', 'success');
                                res.body.should.have.property('data');
                                res.body.data.should.have.property('id');
                                res.body.data.should.have.property('serialNumber', testDevice2.serialNumber);

                                done();
                             });
               });

               // TODO: add tests for validation

               describe("Feeds", function() {

               });      // end Feeds
            });      // end Devices
         });      // end Products
      });      // end Products, Devices, and Feeds
   });      // end REST API

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
                        username : testUser3.email,
                        password : testUser3.password
                     })
               .end(function(err, res) {
                       if (err) {
                          return done(err);
                       }

                       res.should.have.property('status', httpStatus.FORBIDDEN);
                       res.body.should.have.property('error', 'invalid_grant');

                       done();
                    });
      });

      it("Should be able to request access and refresh tokens after verifying the user", function(done) {
         agent(url)
               .put("/api/v1/user-verification")
               .send({token : verificationTokens.testUser3})
               .end(function(err, res) {
                       if (err) {
                          return done(err);
                       }

                       res.should.have.property('status', httpStatus.OK);
                       res.body.should.have.property('code', httpStatus.OK);
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

                                     res.should.have.property('status', httpStatus.OK);
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

                       res.should.have.property('status', httpStatus.UNAUTHORIZED);

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

                       res.should.have.property('status', httpStatus.UNAUTHORIZED);

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

                       res.should.have.property('status', httpStatus.FORBIDDEN);

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

                       res.should.have.property('status', httpStatus.FORBIDDEN);

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

                       res.should.have.property('status', httpStatus.OK);
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

                       res.should.have.property('status', httpStatus.UNAUTHORIZED);

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

                       res.should.have.property('status', httpStatus.UNAUTHORIZED);

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

                       res.should.have.property('status', httpStatus.OK);
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

                       res.should.have.property('status', httpStatus.OK);
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

                       res.should.have.property('status', httpStatus.UNAUTHORIZED);
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

                       res.should.have.property('status', httpStatus.FORBIDDEN);
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

                       res.should.have.property('status', httpStatus.UNAUTHORIZED);

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

                       res.should.have.property('status', httpStatus.UNAUTHORIZED);

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

         it("Should be able to find a client by name and secret", function(done) {
            db.clients.findByNameAndSecret(testClient.clientName, testClient.clientSecret, function(err, client) {
               if (err) {
                  return done(err);
               }
               client.should.have.property("id");
               client.should.have.property("displayName", testClient.displayName);
               client.should.have.property("clientName", testClient.clientName);
               client.should.have.property("clientSecret");
               client.should.have.property("created");
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

         describe("Reset Password", function() {

            var resetPasswordToken = null;
            var foundUser = null;
            var newPassword = 'this is my new password';

            it("Should be able to create a reset password token", function(done) {
               db.users.findByEmail(testUser1.email, function(err, user) {
                  if (err) {
                     return done(err);
                  }
                  foundUser = user;

                  db.users.createResetPasswordToken(user.email, function(err, token) {
                     if (err) {
                        return done(err);
                     }
                     (token != null).should.be.true;

                     // remember the token so we can use it to reset the user's password
                     resetPasswordToken = token;

                     done();
                  });
               });
            });

            it("Should be able to set the password using the reset password token", function(done) {
               db.users.setPassword(resetPasswordToken, newPassword, function(err, wasSuccessful) {
                  if (err) {
                     return done(err);
                  }
                  wasSuccessful.should.be.true;

                  // do a find on the user to verify that the password and modification timestamp changed
                  db.users.findByEmail(testUser1.email, function(err, user) {
                     if (err) {
                        return done(err);
                     }
                     (foundUser.password != user.password).should.be.true;
                     (foundUser.modified != user.modified).should.be.true;
                     user.should.have.property('resetPasswordToken', null);
                     user.should.have.property('resetPasswordExpiration', '0000-00-00 00:00:00');

                     done();
                  });
               });
            });

         });   // end Reset Password
      });      // end Users

      describe("Products, Devices, and Feeds", function() {
         var productInsertIds = {};
         var userIds = {};

         before(function(initDone) {
            // find the user database IDs
            var getUserId = function(userEmail, callback) {
               db.users.findByEmail(userEmail, function(err, user) {
                  if (err) {
                     return initDone(err);
                  }

                  callback(user.id);
               });
            };

            flow.series([
                           function(done) {
                              getUserId(testUser1.email, function(userId) {
                                 userIds.testUser1 = userId;
                                 done();
                              });
                           },
                           function(done) {
                              getUserId(testUser2.email, function(email) {
                                 userIds.testUser2 = email;
                                 done();
                              });
                           }
                        ],
                        function() {
                           initDone();
                        });
         });

         describe("Products", function() {

            it("Should be able to create a product with a null creator", function(done) {
               db.products.create(testProduct3, null, function(err, product) {
                  if (err) {
                     return done(err);
                  }

                  product.should.have.property('insertId');
                  product.should.have.property('name', testProduct3.name);

                  // remember the insert ID
                  productInsertIds.testProduct3 = product.insertId;

                  done();
               });
            });

            it("Should be able to create a product with a non-null creator", function(done) {
               db.products.create(testProduct4, userIds.testUser1, function(err, product) {
                  if (err) {
                     return done(err);
                  }

                  product.should.have.property('insertId');
                  product.should.have.property('name', testProduct4.name);

                  // remember the insert ID
                  productInsertIds.testProduct4 = product.insertId;

                  done();
               });
            });

            it("Should be able to find a product by name", function(done) {
               db.products.findByName(testProduct3.name, function(err, product) {
                  if (err) {
                     return done(err);
                  }

                  product.should.have.property('id', productInsertIds.testProduct3);
                  product.should.have.property('name', testProduct3.name);
                  product.should.have.property('prettyName', testProduct3.prettyName);
                  product.should.have.property('vendor', testProduct3.vendor);
                  product.should.have.property('description', testProduct3.description);
                  product.should.have.property('creatorUserId', null);
                  product.should.have.property('isPublic', testProduct3.isPublic);
                  product.should.have.property('created');
                  product.should.have.property('modified');

                  // do a deep equal
                  should(JSON.parse(product.defaultChannelSpec)).eql(testProduct3.defaultChannelSpec);

                  done();
               });
            });

            describe("Devices", function() {

               var deviceInsertIds = {};

               it("Should be able to create a device", function(done) {
                  db.devices.create(testDevice3, productInsertIds.testProduct3, userIds.testUser1, function(err, device) {
                     if (err) {
                        return done(err);
                     }

                     device.should.have.property('insertId');
                     device.should.have.property('serialNumber', testDevice3.serialNumber);

                     // remember the insert ID
                     deviceInsertIds.testDevice3 = device.insertId;

                     done();
                  });
               });

               describe("Feeds", function() {

                  var feedInsertIds = {};

                  it("Should be able to create a feed", function(done) {
                     db.feeds.create(testFeed3, deviceInsertIds.testDevice3, userIds.testUser1, function(err, feed) {
                        if (err) {
                           return done(err);
                        }

                        feed.should.have.property('insertId');
                        feed.should.have.property('datastoreId');
                        feed.should.have.property('apiToken');

                        // remember the insert ID
                        feedInsertIds.testFeed3 = feed.insertId;

                        done();
                     });
                  });
               });      // end Feeds

            });      // end Devices

         });      // end Products

      });         // end Products, Devices, and Feeds
   });            // end Database
});               // end ESDR
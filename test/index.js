var assert = require('assert');
var should = require('should');
var request = require('supertest');
var mysql = require('mysql');
var config = require('../config');
var flow = require('nimble');
var log = require('log4js').getLogger();
var Database = require("../models/Database");
var UserSchema = require('../models/json-schemas').UserSchema;
var ClientSchema = require('../models/json-schemas').ClientSchema;

describe("ESDR", function() {
   var url = "http://localhost:3001";
   var testUser = {
      username : "test",
      password : "password",
      email : "test@user.com"
   };
   var testClient = {
      prettyName : "Test Client",
      clientName : "test_client",
      clientSecret : "I've got a secret / I've been hiding / Under my skin"
   };
   var db = null;

   var pool = mysql.createPool({
                                  connectionLimit : config.get("database:pool:connectionLimit"),
                                  host : config.get("database:host"),
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
            request(url)
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
                          res.body.data.should.have.property('prettyName', testClient.prettyName);
                          res.body.data.should.have.property('clientName', testClient.clientName);
                          done();
                       });
         });

         it("Should fail to create a new client with missing required values", function(done) {
            request(url)
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
                          res.body.data.should.have.length(1);
                          res.body.data[0].should.have.property('instanceContext', '#');
                          res.body.data[0].should.have.property('constraintName', 'required');
                          res.body.data[0].should.have.property('constraintValue', ClientSchema.required);
                          res.body.data[0].should.have.property('constraintValue');
                          done();
                       });
         });

         it("Should fail to create a new client with a pretty name that's too short", function(done) {
            request(url)
                  .post("/api/v1/clients")
                  .send({
                           prettyName : "T",
                           clientName : "test_client",
                           clientSecret : "I've got a secret / I've been hiding / Under my skin"
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
                          res.body.data[0].should.have.property('instanceContext', '#/prettyName');
                          res.body.data[0].should.have.property('constraintName', 'minLength');
                          res.body.data[0].should.have.property('constraintValue', ClientSchema.properties.prettyName.minLength);
                          done();
                       });
         });

         it("Should fail to create a new client with a client name that's too short", function(done) {
            request(url)
                  .post("/api/v1/clients")
                  .send({
                           prettyName : "Test Client",
                           clientName : "t",
                           clientSecret : "I've got a secret / I've been hiding / Under my skin"
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
                          res.body.data[0].should.have.property('constraintValue', ClientSchema.properties.clientName.minLength);
                          done();
                       });
         });

         it("Should fail to create a new client with a client secret that's too short", function(done) {
            request(url)
                  .post("/api/v1/clients")
                  .send({
                           prettyName : "Test Client",
                           clientName : "test_client",
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
                          res.body.data[0].should.have.property('constraintValue', ClientSchema.properties.clientSecret.minLength);
                          done();
                       });
         });

         it("Should fail to create a new client with a client name that's already in use", function(done) {
            request(url)
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
            request(url)
                  .post("/api/v1/users")
                  .send(testUser)
                  .end(function(err, res) {
                          if (err) {
                             return done(err);
                          }

                          res.should.have.property('status', 201);
                          res.body.should.have.property('code', 201);
                          res.body.should.have.property('status', 'success');
                          res.body.should.have.property('data');
                          res.body.data.should.have.property('username', testUser.username);
                          res.body.data.should.have.property('email', testUser.email);
                          done();
                       });
         });

         it("Should fail to create a new user with missing required values", function(done) {
            request(url)
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
                          res.body.data.should.have.length(1);
                          res.body.data[0].should.have.property('instanceContext', '#');
                          res.body.data[0].should.have.property('constraintName', 'required');
                          res.body.data[0].should.have.property('constraintValue', UserSchema.required);
                          res.body.data[0].should.have.property('constraintValue');
                          done();
                       });
         });

         it("Should fail to create a new user with a username that's too short", function(done) {
            request(url)
                  .post("/api/v1/users")
                  .send({
                           username : "t",
                           password : "password",
                           email : "test@user.com"
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
                          res.body.data[0].should.have.property('instanceContext', '#/username');
                          res.body.data[0].should.have.property('constraintName', 'minLength');
                          res.body.data[0].should.have.property('constraintValue', UserSchema.properties.username.minLength);
                          done();
                       });
         });

         it("Should fail to create a new user with a password that's too short", function(done) {
            request(url)
                  .post("/api/v1/users")
                  .send({
                           username : "test",
                           password : "p",
                           email : "test@user.com"
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
                          res.body.data[0].should.have.property('constraintValue', UserSchema.properties.password.minLength);
                          done();
                       });
         });

         it("Should fail to create a new user with a email address that's too short", function(done) {
            request(url)
                  .post("/api/v1/users")
                  .send({
                           username : "test",
                           password : "password",
                           email : "t@t.c"
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
                          res.body.data[0].should.have.property('constraintValue', UserSchema.properties.email.minLength);
                          done();
                       });
         });

         it("Should fail to create a new user with a email address that's invalid", function(done) {
            request(url)
                  .post("/api/v1/users")
                  .send({
                           username : "test",
                           password : "password",
                           email : "not_a_real_email_address"
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

         it("Should fail to create a new user with a username that's already in use", function(done) {
            request(url)
                  .post("/api/v1/users")
                  .send(testUser)
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
   });

   describe("OAuth 2.0", function() {
      var tokens = null;
      var newTokens = null;

      it("Should be able to request access and refresh tokens", function(done) {
         request(url)
               .post("/oauth/token")
               .send({
                        grant_type : "password",
                        client_id : testClient.clientName,
                        client_secret : testClient.clientSecret,
                        username : testUser.username,
                        password : testUser.password
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

      it("Should not be able to request access and refresh tokens with an invalid client ID", function(done) {
         request(url)
               .post("/oauth/token")
               .send({
                        grant_type : "password",
                        client_id : "bogus",
                        client_secret : testClient.clientSecret,
                        username : testUser.username,
                        password : testUser.password
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
         request(url)
               .post("/oauth/token")
               .send({
                        grant_type : "password",
                        client_id : testClient.clientName,
                        client_secret : "bogus",
                        username : testUser.username,
                        password : testUser.password
                     })
               .end(function(err, res) {
                       if (err) {
                          return done(err);
                       }

                       res.should.have.property('status', 401);

                       done();
                    });
      });

      it("Should not be able to request access and refresh tokens with an invalid username", function(done) {
         request(url)
               .post("/oauth/token")
               .send({
                        grant_type : "password",
                        client_id : testClient.clientName,
                        client_secret : testClient.clientSecret,
                        username : "bogus",
                        password : testUser.password
                     })
               .end(function(err, res) {
                       if (err) {
                          return done(err);
                       }

                       res.should.have.property('status', 403);

                       done();
                    });
      });

      it("Should not be able to request access and refresh tokens with an invalid username", function(done) {
         request(url)
               .post("/oauth/token")
               .send({
                        grant_type : "password",
                        client_id : testClient.clientName,
                        client_secret : testClient.clientSecret,
                        username : testUser.username,
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
         request(url)
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
         request(url)
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
         request(url)
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
         request(url)
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
         request(url)
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
         request(url)
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
         request(url)
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
         request(url)
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
         request(url)
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
         it("Should be able to find a client by name", function(done) {
            db.clients.findByName(testClient.clientName, function(err, client) {
               if (err) {
                  return done(err);
               }
               client.should.have.property("id");
               client.should.have.property("prettyName", testClient.prettyName);
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
               client.should.have.property("prettyName", testClient.prettyName);
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

         it("Should be able to find a user by username", function(done) {
            db.users.findByUsername(testUser.username, function(err, user) {
               if (err) {
                  return done(err);
               }
               user.should.have.property("id");
               user.should.have.property("username", testUser.username);
               user.should.have.property("password");
               user.should.have.property("email", testUser.email);
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

         it("Should be able to find a user by username and password", function(done) {
            db.users.findByUsernameAndPassword(testUser.username, testUser.password, function(err, user) {
               if (err) {
                  return done(err);
               }
               user.should.have.property("id");
               user.should.have.property("username", testUser.username);
               user.should.have.property("password");
               user.should.have.property("email", testUser.email);
               user.should.have.property("created");
               user.should.have.property("modified");

               done();
            });
         });

         it("Should not be able to find a user by a non-existent username", function(done) {
            db.users.findByUsername("bogus", function(err, user) {
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

         it("Should not be able to find a user by username and password with a non-existent username", function(done) {
            db.users.findByUsernameAndPassword("bogus", testUser.password, function(err, user) {
               if (err) {
                  return done(err);
               }
               assert.equal(user, null);

               done();
            });
         });

         it("Should not be able to find a user by username and password with an incorrect password", function(done) {
            db.users.findByUsernameAndPassword(testUser.username, "bogus", function(err, user) {
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
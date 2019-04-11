const should = require('should');
const flow = require('nimble');
const requireNew = require('require-new');
const wipe = require('./fixture-helpers/wipe');
const setup = require('./fixture-helpers/setup');
const DuplicateRecordError = require('../lib/errors').DuplicateRecordError;

describe("Database", function() {
   const user1 = requireNew('./fixtures/user1.json');

   before(function(initDone) {
      flow.series(
            [
               wipe.wipeAllData,
               function(done) {
                  setup.createUser(user1, done);
               }
            ],
            initDone
      );
   });

   describe("Clients", function() {
      const client1 = requireNew('./fixtures/client1.json');
      const client2 = requireNew('./fixtures/client2.json');
      const client3 = requireNew('./fixtures/client3.json');

      describe("Create", function() {

         it("Should be able to create a client (with a null creatorUserId)", function(done) {
            global.db.clients.create(client1, null, function(err, result) {
               should.not.exist(err);
               should.exist(result);

               result.should.have.property("insertId");
               result.should.have.properties({
                                                displayName : client1.displayName,
                                                clientName : client1.clientName
                                             });

               done();
            });
         });

         it("Should be able to create a different client (with a non-null creatorUserId)", function(done) {
            // make user1 the creator of this client
            global.db.clients.create(client2, user1.id, function(err, result) {
               should.not.exist(err);
               should.exist(result);

               result.should.have.property("insertId");
               result.should.have.properties({
                                                displayName : client2.displayName,
                                                clientName : client2.clientName
                                             });

               done();
            });
         });

         it("Should be able to create a another client (with a null creatorUserId)", function(done) {
            global.db.clients.create(client3, null, function(err, result) {
               should.not.exist(err);
               should.exist(result);

               result.should.have.property("insertId");
               result.should.have.properties({
                                                displayName : client3.displayName,
                                                clientName : client3.clientName
                                             });

               done();
            });
         });

         it("A client created with a null creatorUserId and no isPublic field will be forced to be public", function(done) {
            global.db.clients.findByNameAndSecret(client1.clientName, client1.clientSecret, function(err, client) {
               should.not.exist(err);
               should.exist(client);

               client.should.have.property("isPublic", 1);

               done();
            })
         });

         it("A client created with a null creatorUserId and a false isPublic field will be forced to be public", function(done) {
            global.db.clients.findByNameAndSecret(client3.clientName, client3.clientSecret, function(err, client) {
               should.not.exist(err);
               should.exist(client);

               client.should.have.property("isPublic", 1);

               done();
            })
         });

         it("Should not be able to create a duplicate client", function(done) {
            global.db.clients.create(client1, null, function(err, result) {
               should.exist(err);
               should.not.exist(result);

               err.should.be.an.instanceOf(DuplicateRecordError);
               err.should.have.property("data");
               err.data.should.have.property("code", "ER_DUP_ENTRY");

               done();
            });
         });

      });   // End Create

      describe("Find", function() {

         it("Should be able to find a client by name and secret", function(done) {
            global.db.clients.findByNameAndSecret(client1.clientName, client1.clientSecret, function(err, client) {
               if (err) {
                  return done(err);
               }

               client.should.have.properties(["id", "clientSecret", "created"]);
               client.should.have.properties({
                                                displayName : client1.displayName,
                                                clientName : client1.clientName
                                             });

               done();
            });
         });

         it("Should not be able to find a client by name and secret with a non-existent name", function(done) {
            global.db.clients.findByNameAndSecret("bogus", client1.clientSecret, function(err, client) {
               if (err) {
                  return done(err);
               }

               should.not.exist(client);

               done();
            });
         });

         it("Should not be able to find a client by name and secret with an incorrect secret", function(done) {
            global.db.clients.findByNameAndSecret(client1.clientName, "bogus", function(err, client) {
               if (err) {
                  return done(err);
               }

               should.not.exist(client);

               done();
            });
         });
      });   // End Find
   });   // End Clients
});   // End Database
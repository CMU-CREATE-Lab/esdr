var should = require('should');
var wipe = require('./fixture-helpers/wipe');
var database = require('./fixture-helpers/database');
var DuplicateRecordError = require('../lib/errors').DuplicateRecordError;

describe("Database", function() {

   before(wipe.wipeAllData);

   describe("Users", function() {
      var user1 = require('./fixtures/user1.json');
      var user2 = require('./fixtures/user2.json');

      describe("Create", function() {

         it("Should be able to create a user", function(done) {
            global.db.users.create(user1, function(err, result) {
               should.not.exist(err);
               should.exist(result);

               result.should.have.properties(["insertId", "verificationToken"]);
               result.should.have.property("email", user1.email);
               result.should.have.property("displayName", user1.displayName);

               done();
            });
         });

         it("Should be able to create another user (with no displayName)", function(done) {
            global.db.users.create(user2, function(err, result) {
               should.not.exist(err);
               should.exist(result);

               result.should.have.properties(["insertId", "verificationToken"]);
               result.should.have.properties({
                                                email : user2.email,
                                                displayName : user2.displayName
                                             });

               done();
            });
         });

         it("Should not be able to create a duplicate user", function(done) {
            global.db.users.create(user1, function(err, result) {
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

         var foundUser1 = null;

         it("Should be able to find a user by email", function(done) {
            global.db.users.findByEmail(user1.email, function(err, user) {
               should.not.exist(err);
               should.exist(user);

               user.should.have.properties(["id", "password", "created", "modified"]);
               user.should.have.properties({
                                              email : user1.email,
                                              displayName : user1.displayName
                                           });

               // remember this user so we can do the next test
               foundUser1 = user;

               done();
            });
         });

         it("Should be able to find a user by ID", function(done) {
            global.db.users.findById(foundUser1.id, function(err, user) {
               should.not.exist(err);
               should.exist(user);

               // do a deep equal
               should(user).eql(foundUser1);

               done();
            });
         });

         it("Should be able to find a user by email and password", function(done) {
            global.db.users.findByEmailAndPassword(user1.email, user1.password, function(err, user) {
               should.not.exist(err);
               should.exist(user);

               user.should.have.properties(["id", "password", "created", "modified"]);
               user.should.have.properties({
                                              email : user1.email,
                                              displayName : user1.displayName
                                           });

               done();
            });
         });

         it("Should not be able to find a user by a non-existent email", function(done) {
            global.db.users.findByEmail("bogus", function(err, user) {
               should.not.exist(err);
               should.not.exist(user);

               done();
            });
         });

         it("Should not be able to find a user by a non-existent ID", function(done) {
            global.db.users.findById(-1, function(err, user) {
               should.not.exist(err);
               should.not.exist(user);

               done();
            });
         });

         it("Should not be able to find a user by email and password with a non-existent email", function(done) {
            global.db.users.findByEmailAndPassword("bogus", user1.password, function(err, user) {
               should.not.exist(err);
               should.not.exist(user);

               done();
            });
         });

         it("Should not be able to find a user by email and password with an incorrect password", function(done) {
            global.db.users.findByEmailAndPassword(user2.email, "bogus", function(err, user) {
               should.not.exist(err);
               should.not.exist(user);

               done();
            });
         });

      });   // End Find

      describe("Reset Password", function() {

         var resetPasswordToken = null;
         var foundUser = null;
         var newPassword = 'this is my new password';

         it("Should be able to create a reset password token", function(done) {
            global.db.users.findByEmail(user1.email, function(err, user) {
               should.not.exist(err);
               should.exist(user);

               // remember this user so we can compare later
               foundUser = user;

               global.db.users.createResetPasswordToken(user1.email, function(err, token) {
                  should.not.exist(err);
                  should.exist(token);

                  // remember the token so we can use it to reset the user's password
                  resetPasswordToken = token;

                  done();
               });
            });
         });

         it("Should be able to set the password using the reset password token", function(done) {
            global.db.users.setPassword(resetPasswordToken, newPassword, function(err, wasSuccessful) {
               should.not.exist(err);
               should.exist(wasSuccessful);

               wasSuccessful.should.eql(true);

               // do a find on the user to verify that the password changed
               global.db.users.findByEmail(user1.email, function(err, user) {
                  should.not.exist(err);
                  should.exist(user);

                  foundUser.password.should.not.eql(user.password);

                  done();
               });
            });
         });

      });   // End Reset Password
   });   // End Users
});   // End Database
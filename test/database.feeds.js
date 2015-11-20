var should = require('should');
var flow = require('nimble');
var wipe = require('./fixture-helpers/wipe');
var database = require('./fixture-helpers/database');
var shallowClone = require('./fixture-helpers/test-utils').shallowClone;
var DatabaseError = require('../lib/errors').DatabaseError;
var ValidationError = require('../lib/errors').ValidationError;

describe("Database", function() {
   var user1 = require('./fixtures/user1.json');
   var product4 = require('./fixtures/product4.json');
   var device5 = require('./fixtures/device5.json');

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
                  // insert the product and remember the id
                  database.insertProduct(product4, function(err, result) {
                     if (err) {
                        return done(err);
                     }

                     product4.id = result.insertId;
                     done();
                  });
               },
               function(done) {
                  device5.userId = user1.id;
                  device5.productId = product4.id;

                  // insert the device and remember the id
                  database.insertDevice(device5, function(err, result) {
                     if (err) {
                        return done(err);
                     }

                     device5.id = result.insertId;
                     done();
                  });
               }
            ],
            initDone
      );
   });

   describe("Feeds", function() {
      var feed3 = require('./fixtures/feed3.json');

      describe("Create", function() {

         it("Should be able to create a feed", function(done) {
            global.db.feeds.create(feed3, device5.id, product4.id, user1.id, function(err, feed) {
               should.not.exist(err);
               should.exist(feed);

               feed.should.have.property('insertId');
               feed.should.have.property('apiKey');
               feed.should.have.property('apiKeyReadOnly');

               // remember these for later
               feed3.id = feed.insertId;
               feed3.apiKey = feed.apiKey;
               feed3.apiKeyReadOnly = feed.apiKeyReadOnly;

               done();
            });
         });

         it("Should fail to create a feed with an invalid name", function(done) {
            var invalidFeed = shallowClone(feed3);
            invalidFeed.name = "";

            global.db.feeds.create(invalidFeed, device5.id, product4.id, user1.id, function(err, feed) {
               should.exist(err);
               should.not.exist(feed);

               err.should.be.an.instanceOf(ValidationError);
               err.should.have.property('data');
               err.data.should.have.length(1);
               err.data[0].should.have.properties({
                                                     instanceContext : '#',
                                                     constraintName : 'required',
                                                     kind : 'ObjectValidationError'
                                                  });

               done();
            });
         });

         it("Should fail to create a feed with an invalid user id", function(done) {
            global.db.feeds.create(feed3, device5.id, product4.id, -1, function(err, feed) {
               should.exist(err);
               should.not.exist(feed);

               err.should.be.an.instanceOf(DatabaseError);

               done();
            });
         });

         it("Should fail to create a feed with an invalid product id", function(done) {
            global.db.feeds.create(feed3, device5.id, -1, user1.id, function(err, feed) {
               should.exist(err);
               should.not.exist(feed);

               err.should.be.an.instanceOf(ValidationError);
               err.should.have.property('data');
               err.data.should.have.length(1);
               err.data[0].should.have.properties({
                                                     instanceContext : '#/channelSpecs',
                                                     constraintName : 'type',
                                                     constraintValue : 'string'
                                                  });

               done();
            });
         });

         it("Should fail to create a feed with an invalid device id", function(done) {
            global.db.feeds.create(feed3, -1, product4.id, user1.id, function(err, feed) {
               should.exist(err);
               should.not.exist(feed);

               err.should.be.an.instanceOf(DatabaseError);

               done();
            });
         });

      });   // End Create

      describe("Find", function() {
         var verifyResult = function(err, feed) {
            should.not.exist(err);
            should.exist(feed);

            feed.should.have.properties(feed3);
            feed.should.have.properties({
                                           deviceId : device5.id,
                                           productId : product4.id,
                                           userId : user1.id,
                                           channelSpecs : product4.defaultChannelSpecs,
                                           channelBounds : null
                                        });
            feed.should.have.properties('id', 'apiKey', 'apiKeyReadOnly', 'created', 'modified', 'lastUpload', 'minTimeSecs', 'maxTimeSecs');
         };

         it("Should be able to find a feed by ID", function(done) {
            global.db.feeds.findById(feed3.id, null, function(err, feed) {
               verifyResult(err, feed);

               // remember the API keys for the next tests
               feed3.apiKey = feed.apiKey;
               feed3.apiKeyReadOnly = feed.apiKeyReadOnly;

               done();

            });
         });

         it("Should be able to find a feed by apiKey", function(done) {
            global.db.feeds.findByApiKey(feed3.apiKey, null, function(err, feed) {
               verifyResult(err, feed);

               done();

            });
         });

         it("Should be able to find a feed by apiKeyReadOnly", function(done) {
            global.db.feeds.findByApiKey(feed3.apiKeyReadOnly, null, function(err, feed) {
               verifyResult(err, feed);

               done();

            });
         });

      });   // End Find
   });   // End Feeds
});   // End Database
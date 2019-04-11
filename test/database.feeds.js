const should = require('should');
const flow = require('nimble');
const requireNew = require('require-new');
const wipe = require('./fixture-helpers/wipe');
const setup = require('./fixture-helpers/setup');
const shallowClone = require('./fixture-helpers/test-utils').shallowClone;
const DatabaseError = require('../lib/errors').DatabaseError;
const ValidationError = require('../lib/errors').ValidationError;

describe("Database", function() {
   const user1 = requireNew('./fixtures/user1.json');
   const product4 = requireNew('./fixtures/product4.json');
   const device5 = requireNew('./fixtures/device5.json');

   before(function(initDone) {
      flow.series(
            [
               wipe.wipeAllData,
               function(done) {
                  setup.createUser(user1, done);
               },
               function(done) {
                  setup.createProduct(product4, done);
               },
               function(done) {
                  device5.userId = user1['id'];
                  device5.productId = product4['id'];

                  setup.createDevice(device5, done);
               }
            ],
            initDone
      );
   });

   describe("Feeds", function() {
      const feed0 = requireNew('./fixtures/feed0.json');

      describe("Create", function() {

         it("Should be able to create a feed", function(done) {
            global.db.feeds.create(feed0, device5['id'], product4['id'], user1['id'], function(err, feed) {
               should.not.exist(err);
               should.exist(feed);

               feed.should.have.property('insertId');
               feed.should.have.property('apiKey');
               feed.should.have.property('apiKeyReadOnly');

               // remember these for later
               feed0['id'] = feed.insertId;
               feed0.apiKey = feed.apiKey;
               feed0.apiKeyReadOnly = feed.apiKeyReadOnly;

               done();
            });
         });

         it("Should fail to create a feed with an invalid name", function(done) {
            const invalidFeed = shallowClone(feed0);
            invalidFeed.name = "";

            global.db.feeds.create(invalidFeed, device5['id'], product4['id'], user1['id'], function(err, feed) {
               should.exist(err);
               should.not.exist(feed);

               console.log(JSON.stringify(err, null, 3));

               err.should.be.an.instanceOf(ValidationError);
               err.should.have.property('data');
               err.data.errors.should.have.length(1);
               err.data.errors[0].should.have.properties({
                                                            "keyword" : "required",
                                                            "dataPath" : "",
                                                            "schemaPath" : "#/required",
                                                            "params" : {
                                                               "missingProperty" : "name"
                                                            }
                                                         });

               done();
            });
         });

         it("Should fail to create a feed with an invalid user id", function(done) {
            global.db.feeds.create(feed0, device5['id'], product4['id'], -1, function(err, feed) {
               should.exist(err);
               should.not.exist(feed);

               err.should.be.an.instanceOf(DatabaseError);

               done();
            });
         });

         it("Should fail to create a feed with an invalid product id", function(done) {
            global.db.feeds.create(feed0, device5['id'], -1, user1['id'], function(err, feed) {
               should.exist(err);
               should.not.exist(feed);

               err.should.be.an.instanceOf(ValidationError);
               err.should.have.property('data');
               err.data.errors.should.have.length(1);
               err.data.errors[0].should.have.properties({
                                                            keyword : 'type',
                                                            dataPath : '.channelSpecs',
                                                            schemaPath : '#/properties/channelSpecs/type',
                                                            params : { type : 'string' }
                                                         });

               done();
            });
         });

         it("Should fail to create a feed with an invalid device id", function(done) {
            global.db.feeds.create(feed0, -1, product4['id'], user1['id'], function(err, feed) {
               should.exist(err);
               should.not.exist(feed);

               err.should.be.an.instanceOf(DatabaseError);

               done();
            });
         });

      });   // End Create

      describe("Find", function() {
         const verifyResult = function(err, feed) {
            should.not.exist(err);
            should.exist(feed);

            feed.should.have.properties(feed0);
            feed.should.have.properties({
                                           deviceId : device5['id'],
                                           productId : product4['id'],
                                           userId : user1['id'],
                                           channelSpecs : product4['defaultChannelSpecs'],
                                           channelBounds : null
                                        });
            feed.should.have.properties('id', 'apiKey', 'apiKeyReadOnly', 'created', 'modified', 'lastUpload', 'minTimeSecs', 'maxTimeSecs');
         };

         it("Should be able to find a feed by ID", function(done) {
            global.db.feeds.findById(feed0['id'], null, function(err, feed) {
               verifyResult(err, feed);

               // remember the API keys for the next tests
               feed0.apiKey = feed.apiKey;
               feed0.apiKeyReadOnly = feed.apiKeyReadOnly;

               done();

            });
         });

         it("Should be able to find a feed by apiKey", function(done) {
            global.db.feeds.findByApiKey(feed0.apiKey, null, function(err, feed) {
               verifyResult(err, feed);

               done();

            });
         });

         it("Should be able to find a feed by apiKeyReadOnly", function(done) {
            global.db.feeds.findByApiKey(feed0.apiKeyReadOnly, null, function(err, feed) {
               verifyResult(err, feed);

               done();

            });
         });

      });   // End Find
   });   // End Feeds
});   // End Database
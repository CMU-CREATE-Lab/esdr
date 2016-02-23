var should = require('should');
var flow = require('nimble');
var httpStatus = require('http-status');
var superagent = require('superagent-ls');
var requireNew = require('require-new');
var wipe = require('./fixture-helpers/wipe');
var setup = require('./fixture-helpers/setup');

var config = require('../config');

var ESDR_API_ROOT_URL = config.get("esdr:apiRootUrl");
var ESDR_FEEDS_API_URL = ESDR_API_ROOT_URL + "/feeds";
var ESDR_MULTIFEEDS_API_URL = ESDR_API_ROOT_URL + "/multifeeds";

describe("REST API", function() {
   var user1 = requireNew('./fixtures/user1.json');
   var user2 = requireNew('./fixtures/user2.json');
   var product1 = requireNew('./fixtures/product1.json');
   var product2 = requireNew('./fixtures/product2.json');
   var device1 = requireNew('./fixtures/device1.json');
   var device2 = requireNew('./fixtures/device2.json');
   var device3 = requireNew('./fixtures/device3.json');
   var feed1 = requireNew('./fixtures/feed1.json');                        // public,  user 1, product 1, device 1
   var feed2 = requireNew('./fixtures/feed2.json');                        // private, user 1, product 1, device 1
   var feed3 = requireNew('./fixtures/feed3.json');                        // public,  user 1, product 2, device 2
   var feed4 = requireNew('./fixtures/feed4.json');                        // private, user 1, product 2, device 2
   var feed5 = requireNew('./fixtures/feed5.json');                        // public,  user 2, product 1, device 3
   var feed6 = requireNew('./fixtures/feed6.json');                        // private, user 2, product 1, device 3
   var feed7 = requireNew('./fixtures/feed-custom-channelSpecs.json');     // private, user 1, product 1, device 1
   var feed8 = requireNew('./fixtures/feed-null-channelSpecs.json');       // private, user 1, product 1, device 1
   var multifeed1a = requireNew('./fixtures/multifeed1.json');
   var multifeed1b = requireNew('./fixtures/multifeed1.json');
   var multifeed2 = requireNew('./fixtures/multifeed2.json');

   var feedUpload1 = {
      request : requireNew('./fixtures/feed-upload1-request.json'),
      response : requireNew('./fixtures/feed-upload1-response.json')
   };

   var feedUpload2 = {
      request : requireNew('./fixtures/feed-upload2-request.json'),
      response : requireNew('./fixtures/feed-upload2-response.json')
   };

   var feedUpload3 = {
      request : requireNew('./fixtures/feed-upload3-request.json'),
      response : requireNew('./fixtures/feed-upload3-response.json')
   };

   var feedUpload4 = {
      request : requireNew('./fixtures/feed-upload4-request.json'),
      response : requireNew('./fixtures/feed-upload4-response.json')
   };

   var feedUpload5 = {
      request : requireNew('./fixtures/feed-upload5-request.json'),
      response : requireNew('./fixtures/feed-upload5-response.json')
   };

   var feedUpload6 = {
      request : requireNew('./fixtures/feed-upload6-request.json'),
      response : requireNew('./fixtures/feed-upload6-response.json')
   };

   var feedUpload7 = {
      request : requireNew('./fixtures/feed-upload7-request.json'),
      response : requireNew('./fixtures/feed-upload7-response.json')
   };

   var feedUpload8 = {
      request : requireNew('./fixtures/feed-upload8-request.json'),
      response : requireNew('./fixtures/feed-upload8-response.json')
   };

   var feedUpload9 = {
      request : requireNew('./fixtures/feed-upload9-request.json'),
      response : requireNew('./fixtures/feed-upload9-response.json')
   };

   var feedUpload10 = {
      request : requireNew('./fixtures/feed-upload10-request.json'),
      response : requireNew('./fixtures/feed-upload10-response.json')
   };

   before(function(initDone) {
      var doUpload = function(feed, feedUplaod, done) {
         superagent
               .put(ESDR_FEEDS_API_URL + "/" + feed.apiKey)
               .send(feedUplaod.request)
               .end(function(err, res) {
                  should.not.exist(err);
                  should.exist(res);

                  res.should.have.property('status', httpStatus.OK);
                  res.should.have.property('body');
                  res.body.should.have.properties({
                                                     code : httpStatus.OK,
                                                     status : 'success'
                                                  });
                  res.body.should.have.property('data');
                  res.body.data.should.have.properties(feedUplaod.response.data);

                  done();
               });
      };

      flow.series(
            [
               wipe.wipeAllData,
               function(done) {
                  setup.createUser(user1, done);
               },
               function(done) {
                  setup.verifyUser(user1, done);
               },
               function(done) {
                  setup.authentcateUser(user1, done);
               },
               function(done) {
                  setup.createUser(user2, done);
               },
               function(done) {
                  setup.verifyUser(user2, done);
               },
               function(done) {
                  setup.authentcateUser(user2, done);
               },
               function(done) {
                  product1.creatorUserId = user1.id;
                  setup.createProduct(product1, done);
               },
               function(done) {
                  product2.creatorUserId = user1.id;
                  setup.createProduct(product2, done);
               },
               function(done) {
                  device1.userId = user1.id;
                  device1.productId = product1.id;
                  setup.createDevice(device1, done);
               },
               function(done) {
                  device2.userId = user1.id;
                  device2.productId = product2.id;
                  setup.createDevice(device2, done);
               },
               function(done) {
                  device3.userId = user2.id;
                  device3.productId = product1.id;
                  setup.createDevice(device3, done);
               },
               function(done) {
                  feed1.userId = user1.id;
                  feed1.deviceId = device1.id;
                  feed1.productId = product1.id;
                  feed1.channelSpecs = product1.defaultChannelSpecs;
                  setup.createFeed(feed1, done);
               },
               function(done) {
                  feed2.userId = user1.id;
                  feed2.deviceId = device1.id;
                  feed2.productId = product1.id;
                  feed2.channelSpecs = product1.defaultChannelSpecs;
                  setup.createFeed(feed2, done);
               },
               function(done) {
                  feed3.userId = user1.id;
                  feed3.deviceId = device2.id;
                  feed3.productId = product2.id;
                  feed3.channelSpecs = product2.defaultChannelSpecs;
                  setup.createFeed(feed3, done);
               },
               function(done) {
                  feed4.userId = user1.id;
                  feed4.deviceId = device2.id;
                  feed4.productId = product2.id;
                  feed4.channelSpecs = product2.defaultChannelSpecs;
                  setup.createFeed(feed4, done);
               },
               function(done) {
                  feed5.userId = user2.id;
                  feed5.deviceId = device3.id;
                  feed5.productId = product1.id;
                  feed5.channelSpecs = product1.defaultChannelSpecs;
                  setup.createFeed(feed5, done);
               },
               function(done) {
                  feed6.userId = user2.id;
                  feed6.deviceId = device3.id;
                  feed6.productId = product1.id;
                  feed6.channelSpecs = product1.defaultChannelSpecs;
                  setup.createFeed(feed6, done);
               },
               function(done) {
                  feed7.userId = user1.id;
                  feed7.deviceId = device1.id;
                  feed7.productId = product1.id;
                  setup.createFeed(feed7, done);
               },
               function(done) {
                  feed8.userId = user1.id;
                  feed8.deviceId = device1.id;
                  feed8.productId = product1.id;
                  feed8.channelSpecs = product1.defaultChannelSpecs;
                  setup.createFeed(feed8, done);
               },
               function(done) {
                  multifeed1a.userId = user1.id;
                  setup.createMultifeed(multifeed1a, done);
               },
               function(done) {
                  multifeed1b.userId = user2.id;
                  setup.createMultifeed(multifeed1b, done);
               },
               function(done) {
                  multifeed2.userId = user1.id;
                  setup.createMultifeed(multifeed2, done);
               },
               function(done) {
                  doUpload(feed1, feedUpload1, done);
               },
               function(done) {
                  doUpload(feed1, feedUpload2, done);
               },
               function(done) {
                  doUpload(feed1, feedUpload3, done);
               },
               function(done) {
                  doUpload(feed1, feedUpload4, done);
               },
               function(done) {
                  doUpload(feed3, feedUpload5, done);
               },
               function(done) {
                  doUpload(feed3, feedUpload6, done);
               },
               function(done) {
                  doUpload(feed3, feedUpload7, done);
               },
               function(done) {
                  doUpload(feed3, feedUpload8, done);
               },
               function(done) {
                  doUpload(feed5, feedUpload1, done);
               },
               function(done) {
                  doUpload(feed5, feedUpload2, done);
               },
               function(done) {
                  doUpload(feed5, feedUpload3, done);
               },
               function(done) {
                  doUpload(feed5, feedUpload4, done);
               }
            ],
            initDone
      );
   });

   describe("Multifeeds", function() {
      describe("Get Tile", function() {

         it("Should be able to fetch the tiles for a multifeed", function(done) {
            superagent
                  .get(ESDR_MULTIFEEDS_API_URL + "/" + multifeed2.name + "/tiles/10.2633")
                  .end(function(err, res) {
                     should.not.exist(err);
                     should.exist(res);

                     res.should.have.property('status', httpStatus.OK);
                     res.should.have.property('body');
                     res.body.should.have.property('data', [
                        [1380472320, 485, 3.84, null, null, 18.6],
                        [1380556288, 501, 3.84, null, null, 18.3],
                        [1380643328, 583, 3.84, null, null, 19.5],
                        [1380725248, 551, 3.84, null, null, 19.6],
                        [1380751872, 504, 3.84, null, null, 20],
                        [1380835840, 491, 3.84, null, null, 20.7],
                        [1380883968, 612, 3.84, null, null, 21.1],
                        [1380909568, 587, 3.84, null, null, 20.3],
                        [1380922880, 571, 3.84, null, null, 19.5],
                        [1380969984, 495, 3.84, null, null, 21.8]
                     ]);
                     res.body.should.have.property('full_channel_names', [
                        user1.id + ".feed_" + feed1.id + ".conductivity",
                        user1.id + ".feed_" + feed1.id + ".battery_voltage",
                        user1.id + ".feed_" + feed3.id + ".conductivity",
                        user1.id + ".feed_" + feed3.id + ".battery_voltage",
                        user2.id + ".feed_" + feed5.id + ".temperature"
                     ]);

                     done();
                  });
         });

         it("Should fail to fetch the tiles for a multifeed with an invalid level", function(done) {
            superagent
                  .get(ESDR_MULTIFEEDS_API_URL + "/" + multifeed2.name + "/tiles/foo.2633")
                  .end(function(err, res) {
                     should.not.exist(err);
                     should.exist(res);

                     res.should.have.property('status', httpStatus.UNPROCESSABLE_ENTITY);
                     res.body.should.have.property('code', httpStatus.UNPROCESSABLE_ENTITY);
                     res.body.should.have.property('status', 'error');
                     res.body.should.have.property('data', {
                        "level" : "Level must be an integer"
                     });

                     done();
                  });
         });

         it("Should fail to fetch the tiles for a multifeed with an invalid offset", function(done) {
            superagent
                  .get(ESDR_MULTIFEEDS_API_URL + "/" + multifeed2.name + "/tiles/10.foo")
                  .end(function(err, res) {
                     should.not.exist(err);
                     should.exist(res);

                     res.should.have.property('status', httpStatus.UNPROCESSABLE_ENTITY);
                     res.body.should.have.property('code', httpStatus.UNPROCESSABLE_ENTITY);
                     res.body.should.have.property('status', 'error');
                     res.body.should.have.property('data', {
                        "offset" : "Offset must be an integer"
                     });

                     done();
                  });
         });

         it("Should fail to fetch the tiles for an known multifeed", function(done) {
            superagent
                  .get(ESDR_MULTIFEEDS_API_URL + "/" + "bogus" + "/tiles/10.2633")
                  .end(function(err, res) {
                     should.not.exist(err);
                     should.exist(res);

                     res.should.have.property('status', httpStatus.NOT_FOUND);
                     res.body.should.have.property('code', httpStatus.NOT_FOUND);
                     res.body.should.have.property('status', 'error');
                     res.body.should.have.property('data', null);

                     done();
                  });
         });

      });   // End Get Tile
   });   // End Multifeeds
});   // End REST API
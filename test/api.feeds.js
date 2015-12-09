var should = require('should');
var flow = require('nimble');
var httpStatus = require('http-status');
var superagent = require('superagent-ls');
var requireNew = require('require-new');
var wipe = require('./fixture-helpers/wipe');
var setup = require('./fixture-helpers/setup');

var config = require('../config');

var ESDR_API_ROOT_URL = config.get("esdr:apiRootUrl");
var ESDR_DEVICES_API_URL = ESDR_API_ROOT_URL + "/devices";
var ESDR_FEEDS_API_URL = ESDR_API_ROOT_URL + "/feeds";

describe("REST API", function() {
   var user1 = requireNew('./fixtures/user1.json');
   var product1 = requireNew('./fixtures/product1.json');
   var device1User1 = requireNew('./fixtures/device1.json');
   var feed1a = requireNew('./fixtures/feed1a.json');
   var feed1b = requireNew('./fixtures/feed1b.json');

   before(function(initDone) {
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
                  product1.creatorUserId = user1.id;
                  setup.createProduct(product1, done);
               },
               function(done) {
                  device1User1.userId = user1.id;
                  device1User1.productId = product1.id;
                  setup.createDevice(device1User1, done);
               }
            ],
            initDone
      );
   });

   describe.only("Feeds", function() {
      var createAuthorizationHeader = function(accessToken) {
         var token = typeof accessToken === 'function' ? accessToken() : accessToken;
         var authorization;
         if (typeof token !== 'undefined' && token != null) {
            authorization = {
               Authorization : "Bearer " + token
            };
         }

         return authorization;
      };

      describe("Create", function() {
         var creationTests = [
            {
               willDebug : true,
               description : "Should be able to create a new feed",
               accessToken : function() {
                  return user1.accessToken
               },
               device : device1User1,
               feed : feed1a,
               user : user1,
               expectedHttpStatus : httpStatus.CREATED,
               expectedStatusText : 'success'
            },
            {
               willDebug : true,
               description : "Should be able to create an additional feed for a device",
               accessToken : function() {
                  return user1.accessToken
               },
               device : device1User1,
               feed : feed1b,
               user : user1,
               expectedHttpStatus : httpStatus.CREATED,
               expectedStatusText : 'success'
            },
         ];

         creationTests.forEach(function(test) {
            it(test.description, function(done) {
               superagent
                     .post(ESDR_DEVICES_API_URL + "/" + test.device.id + "/feeds")
                     .set(createAuthorizationHeader(test.accessToken))
                     .send(test.feed)
                     .end(function(err, res) {
                        should.not.exist(err);
                        should.exist(res);

                        if (test.willDebug) {
                           console.log(JSON.stringify(res.body, null, 3));
                        }

                        res.should.have.property('status', test.expectedHttpStatus);
                        if (!test.hasEmptyBody) {
                           res.body.should.have.properties({
                                                              code : test.expectedHttpStatus,
                                                              status : test.expectedStatusText
                                                           });

                           res.body.should.have.property('data');
                           if (test.expectedResponseData) {
                              res.body.data.should.have.properties(test.expectedResponseData);
                           }

                           if (test.expectedHttpStatus == httpStatus.CREATED) {
                              res.body.data.should.have.property('id');
                              res.body.data.should.have.property('apiKey');
                              res.body.data.should.have.property('apiKeyReadOnly');

                              // remember the database ID, productId, deviceId, and userId
                              test.feed.id = res.body.data.id;
                              test.feed.productId = test.device.productId;
                              test.feed.deviceId = test.device.id;
                              test.feed.userId = test.user.id;
                              test.feed.apiKey = res.body.data.apiKey;
                              test.feed.apiKeyReadOnly = res.body.data.apiKeyReadOnly;

                              console.log(JSON.stringify(test.feed, null, 3));
                           }
                        }

                        done();
                     });
            });
         });

      });   // End Create

      describe("Find", function() {

      });   // End Find
   });   // End Feeds
});   // End REST API
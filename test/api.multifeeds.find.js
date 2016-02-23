var should = require('should');
var flow = require('nimble');
var httpStatus = require('http-status');
var superagent = require('superagent-ls');
var requireNew = require('require-new');
var wipe = require('./fixture-helpers/wipe');
var setup = require('./fixture-helpers/setup');

var config = require('../config');

var ESDR_API_ROOT_URL = config.get("esdr:apiRootUrl");
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
               }
            ],
            initDone
      );
   });

   describe("Multifeeds", function() {
      describe("Find", function() {
         var executeTest = function(test) {
            it(test.description, function(done) {
               superagent
                     .get(typeof test.url === 'function' ? test.url() : test.url)
                     .set(typeof test.headers === 'undefined' ? {} : (typeof test.headers === 'function' ? test.headers() : test.headers))
                     .end(function(err, res) {
                        should.not.exist(err);
                        should.exist(res);

                        if (test.willDebug) {
                           console.log(JSON.stringify(res.body, null, 3));
                        }

                        res.should.have.property('status', test.expectedHttpStatus || httpStatus.OK);
                        if (!test.hasEmptyBody) {
                           res.should.have.property('body');
                           res.body.should.have.properties({
                                                              code : test.expectedHttpStatus || httpStatus.OK,
                                                              status : test.expectedStatusText || 'success'
                                                           });

                           if (!test.hasEmptyData) {
                              res.body.should.have.property('data');
                              var expectedResponseData = test.getExpectedResponseData();
                              if ('rows' in expectedResponseData && 'totalCount' in expectedResponseData) {
                                 res.body.data.should.have.property('totalCount', expectedResponseData.totalCount);
                                 res.body.data.rows.forEach(function(item, index) {
                                    item.should.have.properties(expectedResponseData.rows[index]);

                                    if (test.additionalExpectedDataProperties) {
                                       item.should.have.properties(test.additionalExpectedDataProperties);
                                    }
                                    if (test.expectedMissingProperties) {
                                       test.expectedMissingProperties.forEach(function(prop) {
                                          item.should.not.have.property(prop);
                                       });
                                    }
                                 });
                              }
                              else {
                                 res.body.data.should.have.properties(expectedResponseData);

                                 if (test.additionalExpectedDataProperties) {
                                    res.body.data.should.have.properties(test.additionalExpectedDataProperties);
                                 }
                                 if (test.expectedMissingProperties) {
                                    test.expectedMissingProperties.forEach(function(prop) {
                                       res.body.data.should.not.have.property(prop);
                                    });
                                 }
                              }
                           }
                        }

                        done();
                     });
            });
         };

         describe("Find Multifeeds", function() {

            [
               {
                  description : "Should be able to find all multifeeds",
                  url : ESDR_MULTIFEEDS_API_URL,
                  getExpectedResponseData : function() {
                     return {
                        totalCount : 3,
                        offset : 0,
                        limit : 1000,
                        rows : [
                           {
                              id : multifeed1a.id,
                              name : multifeed1a.name,
                              userId : multifeed1a.userId,
                              spec : multifeed1a.spec
                           },
                           {
                              id : multifeed1b.id,
                              name : multifeed1b.name,
                              userId : multifeed1b.userId,
                              spec : multifeed1b.spec
                           },
                           {
                              id : multifeed2.id,
                              name : multifeed2.name,
                              userId : multifeed2.userId,
                              spec : multifeed2.spec
                           }
                        ]
                     };
                  },
                  additionalExpectedDataProperties : ['querySpec', 'created', 'modified']
               },
               {
                  description : "Should be able to find all multifeeds owned by a specific user",
                  url : function() {
                     return ESDR_MULTIFEEDS_API_URL + "?where=userId=" + user2.id
                  },
                  getExpectedResponseData : function() {
                     return {
                        totalCount : 1,
                        offset : 0,
                        limit : 1000,
                        rows : [
                           {
                              id : multifeed1b.id,
                              name : multifeed1b.name,
                              userId : multifeed1b.userId,
                              spec : multifeed1b.spec
                           }
                        ]
                     };
                  },
                  additionalExpectedDataProperties : ['querySpec', 'created', 'modified']
               },
               {
                  description : "Should be able to filter and order returned multifeeds",
                  url : function() {
                     return ESDR_MULTIFEEDS_API_URL + "?fields=id,name&orderBy=-id&where=userId=" + user1.id
                  },
                  getExpectedResponseData : function() {
                     return {
                        totalCount : 2,
                        offset : 0,
                        limit : 1000,
                        rows : [
                           {
                              id : multifeed2.id,
                              name : multifeed2.name
                           },
                           {
                              id : multifeed1a.id,
                              name : multifeed1a.name
                           }
                        ]
                     };
                  },
                  expectedMissingProperties : ['userId', 'spec', 'querySpec', 'created', 'modified']
               }
            ].forEach(executeTest);

         });   // End Find Multifeeds

         describe("Find Single Multifeed", function() {

            [
               {
                  description : "Should be able to find a multifeed by id",
                  url : function() {
                     return ESDR_MULTIFEEDS_API_URL + "/" + multifeed1a.id
                  },
                  getExpectedResponseData : function() {
                     return {
                        id : multifeed1a.id,
                        name : multifeed1a.name,
                        userId : multifeed1a.userId,
                        spec : multifeed1a.spec
                     };
                  },
                  additionalExpectedDataProperties : ['querySpec', 'created', 'modified']
               },
               {
                  description : "Should be able to find a multifeed by name",
                  url : function() {
                     return ESDR_MULTIFEEDS_API_URL + "/" + multifeed2.name
                  },
                  getExpectedResponseData : function() {
                     return {
                        id : multifeed2.id,
                        name : multifeed2.name,
                        userId : multifeed2.userId,
                        spec : multifeed2.spec
                     };
                  },
                  additionalExpectedDataProperties : ['querySpec', 'created', 'modified']
               },
               {
                  description : "Should be able to find a multifeed and filter returned fields",
                  url : function() {
                     return ESDR_MULTIFEEDS_API_URL + "/" + multifeed2.name + "?fields=id,userId"
                  },
                  getExpectedResponseData : function() {
                     return {
                        id : multifeed2.id,
                        userId : multifeed2.userId
                     };
                  },
                  expectedMissingProperties : ['name', 'spec', 'querySpec', 'created', 'modified']
               },
               {
                  description : "Should fail to find a multifeed with a bogus ID",
                  url : function() {
                     return ESDR_MULTIFEEDS_API_URL + "/" + 0
                  },
                  expectedHttpStatus : httpStatus.NOT_FOUND,
                  expectedStatusText : 'error',
                  hasEmptyData : true
               },
               {
                  description : "Should fail to find a multifeed with a bogus name",
                  url : function() {
                     return ESDR_MULTIFEEDS_API_URL + "/" + "bogus"
                  },
                  expectedHttpStatus : httpStatus.NOT_FOUND,
                  expectedStatusText : 'error',
                  hasEmptyData : true
               }
            ].forEach(executeTest);

         });   // End Find Single Multifeed

         describe("Find feeds described by a multifeed", function() {
            it("Should be able to get feeds described by a multifeed", function(done) {
               superagent
                     .get(ESDR_MULTIFEEDS_API_URL + "/" + multifeed2.id + "/feeds?fields=id,name,exposure&orderBy=-id")
                     .end(function(err, res) {
                        should.not.exist(err);
                        should.exist(res);

                        res.should.have.property('status', httpStatus.OK);
                        res.body.should.have.property('code', httpStatus.OK);
                        res.body.should.have.property('status', 'success');
                        res.body.should.have.property('data', {
                           totalCount : 3,
                           offset : 0,
                           limit : 1000,
                           rows : [
                              {
                                 id : feed5.id,
                                 name : feed5.name,
                                 exposure : feed5.exposure
                              },
                              {
                                 id : feed3.id,
                                 name : feed3.name,
                                 exposure : feed3.exposure
                              },
                              {
                                 id : feed1.id,
                                 name : feed1.name,
                                 exposure : feed1.exposure
                              }
                           ]
                        });

                        done();
                     });
            });
         });   // End Find feeds described by a multifeed
      });   // End Find
   });   // End Multifeeds
});   // End REST API
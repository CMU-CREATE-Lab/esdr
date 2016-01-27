var should = require('should');
var flow = require('nimble');
var httpStatus = require('http-status');
var superagent = require('superagent-ls');
var requireNew = require('require-new');
var wipe = require('./fixture-helpers/wipe');
var setup = require('./fixture-helpers/setup');
var createAuthorizationHeader = require('./fixture-helpers/test-utils').createAuthorizationHeader;

var config = require('../config');

var ESDR_API_ROOT_URL = config.get("esdr:apiRootUrl");
var ESDR_FEEDS_API_URL = ESDR_API_ROOT_URL + "/feeds";

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
               }
            ],
            initDone
      );
   });

   describe("Feeds", function() {
      describe("Find", function() {

         [
            {
               description : "Should be able to find only public feeds with no authorization",
               url : ESDR_FEEDS_API_URL,
               getExpectedResponseData : function() {
                  return {
                     totalCount : 3,
                     offset : 0,
                     limit : 1000,
                     rows : [
                        {
                           id : feed1.id,
                           name : feed1.name,
                           deviceId : feed1.deviceId,
                           productId : feed1.productId,
                           userId : feed1.userId,
                           apiKeyReadOnly : feed1.apiKeyReadOnly,   // read-only API key should be present, even when not auth'd
                           exposure : feed1.exposure,
                           isPublic : 1,
                           isMobile : feed1.isMobile,
                           latitude : feed1.latitude,
                           longitude : feed1.longitude,
                           channelSpecs : JSON.parse(product1.defaultChannelSpecs),
                           lastUpload : '0000-00-00 00:00:00',
                           channelBounds : null,
                           minTimeSecs : null,
                           maxTimeSecs : null
                        },
                        {
                           id : feed3.id,
                           name : feed3.name,
                           deviceId : feed3.deviceId,
                           productId : feed3.productId,
                           userId : feed3.userId,
                           apiKeyReadOnly : feed3.apiKeyReadOnly,   // read-only API key should be present, even when not auth'd
                           exposure : feed3.exposure,
                           isPublic : 1,
                           isMobile : feed3.isMobile,
                           latitude : feed3.latitude,
                           longitude : feed3.longitude,
                           channelSpecs : JSON.parse(product2.defaultChannelSpecs),
                           lastUpload : '0000-00-00 00:00:00',
                           channelBounds : null,
                           minTimeSecs : null,
                           maxTimeSecs : null
                        },
                        {
                           id : feed5.id,
                           name : feed5.name,
                           deviceId : feed5.deviceId,
                           productId : feed5.productId,
                           userId : feed5.userId,
                           apiKeyReadOnly : feed5.apiKeyReadOnly,   // read-only API key should be present, even when not auth'd
                           exposure : feed5.exposure,
                           isPublic : 1,
                           isMobile : feed5.isMobile,
                           latitude : feed5.latitude,
                           longitude : feed5.longitude,
                           channelSpecs : JSON.parse(product1.defaultChannelSpecs),
                           lastUpload : '0000-00-00 00:00:00',
                           channelBounds : null,
                           minTimeSecs : null,
                           maxTimeSecs : null
                        }
                     ]
                  }
               },
               additionalExpectedDataProperties : ['created', 'modified'],
               expectedMissingProperties : ['apiKey']          // API key should NOT be present when not auth'd
            },
            {
               description : "Should be able to find only public feeds with invalid authorization",
               url : function() {
                  return ESDR_FEEDS_API_URL + "?fields=id,apiKey,apiKeyReadOnly"
               },
               accessToken : function() {
                  return "bogus"
               },
               getExpectedResponseData : function() {
                  return {
                     totalCount : 3,
                     offset : 0,
                     limit : 1000,
                     rows : [
                        {
                           id : feed1.id,
                           apiKeyReadOnly : feed1.apiKeyReadOnly
                        },
                        {
                           id : feed3.id,
                           apiKeyReadOnly : feed3.apiKeyReadOnly
                        },
                        {
                           id : feed5.id,
                           apiKeyReadOnly : feed5.apiKeyReadOnly
                        }
                     ]
                  }
               },
               expectedMissingProperties : ['apiKey', 'name', 'deviceId', 'productId', 'userId', 'exposure', 'isPublic', 'isMobile', 'latitude', 'longitude', 'channelSpecs', 'lastUpload', 'channelBounds', 'minTimeSecs', 'maxTimeSecs']
            },
            {
               description : "Should be able to find all public feeds for a particular product, without authorization",
               url : function() {
                  return ESDR_FEEDS_API_URL + "?where=productId=" + product2.id
               },
               getExpectedResponseData : function() {
                  return {
                     totalCount : 1,
                     offset : 0,
                     limit : 1000,
                     rows : [
                        {
                           id : feed3.id,
                           name : feed3.name,
                           deviceId : feed3.deviceId,
                           productId : feed3.productId,
                           userId : feed3.userId,
                           apiKeyReadOnly : feed3.apiKeyReadOnly,   // read-only API key should be present, even when not auth'd
                           exposure : feed3.exposure,
                           isPublic : 1,
                           isMobile : feed3.isMobile,
                           latitude : feed3.latitude,
                           longitude : feed3.longitude,
                           channelSpecs : JSON.parse(product2.defaultChannelSpecs),
                           lastUpload : '0000-00-00 00:00:00',
                           channelBounds : null,
                           minTimeSecs : null,
                           maxTimeSecs : null
                        }
                     ]
                  }
               },
               additionalExpectedDataProperties : ['created', 'modified'],
               expectedMissingProperties : ['apiKey']          // API key should NOT be present when not auth'd
            },
            {
               description : "Should be able to find all public feeds for a particular device, without authorization",
               url : function() {
                  return ESDR_FEEDS_API_URL + "?where=deviceId=" + device1.id
               },
               getExpectedResponseData : function() {
                  return {
                     totalCount : 1,
                     offset : 0,
                     limit : 1000,
                     rows : [
                        {
                           id : feed1.id,
                           name : feed1.name,
                           deviceId : feed1.deviceId,
                           productId : feed1.productId,
                           userId : feed1.userId,
                           apiKeyReadOnly : feed1.apiKeyReadOnly,   // read-only API key should be present, even when not auth'd
                           exposure : feed1.exposure,
                           isPublic : 1,
                           isMobile : feed1.isMobile,
                           latitude : feed1.latitude,
                           longitude : feed1.longitude,
                           channelSpecs : JSON.parse(product1.defaultChannelSpecs),
                           lastUpload : '0000-00-00 00:00:00',
                           channelBounds : null,
                           minTimeSecs : null,
                           maxTimeSecs : null
                        }
                     ]
                  }
               },
               additionalExpectedDataProperties : ['created', 'modified'],
               expectedMissingProperties : ['apiKey']          // API key should NOT be present when not auth'd
            },
            {
               description : "Should be able to find all public feeds, and all private feeds owned by the auth'd user",
               url : function() {
                  return ESDR_FEEDS_API_URL + "?orderBy=id&fields=id,apiKey"
               },
               accessToken : function() {
                  return user1.accessToken
               },
               getExpectedResponseData : function() {
                  return {
                     totalCount : 7,
                     offset : 0,
                     limit : 1000,
                     rows : [
                        {
                           id : feed1.id,
                           apiKey : feed1.apiKey
                        },
                        {
                           id : feed2.id,
                           apiKey : feed2.apiKey
                        },
                        {
                           id : feed3.id,
                           apiKey : feed3.apiKey
                        },
                        {
                           id : feed4.id,
                           apiKey : feed4.apiKey
                        },
                        {
                           id : feed5.id
                        },
                        {
                           id : feed7.id,
                           apiKey : feed7.apiKey
                        },
                        {
                           id : feed8.id,
                           apiKey : feed8.apiKey
                        }
                     ]
                  }
               },
               expectedMissingProperties : ['apiKeyReadOnly', 'name', 'deviceId', 'productId', 'userId', 'exposure', 'isPublic', 'isMobile', 'latitude', 'longitude', 'channelSpecs', 'lastUpload', 'channelBounds', 'minTimeSecs', 'maxTimeSecs'],
               expectedMissingPropertiesByIndex : {
                  4 : ['apiKey']
               }
            },
            {
               description : "Should be able to find all public feeds for a particular product, and all private feeds owned by the auth'd user",
               url : function() {
                  return ESDR_FEEDS_API_URL + "?orderBy=id&fields=id,apiKey,apiKeyReadOnly&where=productId=" + product1.id
               },
               accessToken : function() {
                  return user2.accessToken
               },
               getExpectedResponseData : function() {
                  return {
                     totalCount : 3,
                     offset : 0,
                     limit : 1000,
                     rows : [
                        {
                           id : feed1.id,
                           apiKeyReadOnly : feed1.apiKeyReadOnly
                        },
                        {
                           id : feed5.id,
                           apiKey : feed5.apiKey,
                           apiKeyReadOnly : feed5.apiKeyReadOnly
                        },
                        {
                           id : feed6.id,
                           apiKey : feed6.apiKey,
                           apiKeyReadOnly : feed6.apiKeyReadOnly
                        }
                     ]
                  }
               },
               expectedMissingProperties : ['name', 'deviceId', 'productId', 'userId', 'exposure', 'isPublic', 'isMobile', 'latitude', 'longitude', 'channelSpecs', 'lastUpload', 'channelBounds', 'minTimeSecs', 'maxTimeSecs'],
               expectedMissingPropertiesByIndex : {
                  0 : ['apiKey']
               }
            },
            {
               description : "Should be able to find all public and private feeds for a particular device, with authorization by the user owning the private feeds",
               url : function() {
                  return ESDR_FEEDS_API_URL + "?orderBy=id&fields=id,apiKey,apiKeyReadOnly&where=deviceId=" + device1.id
               },
               accessToken : function() {
                  return user1.accessToken
               },
               getExpectedResponseData : function() {
                  return {
                     totalCount : 4,
                     offset : 0,
                     limit : 1000,
                     rows : [
                        {
                           id : feed1.id,
                           apiKey : feed1.apiKey,
                           apiKeyReadOnly : feed1.apiKeyReadOnly
                        },
                        {
                           id : feed2.id,
                           apiKey : feed2.apiKey,
                           apiKeyReadOnly : feed2.apiKeyReadOnly
                        },
                        {
                           id : feed7.id,
                           apiKey : feed7.apiKey,
                           apiKeyReadOnly : feed7.apiKeyReadOnly
                        },
                        {
                           id : feed8.id,
                           apiKey : feed8.apiKey,
                           apiKeyReadOnly : feed8.apiKeyReadOnly
                        }
                     ]
                  }
               },
               expectedMissingProperties : ['name', 'deviceId', 'productId', 'userId', 'exposure', 'isPublic', 'isMobile', 'latitude', 'longitude', 'channelSpecs', 'lastUpload', 'channelBounds', 'minTimeSecs', 'maxTimeSecs']
            },
            {
               description : "Should be able to find only public feeds for a particular device, with authorization by a user who doesn't own the device (or its feeds)",
               url : function() {
                  return ESDR_FEEDS_API_URL + "?fields=id,apiKey,apiKeyReadOnly&where=deviceId=" + device1.id
               },
               accessToken : function() {
                  return user2.accessToken
               },
               getExpectedResponseData : function() {
                  return {
                     totalCount : 1,
                     offset : 0,
                     limit : 1000,
                     rows : [
                        {
                           id : feed1.id,
                           apiKeyReadOnly : feed1.apiKeyReadOnly
                        }
                     ]
                  }
               },
               expectedMissingProperties : ['apiKey', 'name', 'deviceId', 'productId', 'userId', 'exposure', 'isPublic', 'isMobile', 'latitude', 'longitude', 'channelSpecs', 'lastUpload', 'channelBounds', 'minTimeSecs', 'maxTimeSecs']
            },
            {
               description : "Should be able to find a public feed by ID, without authorization",
               url : function() {
                  return ESDR_FEEDS_API_URL + "/" + feed1.id
               },
               getExpectedResponseData : function() {
                  return {
                     id : feed1.id,
                     name : feed1.name,
                     deviceId : feed1.deviceId,
                     productId : feed1.productId,
                     userId : feed1.userId,
                     apiKeyReadOnly : feed1.apiKeyReadOnly,   // read-only API key should be present, even when not auth'd
                     exposure : feed1.exposure,
                     isPublic : feed1.isPublic,
                     isMobile : feed1.isMobile,
                     latitude : feed1.latitude,
                     longitude : feed1.longitude,
                     channelSpecs : JSON.parse(product1.defaultChannelSpecs),
                     lastUpload : '0000-00-00 00:00:00',
                     channelBounds : null,
                     minTimeSecs : null,
                     maxTimeSecs : null
                  }
               },
               additionalExpectedDataProperties : ['created', 'modified'],
               expectedMissingProperties : ['apiKey']          // API key should NOT be present when not auth'd
            },
            {
               description : "Should fail to find a private feed by ID, without authorization",
               url : function() {
                  return ESDR_FEEDS_API_URL + "/" + feed2.id
               },
               expectedHttpStatus : httpStatus.UNAUTHORIZED,
               expectedStatusText : 'error',
               getExpectedResponseData : function() {
                  return null
               },
            },
            {
               description : "Should be able to apply limit and offset to found feeds",
               url : ESDR_FEEDS_API_URL + "?offset=2&limit=2&orderBy=id",
               getExpectedResponseData : function() {
                  return {
                     totalCount : 3,
                     offset : 2,
                     limit : 2,
                     rows : [
                        {
                           id : feed5.id,
                           name : feed5.name,
                           deviceId : feed5.deviceId,
                           productId : feed5.productId,
                           userId : feed5.userId,
                           apiKeyReadOnly : feed5.apiKeyReadOnly,   // read-only API key should be present, even when not auth'd
                           exposure : feed5.exposure,
                           isPublic : 1,
                           isMobile : feed5.isMobile,
                           latitude : feed5.latitude,
                           longitude : feed5.longitude,
                           channelSpecs : JSON.parse(product1.defaultChannelSpecs),
                           lastUpload : '0000-00-00 00:00:00',
                           channelBounds : null,
                           minTimeSecs : null,
                           maxTimeSecs : null
                        }
                     ]
                  }
               },
               additionalExpectedDataProperties : ['created', 'modified'],
               expectedMissingProperties : ['apiKey']          // API key should NOT be present when not auth'd
            },
            {
               description : "Should be able to order feeds based on multiple criteria",
               url : ESDR_FEEDS_API_URL + "?fields=id,productId&orderBy=productId,-id",
               accessToken : function() {
                  return user1.accessToken
               },
               getExpectedResponseData : function() {
                  return {
                     totalCount : 7,
                     offset : 0,
                     limit : 1000,
                     rows : [
                        {
                           id : feed8.id,
                           productId : feed8.productId,
                        },
                        {
                           id : feed7.id,
                           productId : feed7.productId,
                        },
                        {
                           id : feed5.id,
                           productId : feed5.productId,
                        },
                        {
                           id : feed2.id,
                           productId : feed2.productId,
                        },
                        {
                           id : feed1.id,
                           productId : feed1.productId,
                        },
                        {
                           id : feed4.id,
                           productId : feed4.productId,
                        },
                        {
                           id : feed3.id,
                           productId : feed3.productId,
                        }
                     ]
                  }
               },
               expectedMissingProperties : ['apiKey', 'apiKeyReadOnly', 'name', 'deviceId', 'userId', 'exposure', 'isPublic', 'isMobile', 'latitude', 'longitude', 'channelSpecs', 'lastUpload', 'channelBounds', 'minTimeSecs', 'maxTimeSecs'],
            },
            {
               description : "Querying for private feeds should only return feeds owned by the authenticated user",
               url : ESDR_FEEDS_API_URL + "?fields=id&orderBy=id&where=isPublic=false",
               accessToken : function() {
                  return user2.accessToken
               },
               getExpectedResponseData : function() {
                  return {
                     totalCount : 1,
                     offset : 0,
                     limit : 1000,
                     rows : [
                        {
                           id : feed6.id
                        }
                     ]
                  }
               }
            },
            {
               description : "Querying for private feeds should return nothing if unauthenticated",
               url : ESDR_FEEDS_API_URL + "?fields=id&orderBy=id&where=isPublic=false",
               getExpectedResponseData : function() {
                  return {
                     totalCount : 0,
                     offset : 0,
                     limit : 1000,
                     rows : []
                  }
               }
            }

         ].forEach(function(test) {
            it(test.description, function(done) {
               var processFindTestResult = function(err, res) {
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
                        if (expectedResponseData == null) {
                           res.body.should.have.property('data', null);
                        }
                        else {
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
                                 if (test.expectedMissingPropertiesByIndex) {
                                    // see whether there are any expected missing properties for this particular index
                                    var expectedMissingProperties = test.expectedMissingPropertiesByIndex[index];
                                    if (expectedMissingProperties) {
                                       expectedMissingProperties.forEach(function(prop) {
                                          item.should.not.have.property(prop);
                                       });
                                    }
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
                  }

                  done();
               };

               var url = typeof test.url === 'function' ? test.url() : test.url;
               if (typeof test.accessToken === 'undefined') {
                  superagent
                        .get(url)
                        .end(processFindTestResult);
               }
               else {
                  superagent
                        .get(url)
                        .set(createAuthorizationHeader(test.accessToken))
                        .end(processFindTestResult);
               }
            });
         });

      });   // End Find

   });   // End Feeds
});   // End REST API
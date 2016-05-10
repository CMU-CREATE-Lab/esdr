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
var UNKNOWN_FEED_API_KEY = "012345678901234567890123456789012345678901234567890123456789abcd";

describe("REST API", function() {
   var user1 = requireNew('./fixtures/user1.json');
   var user2 = requireNew('./fixtures/user2.json');
   var product1 = requireNew('./fixtures/product1.json');
   var device1 = requireNew('./fixtures/device1.json');
   var feed1 = requireNew('./fixtures/feed1.json');   // public,  user 1, product 1, device 1
   var feed2 = requireNew('./fixtures/feed2.json');   // private, user 1, product 1, device 1

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
                  device1.userId = user1.id;
                  device1.productId = product1.id;
                  setup.createDevice(device1, done);
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
                  doUpload(feed2, feedUpload5, done);
               },
               function(done) {
                  doUpload(feed2, feedUpload6, done);
               },
               function(done) {
                  doUpload(feed2, feedUpload7, done);
               },
               function(done) {
                  doUpload(feed2, feedUpload8, done);
               },
               function(done) {
                  doUpload(feed1, feedUpload9, done);
               },
               function(done) {
                  doUpload(feed1, feedUpload10, done);
               }
            ],
            initDone
      );
   });

   var getHeaderCsv = function(channels) {
      return ['EpochTime'].concat(channels).join(',');
   };

   var getHeaderJson = function(channels) {
      return '{"channel_names":[' + channels.map(function(item) {
               return '"' + item + '"'
            }).join(',') + '],"data":[';
   };

   var feed1Export = function(feed, isJsonFormat) {
      var userId = feed.userId;
      var feedId = feed.id;
      var channels = ['battery_voltage', 'conductivity', 'temperature', 'annotation'].map(function(channel) {
         return userId + '.feed_' + feedId + '.' + channel
      });

      if (isJsonFormat) {
         return getHeaderJson(channels) + '\n' +
                '[1380270001,null,null,14.2,null],\n' +
                '[1380276279.1,3.85,516,19,null],\n' +
                '[1380449602,3.84,485,19.2,null],\n' +
                '[1380472357,3.84,485,18.6,null],\n' +
                '[1380556690,3.84,501,18.3,null],\n' +
                '[1380600249,null,583,null,null],\n' +
                '[1380643808,3.84,583,19.5,null],\n' +
                '[1380725507,3.84,551,19.6,null],\n' +
                '[1380752155,3.84,511,20,null],\n' +
                '[1380752248,null,500,null,null],\n' +
                '[1380752359,null,501,null,null],\n' +
                '[1380836116,3.84,491,20.7,null],\n' +
                '[1380883999,3.84,612,21.1,null],\n' +
                '[1380909922,3.84,587,20.3,null],\n' +
                '[1380922452,3.84,571,19.5,null],\n' +
                '[1380969641,3.84,495,21.8,null],\n' +
                '[1381002132,3.84,503,21.6,null],\n' +
                '[1381062285,3.84,464,22.2,null],\n' +
                '[1381154132.009,3.84,565,18.5,null],\n' +
                '[1381238902.42,3.84,536,18.2,null],\n' +
                '[1381242668,3.84,541,17.7,null],\n' +
                '[1381353442,3.84,611,19.5,null],\n' +
                '[1381403282,3.84,607,20.8,null],\n' +
                '[1381485424,3.84,585,20.6,null],\n' +
                '[1381490906,3.84,587,20.3,null],\n' +
                '[1381516627,3.84,570,20.2,null],\n' +
                '[1381572510,3.84,526,20.3,null],\n' +
                '[1381636650,3.84,493,19.9,null],\n' +
                '[1381667243,3.84,483,20.4,null],\n' +
                '[1381671206,3.84,478,19.9,null],\n' +
                '[1381801851,3.84,486,20.6,null],\n' +
                '[1381802188,3.84,508,20.6,null],\n' +
                '[1381840404,3.84,506,20.8,null],\n' +
                '[1381856528,3.84,605,18.9,null],\n' +
                '[1381917431,3.84,624,20.5,null],\n' +
                '[1382006980,3.84,543,20.6,null],\n' +
                '[1382054188,3.84,517,19.6,null],\n' +
                '[1382055042,null,null,33.9,null],\n' +
                '[1446654988,null,null,null,"This is a comment in the annotation channel at time 1446654988."]\n' +
                ']}\n';
      }
      else {
         return getHeaderCsv(channels) + '\n' +
                '1380270001,,,14.2,\n' +
                '1380276279.1,3.85,516,19,\n' +
                '1380449602,3.84,485,19.2,\n' +
                '1380472357,3.84,485,18.6,\n' +
                '1380556690,3.84,501,18.3,\n' +
                '1380600249,,583,,\n' +
                '1380643808,3.84,583,19.5,\n' +
                '1380725507,3.84,551,19.6,\n' +
                '1380752155,3.84,511,20,\n' +
                '1380752248,,500,,\n' +
                '1380752359,,501,,\n' +
                '1380836116,3.84,491,20.7,\n' +
                '1380883999,3.84,612,21.1,\n' +
                '1380909922,3.84,587,20.3,\n' +
                '1380922452,3.84,571,19.5,\n' +
                '1380969641,3.84,495,21.8,\n' +
                '1381002132,3.84,503,21.6,\n' +
                '1381062285,3.84,464,22.2,\n' +
                '1381154132.009,3.84,565,18.5,\n' +
                '1381238902.42,3.84,536,18.2,\n' +
                '1381242668,3.84,541,17.7,\n' +
                '1381353442,3.84,611,19.5,\n' +
                '1381403282,3.84,607,20.8,\n' +
                '1381485424,3.84,585,20.6,\n' +
                '1381490906,3.84,587,20.3,\n' +
                '1381516627,3.84,570,20.2,\n' +
                '1381572510,3.84,526,20.3,\n' +
                '1381636650,3.84,493,19.9,\n' +
                '1381667243,3.84,483,20.4,\n' +
                '1381671206,3.84,478,19.9,\n' +
                '1381801851,3.84,486,20.6,\n' +
                '1381802188,3.84,508,20.6,\n' +
                '1381840404,3.84,506,20.8,\n' +
                '1381856528,3.84,605,18.9,\n' +
                '1381917431,3.84,624,20.5,\n' +
                '1382006980,3.84,543,20.6,\n' +
                '1382054188,3.84,517,19.6,\n' +
                '1382055042,,,33.9,\n' +
                '1446654988,,,,"This is a comment in the annotation channel at time 1446654988."\n';
      }
   };

   var feed2Export = function(feed, isJsonFormat) {
      var userId = feed.userId;
      var feedId = feed.id;
      var channels = ['battery_voltage', 'conductivity', 'temperature', 'annotation'].map(function(channel) {
         return userId + '.feed_' + feedId + '.' + channel
      });

      if (isJsonFormat) {
         return getHeaderJson(channels) + '\n' +
                '[1280270001,null,null,14.2,null],\n' +
                '[1280276279.1,2.85,1516,19,null],\n' +
                '[1280449602,2.84,1485,19.2,null],\n' +
                '[1280472357,2.84,1485,18.6,null],\n' +
                '[1280556690,2.84,1501,18.3,null],\n' +
                '[1280643808,2.84,1583,19.5,null],\n' +
                '[1280725507,2.84,1551,19.6,null],\n' +
                '[1280752155,2.84,1511,20,null],\n' +
                '[1280752248,null,1500,null,null],\n' +
                '[1280752359,null,1501,null,null],\n' +
                '[1280836116,2.84,1491,20.7,null],\n' +
                '[1280883999,2.84,1612,21.1,null],\n' +
                '[1280909922,2.84,1587,20.3,null],\n' +
                '[1280922452,2.84,1571,19.5,null],\n' +
                '[1280969641,2.84,1495,21.8,null],\n' +
                '[1281002132,2.84,1503,21.6,null],\n' +
                '[1281062285,2.84,1464,22.2,null],\n' +
                '[1281154132.009,2.84,1565,18.5,null],\n' +
                '[1281238902.42,2.84,1536,18.2,null],\n' +
                '[1281242668,2.84,1541,17.7,null],\n' +
                '[1281353442,2.84,1611,19.5,null],\n' +
                '[1281403282,2.84,1607,20.8,null],\n' +
                '[1281485424,2.84,1585,20.6,null],\n' +
                '[1281490906,2.84,1587,20.3,null],\n' +
                '[1281516627,2.84,1570,20.2,null],\n' +
                '[1281572510,2.84,1526,20.3,null],\n' +
                '[1281636650,2.84,1493,19.9,null],\n' +
                '[1281667243,2.84,1483,20.4,null],\n' +
                '[1281671206,2.84,1478,19.9,null],\n' +
                '[1281801851,2.84,1486,20.6,null],\n' +
                '[1281802188,2.84,1508,20.6,null],\n' +
                '[1281840404,2.84,1506,20.8,null],\n' +
                '[1281856528,2.84,1605,18.9,null],\n' +
                '[1281917431,2.84,1624,20.5,null],\n' +
                '[1282006980,2.84,1543,20.6,null],\n' +
                '[1282054188,2.84,1517,19.6,null],\n' +
                '[1282055042,null,null,33.9,null]\n' +
                ']}\n';
      }
      else {
         return getHeaderCsv(channels) + '\n' +
                '1280270001,,,14.2,\n' +
                '1280276279.1,2.85,1516,19,\n' +
                '1280449602,2.84,1485,19.2,\n' +
                '1280472357,2.84,1485,18.6,\n' +
                '1280556690,2.84,1501,18.3,\n' +
                '1280643808,2.84,1583,19.5,\n' +
                '1280725507,2.84,1551,19.6,\n' +
                '1280752155,2.84,1511,20,\n' +
                '1280752248,,1500,,\n' +
                '1280752359,,1501,,\n' +
                '1280836116,2.84,1491,20.7,\n' +
                '1280883999,2.84,1612,21.1,\n' +
                '1280909922,2.84,1587,20.3,\n' +
                '1280922452,2.84,1571,19.5,\n' +
                '1280969641,2.84,1495,21.8,\n' +
                '1281002132,2.84,1503,21.6,\n' +
                '1281062285,2.84,1464,22.2,\n' +
                '1281154132.009,2.84,1565,18.5,\n' +
                '1281238902.42,2.84,1536,18.2,\n' +
                '1281242668,2.84,1541,17.7,\n' +
                '1281353442,2.84,1611,19.5,\n' +
                '1281403282,2.84,1607,20.8,\n' +
                '1281485424,2.84,1585,20.6,\n' +
                '1281490906,2.84,1587,20.3,\n' +
                '1281516627,2.84,1570,20.2,\n' +
                '1281572510,2.84,1526,20.3,\n' +
                '1281636650,2.84,1493,19.9,\n' +
                '1281667243,2.84,1483,20.4,\n' +
                '1281671206,2.84,1478,19.9,\n' +
                '1281801851,2.84,1486,20.6,\n' +
                '1281802188,2.84,1508,20.6,\n' +
                '1281840404,2.84,1506,20.8,\n' +
                '1281856528,2.84,1605,18.9,\n' +
                '1281917431,2.84,1624,20.5,\n' +
                '1282006980,2.84,1543,20.6,\n' +
                '1282054188,2.84,1517,19.6,\n' +
                '1282055042,,,33.9,\n';
      }
   };

   describe("Feeds", function() {
      describe("Export", function() {
         var doExport = function(test, done) {
            superagent
                  .get(test.url)
                  .set(typeof test.headers === 'undefined' ? {} : test.headers)
                  .end(function(err, res) {
                     should.not.exist(err);
                     should.exist(res);

                     if (test.willDebug) {
                        console.log("URL=[" + test.url + "]");
                        console.log(JSON.stringify(res.body, null, 3));
                        console.log(JSON.stringify(res.text, null, 3));
                     }

                     if (typeof test.expectedFileName !== 'undefined') {
                        res.headers.should.have.property('content-disposition', 'attachment; filename=\"' + test.expectedFileName + '\"');
                     }

                     res.should.have.property('status', test.expectedHttpStatus);
                     if (!test.hasEmptyBody) {

                        res.should.have.property('body');

                        res.body.should.have.properties({
                                                           code : test.expectedHttpStatus,
                                                           status : test.expectedStatusText
                                                        });

                        if (typeof test.expectedResponseData !== 'undefined') {
                           if (test.expectedResponseData == null) {
                              res.body.should.have.property('data', null);
                           }
                           else {
                              res.body.should.have.property('data');
                              res.body.data.should.have.properties(test.expectedResponseData);
                           }
                        }
                     }

                     if (!test.willIgnoreText && typeof test.expectedResponseText !== 'undefined') {
                        if (test.expectedResponseText == null) {
                           res.text.should.equal(null);
                        }
                        else {
                           res.text.should.equal(test.expectedResponseText);
                        }
                     }

                     done();
                  });
         };

         describe("No authentication", function() {

            it("Should be able to export a public feed without authentication (CSV)", function(done) {
               doExport({
                           url : ESDR_FEEDS_API_URL + "/" + feed1.id + "/channels/battery_voltage,conductivity,temperature,annotation/export",
                           expectedFileName : 'export_of_feed_' + feed1.id + '.csv',
                           expectedHttpStatus : httpStatus.OK,
                           expectedStatusText : 'success',
                           hasEmptyBody : true,
                           expectedResponseText : feed1Export(feed1)
                        }, done);
            });

            it("Should be able to export a public feed without authentication (JSON)", function(done) {
               doExport({
                           url : ESDR_FEEDS_API_URL + "/" + feed1.id + "/channels/battery_voltage,conductivity,temperature,annotation/export?format=json",
                           expectedFileName : 'export_of_feed_' + feed1.id + '.json',
                           expectedHttpStatus : httpStatus.OK,
                           expectedStatusText : 'success',
                           hasEmptyBody : true,
                           expectedResponseText : feed1Export(feed1, true)
                        }, done);
            });

            it("Data format specifier is case-insensitive (CSV)", function(done) {
               doExport({
                           url : ESDR_FEEDS_API_URL + "/" + feed1.id + "/channels/battery_voltage,conductivity,temperature,annotation/export?format=CsV",
                           expectedFileName : 'export_of_feed_' + feed1.id + '.csv',
                           expectedHttpStatus : httpStatus.OK,
                           expectedStatusText : 'success',
                           hasEmptyBody : true,
                           expectedResponseText : feed1Export(feed1)
                        }, done);
            });

            it("Data format specifier is case-insensitive (JSON)", function(done) {
               doExport({
                           url : ESDR_FEEDS_API_URL + "/" + feed1.id + "/channels/battery_voltage,conductivity,temperature,annotation/export?format=jSoN",
                           expectedFileName : 'export_of_feed_' + feed1.id + '.json',
                           expectedHttpStatus : httpStatus.OK,
                           expectedStatusText : 'success',
                           hasEmptyBody : true,
                           expectedResponseText : feed1Export(feed1, true)
                        }, done);
            });

            it("Should ignore redundant channels (CSV)", function(done) {
               doExport({
                           url : ESDR_FEEDS_API_URL + "/" + feed1.id + "/channels/battery_voltage,battery_voltage,conductivity,battery_voltage,temperature,annotation,conductivity/export",
                           expectedFileName : 'export_of_feed_' + feed1.id + '.csv',
                           expectedHttpStatus : httpStatus.OK,
                           expectedStatusText : 'success',
                           hasEmptyBody : true,
                           expectedResponseText : feed1Export(feed1)
                        }, done);
            });

            it("Should ignore redundant channels (JSON)", function(done) {
               doExport({
                           url : ESDR_FEEDS_API_URL + "/" + feed1.id + "/channels/battery_voltage,battery_voltage,conductivity,battery_voltage,temperature,annotation,conductivity/export?format=json",
                           expectedFileName : 'export_of_feed_' + feed1.id + '.json',
                           expectedHttpStatus : httpStatus.OK,
                           expectedStatusText : 'success',
                           hasEmptyBody : true,
                           expectedResponseText : feed1Export(feed1, true)
                        }, done);
            });

            it("Should ignore invalid min and max times (CSV)", function(done) {
               doExport({
                           url : ESDR_FEEDS_API_URL + "/" + feed1.id + "/channels/battery_voltage,conductivity,temperature,annotation/export?from=foo&to=bar",
                           expectedFileName : 'export_of_feed_' + feed1.id + '.csv',
                           expectedHttpStatus : httpStatus.OK,
                           expectedStatusText : 'success',
                           hasEmptyBody : true,
                           expectedResponseText : feed1Export(feed1)
                        }, done);
            });

            it("Should ignore invalid min and max times (JSON)", function(done) {
               doExport({
                           url : ESDR_FEEDS_API_URL + "/" + feed1.id + "/channels/battery_voltage,conductivity,temperature,annotation/export?from=foo&to=bar&format=json",
                           expectedFileName : 'export_of_feed_' + feed1.id + '.json',
                           expectedHttpStatus : httpStatus.OK,
                           expectedStatusText : 'success',
                           hasEmptyBody : true,
                           expectedResponseText : feed1Export(feed1, true)
                        }, done);
            });

            it("Should fail to export a non-existent feed (CSV)", function(done) {
               doExport({
                           url : ESDR_FEEDS_API_URL + "/-1/channels/battery_voltage,conductivity,temperature,annotation/export",
                           expectedHttpStatus : httpStatus.NOT_FOUND,
                           expectedStatusText : 'error',
                           expectedResponseData : null,
                           willIgnoreText : true
                        }, done);
            });

            it("Should fail to export a non-existent feed (JSON)", function(done) {
               doExport({
                           url : ESDR_FEEDS_API_URL + "/-1/channels/battery_voltage,conductivity,temperature,annotation/export?format=json",
                           expectedHttpStatus : httpStatus.NOT_FOUND,
                           expectedStatusText : 'error',
                           expectedResponseData : null,
                           willIgnoreText : true
                        }, done);
            });

            it("Should be able to export and limit returned records by max time (CSV)", function(done) {
               var maxTime = 1380556691;
               doExport({
                           url : ESDR_FEEDS_API_URL + "/" + feed1.id + "/channels/battery_voltage/export?to=" + maxTime,
                           expectedFileName : 'export_of_feed_' + feed1.id + '_to_time_' + maxTime + '.csv',
                           expectedHttpStatus : httpStatus.OK,
                           expectedStatusText : 'success',
                           hasEmptyBody : true,
                           expectedResponseText : 'EpochTime,' + feed1.userId + '.feed_' + feed1.id + '.battery_voltage\n' +
                                                  '1380276279.1,3.85\n' +
                                                  '1380449602,3.84\n' +
                                                  '1380472357,3.84\n' +
                                                  '1380556690,3.84\n'
                        }, done);
            });

            it("Should be able to export and limit returned records by max time (JSON)", function(done) {
               var maxTime = 1380556691;
               doExport({
                           url : ESDR_FEEDS_API_URL + "/" + feed1.id + "/channels/battery_voltage/export?format=json&to=" + maxTime,
                           expectedFileName : 'export_of_feed_' + feed1.id + '_to_time_' + maxTime + '.json',
                           expectedHttpStatus : httpStatus.OK,
                           expectedStatusText : 'success',
                           hasEmptyBody : true,
                           expectedResponseText : '{"channel_names":["' + feed1.userId + '.feed_' + feed1.id + '.battery_voltage"],"data":[\n' +
                                                  '[1380276279.1,3.85],\n' +
                                                  '[1380449602,3.84],\n' +
                                                  '[1380472357,3.84],\n' +
                                                  '[1380556690,3.84]\n' +
                                                  ']}\n'
                        }, done);
            });

            it("Should be able to export and limit returned records by min time (CSV)", function(done) {
               var minTime = 1381856528;
               doExport({
                           url : ESDR_FEEDS_API_URL + "/" + feed1.id + "/channels/battery_voltage/export?from=" + minTime,
                           expectedFileName : 'export_of_feed_' + feed1.id + '_from_time_' + minTime + '.csv',
                           expectedHttpStatus : httpStatus.OK,
                           expectedStatusText : 'success',
                           hasEmptyBody : true,
                           expectedResponseText : 'EpochTime,' + feed1.userId + '.feed_' + feed1.id + '.battery_voltage\n' +
                                                  '1381856528,3.84\n' +
                                                  '1381917431,3.84\n' +
                                                  '1382006980,3.84\n' +
                                                  '1382054188,3.84\n'
                        }, done);
            });

            it("Should be able to export and limit returned records by min time (JSON)", function(done) {
               var minTime = 1381856528;
               doExport({
                           url : ESDR_FEEDS_API_URL + "/" + feed1.id + "/channels/battery_voltage/export?format=json&from=" + minTime,
                           expectedFileName : 'export_of_feed_' + feed1.id + '_from_time_' + minTime + '.json',
                           expectedHttpStatus : httpStatus.OK,
                           expectedStatusText : 'success',
                           hasEmptyBody : true,
                           expectedResponseText : '{"channel_names":["' + feed1.userId + '.feed_' + feed1.id + '.battery_voltage"],"data":[\n' +
                                                  '[1381856528,3.84],\n' +
                                                  '[1381917431,3.84],\n' +
                                                  '[1382006980,3.84],\n' +
                                                  '[1382054188,3.84]\n' +
                                                  ']}\n'
                        }, done);
            });

            it("Should be able to export and limit returned records by min and max time (CSV)", function(done) {
               var minTime = 1381002132;
               var maxTime = 1381485424;
               doExport({
                           url : ESDR_FEEDS_API_URL + "/" + feed1.id + "/channels/battery_voltage/export?from=" + minTime + "&to=" + maxTime,
                           expectedFileName : 'export_of_feed_' + feed1.id + '_from_time_' + minTime + '_to_' + maxTime + '.csv',
                           expectedHttpStatus : httpStatus.OK,
                           expectedStatusText : 'success',
                           hasEmptyBody : true,
                           expectedResponseText : 'EpochTime,' + feed1.userId + '.feed_' + feed1.id + '.battery_voltage\n' +
                                                  '1381002132,3.84\n' +
                                                  '1381062285,3.84\n' +
                                                  '1381154132.009,3.84\n' +
                                                  '1381238902.42,3.84\n' +
                                                  '1381242668,3.84\n' +
                                                  '1381353442,3.84\n' +
                                                  '1381403282,3.84\n' +
                                                  '1381485424,3.84\n'
                        }, done);
            });

            it("Should be able to export and limit returned records by min and max time (JSON)", function(done) {
               var minTime = 1381002132;
               var maxTime = 1381485424;
               doExport({
                           url : ESDR_FEEDS_API_URL + "/" + feed1.id + "/channels/battery_voltage/export?format=json&from=" + minTime + "&to=" + maxTime,
                           expectedFileName : 'export_of_feed_' + feed1.id + '_from_time_' + minTime + '_to_' + maxTime + '.json',
                           expectedHttpStatus : httpStatus.OK,
                           expectedStatusText : 'success',
                           hasEmptyBody : true,
                           expectedResponseText : '{"channel_names":["' + feed1.userId + '.feed_' + feed1.id + '.battery_voltage"],"data":[\n' +
                                                  '[1381002132,3.84],\n' +
                                                  '[1381062285,3.84],\n' +
                                                  '[1381154132.009,3.84],\n' +
                                                  '[1381238902.42,3.84],\n' +
                                                  '[1381242668,3.84],\n' +
                                                  '[1381353442,3.84],\n' +
                                                  '[1381403282,3.84],\n' +
                                                  '[1381485424,3.84]\n' +
                                                  ']}\n'
                        }, done);
            });

            it("Should be able to export and limit returned records by min and max time, even if min and max time values are swapped (CSV)", function(done) {
               var minTime = 1381002132;
               var maxTime = 1381485424;
               doExport({
                           url : ESDR_FEEDS_API_URL + "/" + feed1.id + "/channels/battery_voltage/export?from=" + maxTime + "&to=" + minTime,
                           expectedFileName : 'export_of_feed_' + feed1.id + '_from_time_' + minTime + '_to_' + maxTime + '.csv',
                           expectedHttpStatus : httpStatus.OK,
                           expectedStatusText : 'success',
                           hasEmptyBody : true,
                           expectedResponseText : 'EpochTime,' + feed1.userId + '.feed_' + feed1.id + '.battery_voltage\n' +
                                                  '1381002132,3.84\n' +
                                                  '1381062285,3.84\n' +
                                                  '1381154132.009,3.84\n' +
                                                  '1381238902.42,3.84\n' +
                                                  '1381242668,3.84\n' +
                                                  '1381353442,3.84\n' +
                                                  '1381403282,3.84\n' +
                                                  '1381485424,3.84\n'
                        }, done);
            });

            it("Should be able to export and limit returned records by min and max time, even if min and max time values are swapped (JSON)", function(done) {
               var minTime = 1381002132;
               var maxTime = 1381485424;
               doExport({
                           url : ESDR_FEEDS_API_URL + "/" + feed1.id + "/channels/battery_voltage/export?format=json&from=" + maxTime + "&to=" + minTime,
                           expectedFileName : 'export_of_feed_' + feed1.id + '_from_time_' + minTime + '_to_' + maxTime + '.json',
                           expectedHttpStatus : httpStatus.OK,
                           expectedStatusText : 'success',
                           hasEmptyBody : true,
                           expectedResponseText : '{"channel_names":["' + feed1.userId + '.feed_' + feed1.id + '.battery_voltage"],"data":[\n' +
                                                  '[1381002132,3.84],\n' +
                                                  '[1381062285,3.84],\n' +
                                                  '[1381154132.009,3.84],\n' +
                                                  '[1381238902.42,3.84],\n' +
                                                  '[1381242668,3.84],\n' +
                                                  '[1381353442,3.84],\n' +
                                                  '[1381403282,3.84],\n' +
                                                  '[1381485424,3.84]\n' +
                                                  ']}\n'
                        }, done);
            });

            it("Should fail to export a private feed without authentication (CSV)", function(done) {
               doExport({
                           url : ESDR_FEEDS_API_URL + "/" + feed2.id + "/channels/battery_voltage,conductivity,temperature,annotation/export",
                           expectedHttpStatus : httpStatus.UNAUTHORIZED,
                           expectedStatusText : 'error',
                           expectedResponseData : null,
                           willIgnoreText : true
                        }, done);
            });

            it("Should fail to export a private feed without authentication (JSON)", function(done) {
               doExport({
                           url : ESDR_FEEDS_API_URL + "/" + feed2.id + "/channels/battery_voltage,conductivity,temperature,annotation/export?format=json",
                           expectedHttpStatus : httpStatus.UNAUTHORIZED,
                           expectedStatusText : 'error',
                           expectedResponseData : null,
                           willIgnoreText : true
                        }, done);
            });

            it("Should fail to export a feed if the data format specifier is invalid (integer)", function(done) {
               doExport({
                           url : ESDR_FEEDS_API_URL + "/" + feed2.id + "/channels/battery_voltage,conductivity,temperature,annotation/export?format=42",
                           expectedHttpStatus : httpStatus.UNPROCESSABLE_ENTITY,
                           expectedStatusText : 'error',
                           expectedResponseData : { format : "42" },
                           willIgnoreText : true
                        }, done);
            });

            it("Should fail to export a feed if the data format specifier is invalid (string)", function(done) {
               doExport({
                           url : ESDR_FEEDS_API_URL + "/" + feed2.id + "/channels/battery_voltage,conductivity,temperature,annotation/export?format=foobar",
                           expectedHttpStatus : httpStatus.UNPROCESSABLE_ENTITY,
                           expectedStatusText : 'error',
                           expectedResponseData : { format : "foobar" },
                           willIgnoreText : true
                        }, done);
            });

         });   // End No authentication

         describe("OAuth2 authentication", function() {

            it("Should be able to export a private feed with valid authentication (CSV)", function(done) {
               doExport({
                           url : ESDR_FEEDS_API_URL + "/" + feed2.id + "/channels/battery_voltage,conductivity,temperature,annotation/export",
                           headers : createAuthorizationHeader(user1.accessToken),
                           expectedFileName : 'export_of_feed_' + feed2.id + '.csv',
                           expectedHttpStatus : httpStatus.OK,
                           expectedStatusText : 'success',
                           hasEmptyBody : true,
                           expectedResponseText : feed2Export(feed2)
                        }, done);
            });

            it("Should be able to export a private feed with valid authentication (JSON)", function(done) {
               doExport({
                           url : ESDR_FEEDS_API_URL + "/" + feed2.id + "/channels/battery_voltage,conductivity,temperature,annotation/export?format=json",
                           headers : createAuthorizationHeader(user1.accessToken),
                           expectedFileName : 'export_of_feed_' + feed2.id + '.json',
                           expectedHttpStatus : httpStatus.OK,
                           expectedStatusText : 'success',
                           hasEmptyBody : true,
                           expectedResponseText : feed2Export(feed2, true)
                        }, done);
            });

            it("Should fail to export a private feed without authentication (CSV)", function(done) {
               doExport({
                           url : ESDR_FEEDS_API_URL + "/" + feed2.id + "/channels/battery_voltage,conductivity,temperature,annotation/export",
                           headers : createAuthorizationHeader(user2.accessToken),
                           expectedHttpStatus : httpStatus.FORBIDDEN,
                           expectedStatusText : 'error',
                           expectedResponseData : null,
                           willIgnoreText : true
                        }, done);
            });

            it("Should fail to export a private feed without authentication (JSON)", function(done) {
               doExport({
                           url : ESDR_FEEDS_API_URL + "/" + feed2.id + "/channels/battery_voltage,conductivity,temperature,annotation/export?format=json",
                           headers : createAuthorizationHeader(user2.accessToken),
                           expectedHttpStatus : httpStatus.FORBIDDEN,
                           expectedStatusText : 'error',
                           expectedResponseData : null,
                           willIgnoreText : true
                        }, done);
            });

            it("Should fail to export a private feed with invalid authentication (CSV)", function(done) {
               doExport({
                           url : ESDR_FEEDS_API_URL + "/" + feed2.id + "/channels/battery_voltage,conductivity,temperature,annotation/export",
                           headers : createAuthorizationHeader("bogus"),
                           expectedHttpStatus : httpStatus.FORBIDDEN,
                           expectedStatusText : 'error',
                           expectedResponseData : null,
                           willIgnoreText : true
                        }, done);
            });

            it("Should fail to export a private feed with invalid authentication (JSON)", function(done) {
               doExport({
                           url : ESDR_FEEDS_API_URL + "/" + feed2.id + "/channels/battery_voltage,conductivity,temperature,annotation/export?format=json",
                           headers : createAuthorizationHeader("bogus"),
                           expectedHttpStatus : httpStatus.FORBIDDEN,
                           expectedStatusText : 'error',
                           expectedResponseData : null,
                           willIgnoreText : true
                        }, done);
            });

         });   // End OAuth2 authentication

         describe("API Key Authentication", function() {

            describe("Feed API Key in the request header", function() {

               it("Should be able to export a private feed with valid read-write authentication (CSV)", function(done) {
                  doExport({
                              url : ESDR_FEEDS_API_URL + "/" + feed2.id + "/channels/battery_voltage,conductivity,temperature,annotation/export",
                              headers : {
                                 FeedApiKey : feed2.apiKey
                              },
                              expectedFileName : 'export_of_feed_' + feed2.id + '.csv',
                              expectedHttpStatus : httpStatus.OK,
                              expectedStatusText : 'success',
                              hasEmptyBody : true,
                              expectedResponseText : feed2Export(feed2)
                           }, done);
               });

               it("Should be able to export a private feed with valid read-write authentication (JSON)", function(done) {
                  doExport({
                              url : ESDR_FEEDS_API_URL + "/" + feed2.id + "/channels/battery_voltage,conductivity,temperature,annotation/export?format=json",
                              headers : {
                                 FeedApiKey : feed2.apiKey
                              },
                              expectedFileName : 'export_of_feed_' + feed2.id + '.json',
                              expectedHttpStatus : httpStatus.OK,
                              expectedStatusText : 'success',
                              hasEmptyBody : true,
                              expectedResponseText : feed2Export(feed2, true)
                           }, done);
               });

               it("Should be able to export a private feed with valid read-only authentication (CSV)", function(done) {
                  doExport({
                              url : ESDR_FEEDS_API_URL + "/" + feed2.id + "/channels/battery_voltage,conductivity,temperature,annotation/export",
                              headers : {
                                 FeedApiKey : feed2.apiKeyReadOnly
                              },
                              expectedFileName : 'export_of_feed_' + feed2.id + '.csv',
                              expectedHttpStatus : httpStatus.OK,
                              expectedStatusText : 'success',
                              hasEmptyBody : true,
                              expectedResponseText : feed2Export(feed2)
                           }, done);
               });

               it("Should be able to export a private feed with valid read-only authentication (JSON)", function(done) {
                  doExport({
                              url : ESDR_FEEDS_API_URL + "/" + feed2.id + "/channels/battery_voltage,conductivity,temperature,annotation/export?format=json",
                              headers : {
                                 FeedApiKey : feed2.apiKeyReadOnly
                              },
                              expectedFileName : 'export_of_feed_' + feed2.id + '.json',
                              expectedHttpStatus : httpStatus.OK,
                              expectedStatusText : 'success',
                              hasEmptyBody : true,
                              expectedResponseText : feed2Export(feed2, true)
                           }, done);
               });

               it("Should fail to export a private feed with valid authentication, but for the wrong feed (CSV)", function(done) {
                  doExport({
                              url : ESDR_FEEDS_API_URL + "/" + feed2.id + "/channels/battery_voltage,conductivity,temperature,annotation/export",
                              headers : {
                                 FeedApiKey : feed1.apiKeyReadOnly
                              },
                              expectedHttpStatus : httpStatus.FORBIDDEN,
                              expectedStatusText : 'error',
                              expectedResponseData : null,
                              willIgnoreText : true
                           }, done);
               });

               it("Should fail to export a private feed with valid authentication, but for the wrong feed (JSON)", function(done) {
                  doExport({
                              url : ESDR_FEEDS_API_URL + "/" + feed2.id + "/channels/battery_voltage,conductivity,temperature,annotation/export?format=json",
                              headers : {
                                 FeedApiKey : feed1.apiKeyReadOnly
                              },
                              expectedHttpStatus : httpStatus.FORBIDDEN,
                              expectedStatusText : 'error',
                              expectedResponseData : null,
                              willIgnoreText : true
                           }, done);
               });

               it("Should fail to export a private feed with invalid authentication (CSV)", function(done) {
                  doExport({
                              url : ESDR_FEEDS_API_URL + "/" + feed2.id + "/channels/battery_voltage,conductivity,temperature,annotation/export",
                              headers : {
                                 FeedApiKey : "bogus"
                              },
                              expectedHttpStatus : httpStatus.FORBIDDEN,
                              expectedStatusText : 'error',
                              expectedResponseData : null,
                              willIgnoreText : true
                           }, done);
               });

               it("Should fail to export a private feed with invalid authentication (JSON)", function(done) {
                  doExport({
                              url : ESDR_FEEDS_API_URL + "/" + feed2.id + "/channels/battery_voltage,conductivity,temperature,annotation/export?format=json",
                              headers : {
                                 FeedApiKey : "bogus"
                              },
                              expectedHttpStatus : httpStatus.FORBIDDEN,
                              expectedStatusText : 'error',
                              expectedResponseData : null,
                              willIgnoreText : true
                           }, done);
               });

            });   // End Feed API Key in the request header

            describe("Feed API Key in the URL", function() {

               it("Should be able to export a private feed with valid read-write authentication (CSV)", function(done) {
                  doExport({
                              url : ESDR_FEEDS_API_URL + "/" + feed2.apiKey + "/channels/battery_voltage,conductivity,temperature,annotation/export",
                              expectedFileName : 'export_of_feed_' + feed2.id + '.csv',
                              expectedHttpStatus : httpStatus.OK,
                              expectedStatusText : 'success',
                              hasEmptyBody : true,
                              expectedResponseText : feed2Export(feed2)
                           }, done);
               });

               it("Should be able to export a private feed with valid read-write authentication (JSON)", function(done) {
                  doExport({
                              url : ESDR_FEEDS_API_URL + "/" + feed2.apiKey + "/channels/battery_voltage,conductivity,temperature,annotation/export?format=json",
                              expectedFileName : 'export_of_feed_' + feed2.id + '.json',
                              expectedHttpStatus : httpStatus.OK,
                              expectedStatusText : 'success',
                              hasEmptyBody : true,
                              expectedResponseText : feed2Export(feed2, true)
                           }, done);
               });

               it("Should be able to export a private feed with valid read-only authentication (CSV)", function(done) {
                  doExport({
                              url : ESDR_FEEDS_API_URL + "/" + feed2.apiKeyReadOnly + "/channels/battery_voltage,conductivity,temperature,annotation/export",
                              expectedFileName : 'export_of_feed_' + feed2.id + '.csv',
                              expectedHttpStatus : httpStatus.OK,
                              expectedStatusText : 'success',
                              hasEmptyBody : true,
                              expectedResponseText : feed2Export(feed2)
                           }, done);
               });

               it("Should be able to export a private feed with valid read-only authentication (JSON)", function(done) {
                  doExport({
                              url : ESDR_FEEDS_API_URL + "/" + feed2.apiKeyReadOnly + "/channels/battery_voltage,conductivity,temperature,annotation/export?format=json",
                              expectedFileName : 'export_of_feed_' + feed2.id + '.json',
                              expectedHttpStatus : httpStatus.OK,
                              expectedStatusText : 'success',
                              hasEmptyBody : true,
                              expectedResponseText : feed2Export(feed2, true)
                           }, done);
               });

               it("Should fail to export a private feed with invalid authentication (CSV)", function(done) {
                  doExport({
                              url : ESDR_FEEDS_API_URL + "/" + UNKNOWN_FEED_API_KEY + "/channels/battery_voltage,conductivity,temperature,annotation/export",
                              expectedHttpStatus : httpStatus.NOT_FOUND,
                              expectedStatusText : 'error',
                              expectedResponseData : null,
                              willIgnoreText : true
                           }, done);
               });

               it("Should fail to export a private feed with invalid authentication (JSON)", function(done) {
                  doExport({
                              url : ESDR_FEEDS_API_URL + "/" + UNKNOWN_FEED_API_KEY + "/channels/battery_voltage,conductivity,temperature,annotation/export?format=json",
                              expectedHttpStatus : httpStatus.NOT_FOUND,
                              expectedStatusText : 'error',
                              expectedResponseData : null,
                              willIgnoreText : true
                           }, done);
               });

            });   // End Feed API Key in the URL
         });   // End API Key Authentication
      });   // End Export
   });   // End Feeds
});   // End REST API
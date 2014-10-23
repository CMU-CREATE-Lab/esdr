var express = require('express');
var router = express.Router();
var passport = require('passport');
var httpStatus = require('http-status');
var log = require('log4js').getLogger();

module.exports = function(FeedModel, feedRouteHelper) {

   // for uploads authenticated using the feed's API Key in the header
   router.put('/',
              passport.authenticate('localapikey', { session : false }),
              function(req, res, next) {
                 var feed = req.authInfo.feed;
                 var isReadOnly = req.authInfo.isReadOnly;

                 // Deny access if user authenticated with the read-only API key
                 if (isReadOnly) {
                    return res.jsendClientError("Access denied.", null, httpStatus.FORBIDDEN);  // HTTP 403 Forbidden
                 }

                 log.debug("Received PUT to upload data for feed ID [" + feed.id + "] (feed API Key authentication)");
                 return feedRouteHelper.importData(res, feed, req.body);
              });

   // for getting info about a feed, authenticated using the feed's API Key in the request header
   router.get('/',
              passport.authenticate('localapikey', { session : false }),
              function(req, res, next) {
                 var feed = req.authInfo.feed;
                 log.debug("Received GET to get info for in feed [" + feed.id + "] (feed API Key authentication)");

                 FeedModel.filterFields(feed, req.query.fields, function(err, filteredFeed) {
                    if (err) {
                       return res.jsendServerError("Failed to get feed: " + err.message, null);
                    }

                    return feedRouteHelper.getInfo(res, filteredFeed, req.authInfo.isReadOnly);
                 });
              });

   // for tile requests authenticated using the feed's API Key in the header
   router.get('/channels/:channelName/tiles/:level.:offset',
              passport.authenticate('localapikey', { session : false }),
              function(req, res, next) {
                 var feed = req.authInfo.feed;
                 var channelName = req.params.channelName;
                 var level = req.params.level;
                 var offset = req.params.offset;

                 return feedRouteHelper.getTile(res, feed, channelName, level, offset);
              });

   return router;
};

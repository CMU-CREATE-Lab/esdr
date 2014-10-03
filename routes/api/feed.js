var express = require('express');
var router = express.Router();
var passport = require('passport');
var httpStatus = require('http-status');
var log = require('log4js').getLogger();

module.exports = function(FeedModel, datastore, feedRouteHelper) {

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
   // TODO: allow filtering by min/max time
   router.get('/',
              passport.authenticate('localapikey', { session : false }),
              function(req, res, next) {
                 var feed = req.authInfo.feed;

                 log.debug("Received GET to get info for in feed [" + feed.id + "] (feed API Key authentication)");
                 return feedRouteHelper.getInfo(res, feed);
              });

   // for tile requests authenticated using the feed's API Key in the header
   router.get('/channels/:channelName/tiles/:level.:offset',
              passport.authenticate('localapikey', { session : false }),
              function(req, res, next) {
                 var feed = req.authInfo.feed;
                 var channelName = req.params.channelName;
                 var level = req.params.level;
                 var offset = req.params.offset;

                 log.debug("Received GET to get tile for channel [" + channelName + "] in feed [" + feed.id + "] with level.offset [" + level + "." + offset + "](feed API Key authentication)");
                 return feedRouteHelper.getTile(res, feed, channelName, level, offset);
              });

   return router;
};

var express = require('express');
var router = express.Router();
var passport = require('passport');
var ValidationError = require('../../lib/errors').ValidationError;
var httpStatus = require('http-status');
var log = require('log4js').getLogger();

module.exports = function(DeviceModel, FeedModel) {

   // list feeds for a given device
   router.get('/:deviceId/feeds',
              function(req, res, next) {
                 var deviceId = req.params.deviceId;
                 log.debug("Received GET to list all feeds for device ID [" + deviceId + "]");

                 // find the device
                 findDeviceById(res, deviceId, function(device) {
                    passport.authenticate('bearer', function(err1, user, info) {
                       if (err1) {
                          var message = "Error while authenticating to find feeds for device ID [" + deviceId + "]";
                          log.error(message + ": " + err1);
                          return res.jsendServerError(message);
                       }

                       // Now try to find feeds for this device
                       FeedModel.findFeedsForDevice(deviceId, function(err2, feeds) {
                          if (err2) {
                             var message = "Error while finding feeds for device ID [" + deviceId + "]";
                             log.error(message + ": " + err2);
                             return res.jsendServerError(message);
                          }

                          // filter the feeds (if any)
                          var filteredFeeds = [];
                          if (feeds) {
                             feeds.forEach(function(feed) {
                                // no need to pass through the datastoreId
                                delete feed.datastoreId;

                                // only include public feeds and private feeds owned by the auth'd user (if any)
                                var hasAccessToPrivateFeed = (user && user.id == feed.userId);
                                if (feed.isPublic || hasAccessToPrivateFeed) {
                                   // Remove the feed's apiKey if the user doesn't have private access (i.e. isn't
                                   // auth'd or isn't the feed owner). It's OK to leave the apiKeyReadOnly in the object
                                   // since the feed is either public or owned by this user.
                                   if (!hasAccessToPrivateFeed) {
                                      delete feed.apiKey;
                                   }

                                   // inflate the channel specs JSON text into an object
                                   feed.channelSpecs = JSON.parse(feed.channelSpecs);

                                   filteredFeeds.push(feed);
                                }
                             });
                          }

                          return res.jsendSuccess(filteredFeeds);
                       });
                    })(req, res, next);

                 });
              });

   // create a feed for the specified device (specified by device ID)
   router.post('/:deviceId/feeds',
               passport.authenticate('bearer', { session : false }),
               function(req, res, next) {
                  var deviceId = req.params.deviceId;
                  log.debug("Received POST to create a new feed for device ID [" + deviceId + "]");

                  // find the device
                  findDeviceById(res, deviceId, function(device) {
                     // Make sure this user currently owns this device
                     if (req.user.id == device.userId) {
                        log.debug("Found device [" + device.serialNumber + "], will now create the feed...");
                        var newFeed = req.body;
                        FeedModel.create(newFeed, device.id, device.productId, req.user.id, function(err2, result) {
                           if (err2) {
                              if (err2 instanceof ValidationError) {
                                 return res.jsendClientError("Validation failure", err2.data, httpStatus.UNPROCESSABLE_ENTITY);   // HTTP 422 Unprocessable Entity
                              }

                              var message = "Error while trying to create feed for device [" + device.serialNumber + "]";
                              log.error(message + ": " + err2);
                              return res.jsendServerError(message);
                           }

                           log.debug("Created new feed for device [" + device.serialNumber + "] with id [" + result.insertId + "] ");

                           return res.jsendSuccess({
                                                      id : result.insertId,
                                                      apiKey : result.apiKey,
                                                      apiKeyReadOnly : result.apiKeyReadOnly
                                                   }, httpStatus.CREATED); // HTTP 201 Created
                        });
                     }
                     else {
                        return res.jsendClientError("Access denied.", null, httpStatus.FORBIDDEN);  // HTTP 403 Forbidden
                     }
                  });
               });

   var findDeviceById = function(res, deviceId, successCallback) {
      DeviceModel.findById(deviceId, function(err, device) {
         if (err) {
            var message = "Error while trying to find device with ID [" + deviceId + "]";
            log.error(message + ": " + err);
            return res.jsendServerError(message);
         }

         if (device) {
            return successCallback(device);
         }
         else {
            return res.jsendClientError("Unknown or invalid device ID", null, httpStatus.NOT_FOUND); // HTTP 404 Not Found
         }
      });
   };

   return router;
};

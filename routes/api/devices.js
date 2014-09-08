var express = require('express');
var router = express.Router();
var passport = require('passport');
var ValidationError = require('../../lib/errors').ValidationError;
var httpStatus = require('http-status');
var log = require('log4js').getLogger();

module.exports = function(DeviceModel, FeedModel) {

   // create a feed for the specified device (specified by device ID)
   router.post('/:deviceId',
               passport.authenticate('bearer', { session : false }),
               function(req, res, next) {
                  var deviceId = req.params.deviceId;
                  log.debug("Received POST to create a new feed for device ID or serial number [" + deviceId + "]");

                  // find the device
                  DeviceModel.findById(deviceId, function(err1, device) {
                     if (err1) {
                        var message = "Error while trying to find device with ID [" + deviceId + "]";
                        log.error(message + ": " + err1);
                        return res.jsendServerError(message);
                     }

                     if (device) {
                        // Make sure this user currently owns this device
                        if (req.user.id == device.userId) {
                           log.debug("Found device [" + device.serialNumber + "], will now create the feed...");
                           var newFeed = req.body;
                           FeedModel.create(newFeed, device.id, req.user.id, function(err2, result) {
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
                                                         apiToken : result.apiToken
                                                      }, httpStatus.CREATED); // HTTP 201 Created
                           });
                        }
                        else {
                           return res.jsendClientError("Access denied.", null, httpStatus.FORBIDDEN);  // HTTP 403 Forbidden
                        }
                     }
                     else {
                        return res.jsendClientError("Unknown or invalid device", null, httpStatus.BAD_REQUEST); // HTTP 400 Bad Request
                     }
                  });
               });

   return router;
};

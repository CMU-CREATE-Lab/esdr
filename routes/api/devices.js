var express = require('express');
var router = express.Router();
var passport = require('passport');
var ValidationError = require('../../lib/errors').ValidationError;
var httpStatus = require('http-status');
var JSendError = require('jsend-utils').JSendError;
var log = require('log4js').getLogger('esdr:routes:api:devices');

module.exports = function(DeviceModel, FeedModel) {

   // find devices
   router.get('/',
              passport.authenticate('bearer', { session : false }),
              function(req, res, next) {
                 DeviceModel.findForUser(req.user.id,
                                         req.query,
                                         function(err, result, selectedFields) {
                                            if (err) {
                                               log.error(JSON.stringify(err, null, 3));
                                               // See if the error contains a JSend data object.  If so, pass it on through.
                                               if (typeof err.data !== 'undefined' &&
                                                   typeof err.data.code !== 'undefined' &&
                                                   typeof err.data.status !== 'undefined') {
                                                  return res.jsendPassThrough(err.data);
                                               }
                                               return res.jsendServerError("Failed to get feeds", null);
                                            }

                                            return res.jsendSuccess(result);
                                         });
              });

   // get details for a specific device
   router.get('/:deviceId',
              passport.authenticate('bearer', { session : false }),
              function(req, res, next) {
                 var deviceId = req.params.deviceId;
                 log.debug("Received GET for device ID [" + deviceId + "]");

                 findDeviceByIdForUser(res, deviceId, req.user.id, req.query.fields, function(device) {
                    return res.jsendSuccess(device); // HTTP 200 OK
                 });
              });

   router.delete('/:id',
                 passport.authenticate('bearer', { session : false }),
                 function(req, res, next) {
                    var userId = req.user.id;
                    var deviceId = req.params.id;
                    log.debug("Received DELETE for device [" + deviceId + "]");
                    DeviceModel.findByIdForUser(deviceId, userId, "id,userId", function(err, prod){
                       //console.log("delete find err = "+err+", prod = "+prod);
                       //console.dir(prod);
                       if (err){
                          console.dir(err);
                          console.log("Access Denied");
                          res.jsendClientError("Access denied", err.data);
                       }
                       else if (prod.userId != userId) {
                          console.log("Access Denied, since creator userId is "+prod.userId+" and attempted deletor userId is "+userId);
                          res.jsendClientError("Access denied", null, httpStatus.FORBIDDEN);
                       } else {
                          console.log("Device removed.");
                          DeviceModel.remove(deviceId, userId, function(result) {
                             res.jsendSuccess(result);
                          });
                       }
                    });
                 });

   // create a feed for the specified device (specified by device ID)
   router.post('/:deviceId/feeds',
               passport.authenticate('bearer', { session : false }),
               function(req, res, next) {
                  var deviceId = req.params.deviceId;
                  log.debug("Received POST to create a new feed for device ID [" + deviceId + "]");

                  // find the device
                  findDeviceByIdForUser(res, deviceId, req.user.id, 'id,serialNumber,productId', function(device) {
                     log.debug("Found device [" + device.serialNumber + "], will now create the feed...");
                     var newFeed = req.body;
                     FeedModel.create(newFeed, device.id, device.productId, req.user.id, function(err2, result) {
                        if (err2) {
                           if (err2 instanceof ValidationError) {
                              return res.jsendClientValidationError("Validation failure", err2.data);   // HTTP 422 Unprocessable Entity
                           }

                           var message = "Error while trying to create feed for device [" + device.serialNumber + "]";
                           log.error(message + ": " + err2);
                           return res.jsendServerError(message);
                        }

                        log.debug("Created new feed for device [" + device.serialNumber + "] with id [" + result.insertId + "] for user [" + req.user.id + "]");

                        return res.jsendSuccess({
                                                   id : result.insertId,
                                                   apiKey : result.apiKey,
                                                   apiKeyReadOnly : result.apiKeyReadOnly
                                                }, httpStatus.CREATED); // HTTP 201 Created
                     });
                  });
               });

   var findDeviceByIdForUser = function(res, deviceId, authUserId, fieldsToSelect, successCallback) {
      DeviceModel.findByIdForUser(deviceId, authUserId, fieldsToSelect, function(err, device) {
         if (err) {
            if (err instanceof JSendError) {
               return res.jsendPassThrough(err.data);
            }
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

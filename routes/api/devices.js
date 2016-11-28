var express = require('express');
var router = express.Router();
var passport = require('passport');
var ValidationError = require('../../lib/errors').ValidationError;
var httpStatus = require('http-status');
var JSendError = require('jsend-utils').JSendError;
var log = require('log4js').getLogger('esdr:routes:api:devices');
var isPositiveIntString = require('../../lib/typeUtils').isPositiveIntString;

module.exports = function(DeviceModel, DevicePropertiesModel, FeedModel) {

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

   // delete a device (MUST be authenticated with OAuth2 access token)
   router.delete('/:deviceId',
                 passport.authenticate('bearer', { session : false }),
                 function(req, res, next) {
                    var deviceId = req.params.deviceId;
                    log.debug("DELETE device [" + deviceId + "] for user [" + req.user.id + "]");
                    if (isPositiveIntString(deviceId)) {
                       deviceId = parseInt(deviceId); // make it an int
                       DeviceModel.deleteDevice(deviceId,
                                                req.user.id,
                                                function(err, deleteResult) {
                                                   if (err) {
                                                      if (err instanceof JSendError) {
                                                         return res.jsendPassThrough(err.data);
                                                      }
                                                      else {
                                                         return res.jsendServerError("Failed to delete device", { id : deviceId });
                                                      }
                                                   }
                                                   else {
                                                      return res.jsendSuccess(deleteResult);
                                                   }
                                                });
                    }
                    else {
                       return res.jsendClientError("Unknown or invalid device", null, httpStatus.NOT_FOUND); // HTTP 404 Not Found
                    }
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

   router.put('/:deviceId/properties/:key',
              passport.authenticate('bearer', { session : false }),
              function(req, res) {
                 verifyDeviceOwnership(req, res, function(clientId, deviceId) {
                    // try setting the property
                    DevicePropertiesModel.setProperty(clientId, deviceId, req.params['key'], req.body, function(err, property) {
                       if (err) {
                          if (err instanceof ValidationError) {
                             return res.jsendClientValidationError(err.message || "Validation failure", err.data);   // HTTP 422 Unprocessable Entity
                          }
                          if (typeof err.data !== 'undefined' &&
                              typeof err.data.code !== 'undefined' &&
                              typeof err.data.status !== 'undefined') {
                             return res.jsendPassThrough(err.data);
                          }

                          var message = "Error setting property";
                          log.error(message + ": " + err);
                          return res.jsendServerError(message);
                       }

                       return res.jsendSuccess(property); // HTTP 200 OK
                    });
                 });
              }
   );

   router.get('/:deviceId/properties/:key',
              passport.authenticate('bearer', { session : false }),
              function(req, res) {
                 verifyDeviceOwnership(req, res, function(clientId, deviceId) {
                    DevicePropertiesModel.getProperty(clientId, deviceId, req.params['key'], function(err, property) {
                       if (err) {
                          if (err instanceof ValidationError) {
                             return res.jsendClientValidationError(err.message || "Validation failure", err.data);   // HTTP 422 Unprocessable Entity
                          }
                          if (typeof err.data !== 'undefined' &&
                              typeof err.data.code !== 'undefined' &&
                              typeof err.data.status !== 'undefined') {
                             return res.jsendPassThrough(err.data);
                          }

                          var message = "Error while finding property [" + req.params['key'] + "]";
                          log.error(message + ": " + err);
                          return res.jsendServerError(message);
                       }

                       if (property) {
                          return res.jsendSuccess(property); // HTTP 200 OK
                       }
                       else {
                          return res.jsendClientError("Unknown or invalid property", null, httpStatus.NOT_FOUND); // HTTP 404 Not Found
                       }
                    });
                 });
              }
   );

   router.get('/:deviceId/properties',
              passport.authenticate('bearer', { session : false }),
              function(req, res) {
                 verifyDeviceOwnership(req, res, function(clientId, deviceId) {
                    DevicePropertiesModel.find(clientId, deviceId, req.query, function(err, properties) {
                       if (err) {
                          var message = "Error while finding the device properties";
                          log.error(message + ": " + err);
                          return res.jsendServerError(message);
                       }

                       return res.jsendSuccess(properties); // HTTP 200 OK
                    });
                 });
              }
   );

   router.delete('/:deviceId/properties',
                 passport.authenticate('bearer', { session : false }),
                 function(req, res) {

                    verifyDeviceOwnership(req, res, function(clientId, deviceId) {
                       DevicePropertiesModel.deleteAll(clientId, deviceId, function(err, deleteResult) {
                          if (err) {
                             var message = "Error while deleting the device properties";
                             log.error(message + ": " + err);
                             return res.jsendServerError(message);
                          }

                          return res.jsendSuccess(deleteResult); // HTTP 200 OK
                       });
                    });
                 }
   );

   router.delete('/:deviceId/properties/:key',
                 passport.authenticate('bearer', { session : false }),
                 function(req, res) {
                    verifyDeviceOwnership(req, res, function(clientId, deviceId) {
                       DevicePropertiesModel.deleteProperty(clientId, deviceId, req.params['key'], function(err, deleteResult) {
                          if (err) {
                             if (err instanceof ValidationError) {
                                return res.jsendClientValidationError(err.message || "Validation failure", err.data);   // HTTP 422 Unprocessable Entity
                             }
                             if (typeof err.data !== 'undefined' &&
                                 typeof err.data.code !== 'undefined' &&
                                 typeof err.data.status !== 'undefined') {
                                return res.jsendPassThrough(err.data);
                             }

                             var message = "Error while deleting property [" + req.params['key'] + "]";
                             log.error(message + ": " + err);
                             return res.jsendServerError(message);
                          }

                          return res.jsendSuccess(deleteResult); // HTTP 200 OK
                       });
                    });
                 }
   );

   /**
    * Executes the given <code>action</code> function if and only if the device specified by the deviceId in the URL is
    * owned by the OAuth2 authenticated user.
    *
    * @param req the HTTP request
    * @param res the HTTP response
    * @param {function} action function with signature <code>callback(clientId, deviceId)</code>
    */
   var verifyDeviceOwnership = function(req, res, action) {
      findDeviceByIdForUser(res, req.params.deviceId, req.user.id, 'id', function(device) {
         action(req.authInfo.token.clientId, device.id);
      });
   };

   var findDeviceByIdForUser = function(res, deviceId, authUserId, fieldsToSelect, successCallback) {
      if (isPositiveIntString(deviceId)) {
         deviceId = parseInt(deviceId); // make it an int
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
      } else {
         return res.jsendClientError("Unknown or invalid device ID", null, httpStatus.NOT_FOUND); // HTTP 404 Not Found
      }
   };

   return router;
};

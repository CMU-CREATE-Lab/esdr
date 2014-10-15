var express = require('express');
var router = express.Router();
var passport = require('passport');
var ValidationError = require('../../lib/errors').ValidationError;
var DuplicateRecordError = require('../../lib/errors').DuplicateRecordError;
var httpStatus = require('http-status');
var S = require('string');
var log = require('log4js').getLogger();

module.exports = function(ProductModel, DeviceModel) {

   router.get('/',
              function(req, res, next) {

                 ProductModel.findProducts(req.query, function(err, result, selectedFields) {
                    if (err) {
                       log.error(JSON.stringify(err, null, 3));
                       // See if the error contains a JSend data object.  If so, pass it on through.
                       if (typeof err.data !== 'undefined' &&
                           typeof err.data.code !== 'undefined' &&
                           typeof err.data.status !== 'undefined') {
                          return res.jsendPassThrough(err.data);
                       }
                       return res.jsendServerError("Failed to get products", null);
                    }

                    // inflate the channel specs, if selected
                    if ((selectedFields.indexOf('defaultChannelSpecs') >= 0)) {
                       result.rows.forEach(function(product) {
                          product.defaultChannelSpecs = JSON.parse(product.defaultChannelSpecs);
                       });
                    }

                    log.debug(JSON.stringify(result, null, 3));

                    return res.jsendSuccess(result);

                 });
              });

   // create a product
   router.post('/',
               passport.authenticate('bearer', { session : false }),
               function(req, res) {
                  var newProduct = req.body;
                  log.debug("Received POST from user [" + req.user.id + "] to create product [" + (newProduct && newProduct.name ? newProduct.name : null) + "]");
                  ProductModel.create(newProduct,
                                      req.user.id,
                                      function(err, result) {
                                         if (err) {
                                            if (err instanceof ValidationError) {
                                               return res.jsendClientValidationError("Validation failure", err.data);   // HTTP 422 Unprocessable Entity
                                            }
                                            if (err instanceof DuplicateRecordError) {
                                               log.debug("Product name [" + newProduct.name + "] already in use!");
                                               return res.jsendClientError("Product name already in use.", {name : newProduct.name}, httpStatus.CONFLICT);  // HTTP 409 Conflict
                                            }

                                            var message = "Error while trying to create product [" + newProduct.name + "]";
                                            log.error(message + ": " + err);
                                            return res.jsendServerError(message);
                                         }

                                         log.debug("Created new product [" + result.name + "] with id [" + result.insertId + "] ");

                                         res.jsendSuccess({
                                                             name : result.name
                                                          }, httpStatus.CREATED); // HTTP 201 Created
                                      });
               });

   // get details for a specific product
   router.get('/:productNameOrId',
              function(req, res, next) {
                 var productNameOrId = req.params.productNameOrId;
                 log.debug("Received GET for product [" + productNameOrId + "]");

                 findProductByNameOrId(res, productNameOrId, req.query.fields, function(product) {
                    // inflate the channel specs JSON text into an object
                    if ('defaultChannelSpecs' in product) {
                       product.defaultChannelSpecs = JSON.parse(product.defaultChannelSpecs);
                    }
                    return res.jsendSuccess(product); // HTTP 200 OK
                 });
              });

   // get all devices for the given product owned by the authenticated user (TODO: do we need this method?)
   router.get('/:productNameOrId/devices',
              passport.authenticate('bearer', { session : false }),
              function(req, res, next) {
                 var productNameOrId = req.params.productNameOrId;
                 log.debug("Received GET to list all devices for product [" + productNameOrId + "] owned by user [" + req.user.id + "]");

                 findProductByNameOrId(res, productNameOrId, ['id'], function(product) {
                    log.debug("Found product [" + productNameOrId + "], will now find matching devices for this user...");
                    DeviceModel.findByProductIdForUser(product.id, req.user.id, function(err, devices) {
                       if (err) {
                          var message = "Error while trying to find devices with product ID [" + product.id + "] for user [" + req.user.id + "]";
                          log.error(message + ": " + err);
                          return res.jsendServerError(message);
                       }

                       return res.jsendSuccess(devices, httpStatus.OK); // HTTP 200 OK
                    });
                 });
              });

   // create a new device
   router.post('/:productNameOrId/devices',
               passport.authenticate('bearer', { session : false }),
               function(req, res, next) {
                  var productNameOrId = req.params.productNameOrId;
                  log.debug("Received POST to create a new device for product [" + productNameOrId + "]");

                  findProductByNameOrId(res, productNameOrId, ['id'], function(product) {
                     log.debug("Found product [" + productNameOrId + "], will now create the device...");
                     var newDevice = req.body;
                     DeviceModel.create(newDevice, product.id, req.user.id, function(err, result) {
                        if (err) {
                           if (err instanceof ValidationError) {
                              return res.jsendClientValidationError("Validation failure", err.data);   // HTTP 422 Unprocessable Entity
                           }
                           if (err instanceof DuplicateRecordError) {
                              log.debug("Serial number [" + newDevice.serialNumber + "] for product [" + productNameOrId + "] already in use!");
                              return res.jsendClientError("Serial number already in use.", {serialNumber : newDevice.serialNumber}, httpStatus.CONFLICT);  // HTTP 409 Conflict
                           }

                           var message = "Error while trying to create device [" + newDevice.serialNumber + "]";
                           log.error(message + ": " + err);
                           return res.jsendServerError(message);
                        }

                        log.debug("Created new device [" + result.serialNumber + "] with id [" + result.insertId + "] ");

                        return res.jsendSuccess({
                                                   id : result.insertId,
                                                   serialNumber : result.serialNumber
                                                }, httpStatus.CREATED); // HTTP 201 Created
                     });
                  });
               });

   // get info for a specific device (requires auth)
   router.get('/:productNameOrId/devices/:serialNumber',
              passport.authenticate('bearer', { session : false }),
              function(req, res, next) {
                 var productNameOrId = req.params.productNameOrId;
                 var serialNumber = req.params.serialNumber;
                 log.debug("Received GET for product [" + productNameOrId + "] and device [" + serialNumber + "]");

                 findProductByNameOrId(res, productNameOrId, ['id'], function(product) {

                    // we know the product is valid, so now look for matching devices
                    DeviceModel.findByProductIdAndSerialNumberForUser(product.id, serialNumber, req.user.id, function(err, device) {
                       if (err) {
                          var message = "Error while trying to find device with serial number [" + serialNumber + "] for product [" + productNameOrId + "]";
                          log.error(message + ": " + err);
                          return res.jsendServerError(message);
                       }

                       if (device) {
                          return res.jsendSuccess(device); // HTTP 200 OK
                       }
                       else {
                          return res.jsendClientError("Unknown or invalid device serial number", null, httpStatus.NOT_FOUND); // HTTP 404 Not Found
                       }
                    });
                 });
              });

   var findProductByNameOrId = function(res, productNameOrId, fieldsToSelect, successCallback) {
      var isId = S(productNameOrId).isNumeric();
      var methodName = isId ? "findById" : "findByName";
      var fieldName = isId ? "ID" : "name";

      ProductModel[methodName](productNameOrId, fieldsToSelect, function(err1, product) {
         if (err1) {
            var message = "Error while trying to find product with " + fieldName + " [" + productNameOrId + "]";
            log.error(message + ": " + err1);
            return res.jsendServerError(message);
         }

         // call the successCallback if we found the product, otherwise return a 404
         if (product) {
            return successCallback(product);
         }
         else {
            return res.jsendClientError("Unknown or invalid product " + fieldName, null, httpStatus.NOT_FOUND); // HTTP 404 Not Found
         }
      });
   };

   return router;
};

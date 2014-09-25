var express = require('express');
var router = express.Router();
var passport = require('passport');
var ValidationError = require('../../lib/errors').ValidationError;
var DuplicateRecordError = require('../../lib/errors').DuplicateRecordError;
var httpStatus = require('http-status');
var log = require('log4js').getLogger();

module.exports = function(ProductModel, DeviceModel) {

   // TODO: add a method to get all products

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
                                               return res.jsendClientError("Validation failure", err.data, httpStatus.UNPROCESSABLE_ENTITY);   // HTTP 422 Unprocessable Entity
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
   router.get('/:productName',
              function(req, res, next) {
                 var productName = req.params.productName;
                 log.debug("Received GET for product [" + productName + "]");

                 findProductByName(res, productName, function(product) {
                    // inflate the channel spec JSON text into an object
                    product.defaultChannelSpec = JSON.parse(product.defaultChannelSpec);
                    return res.jsendSuccess(product); // HTTP 200 OK
                 });
              });

   // get all devices for the given product owned by the authenticated user
   router.get('/:productName/devices',
              passport.authenticate('bearer', { session : false }),
              function(req, res, next) {
                 var productName = req.params.productName;
                 log.debug("Received GET to list all devices for product [" + productName + "] owned by user [" + req.user.id + "]");

                 findProductByName(res, productName, function(product) {
                    log.debug("Found product [" + productName + "], will now find matching devices for this user...");
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
   router.post('/:productName/devices',
               passport.authenticate('bearer', { session : false }),
               function(req, res, next) {
                  var productName = req.params.productName;
                  log.debug("Received POST to create a new device for product [" + productName + "]");

                  findProductByName(res, productName, function(product) {
                     log.debug("Found product [" + productName + "], will now create the device...");
                     var newDevice = req.body;
                     DeviceModel.create(newDevice, product.id, req.user.id, function(err, result) {
                        if (err) {
                           if (err instanceof ValidationError) {
                              return res.jsendClientError("Validation failure", err.data, httpStatus.UNPROCESSABLE_ENTITY);   // HTTP 422 Unprocessable Entity
                           }
                           if (err instanceof DuplicateRecordError) {
                              log.debug("Serial number [" + newDevice.serialNumber + "] for product [" + productName + "] already in use!");
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
   router.get('/:productName/devices/:serialNumber',
              passport.authenticate('bearer', { session : false }),
              function(req, res, next) {
                 var productName = req.params.productName;
                 var serialNumber = req.params.serialNumber;
                 log.debug("Received GET for product [" + productName + "] and device [" + serialNumber + "]");

                 findProductByName(res, productName, function(product) {

                    // we know the product is valid, so now look for matching devices
                    DeviceModel.findByProductIdAndSerialNumberForUser(product.id, serialNumber, req.user.id, function(err, device) {
                       if (err) {
                          var message = "Error while trying to find device with serial number [" + serialNumber + "] for product [" + productName + "]";
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

   var findProductByName = function(res, productName, successCallback) {
      ProductModel.findByName(productName, function(err1, product) {
         if (err1) {
            var message = "Error while trying to find product with name [" + productName + "]";
            log.error(message + ": " + err1);
            return res.jsendServerError(message);
         }

         // call the successCallback if we found the product, otherwise return a 404
         if (product) {
            return successCallback(product);
         }
         else {
            return res.jsendClientError("Unknown or invalid product name", null, httpStatus.NOT_FOUND); // HTTP 404 Not Found
         }
      });
   };

   return router;
};

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

                 ProductModel.findByName(productName, function(err1, product) {
                    if (err1) {
                       var message = "Error while trying to find product with name [" + productName + "]";
                       log.error(message + ": " + err1);
                       return res.jsendServerError(message);
                    }

                    if (product) {
                       var inflateAndReturnProduct = function() {
                          // inflate the JSON text into an object
                          product.defaultChannelSpec = JSON.parse(product.defaultChannelSpec);
                          return res.jsendSuccess(product); // HTTP 200 OK
                       };

                       // if the product is private, then make sure this user has access
                       if (!product.isPublic) {
                          // first, do the bearer token authentication
                          passport.authenticate('bearer',
                                                { session : false },
                                                function(err2, user, info) {
                                                   if (err2) {
                                                      var message = "Error while trying to find authenticate user to determine access to product [" + productName + "]";
                                                      log.error(message + ": " + err2);
                                                      return res.jsendServerError(message);
                                                   }

                                                   if (user) {
                                                      if (user.id == product.creatorUserId) {
                                                         return inflateAndReturnProduct();
                                                      }
                                                      else {
                                                         return res.jsendClientError("Access denied.", null, httpStatus.FORBIDDEN);  // HTTP 403 Forbidden
                                                      }
                                                   }
                                                   return res.jsendClientError("Authentication required.", null, httpStatus.UNAUTHORIZED);  // HTTP 401 Unauthorized

                                                })(req, res, next);
                       }
                       else {
                          return inflateAndReturnProduct();
                       }
                    }
                    else {
                       return res.jsendClientError("Unknown or invalid product name", null, httpStatus.NOT_FOUND); // HTTP 404 Not Found
                    }
                 });
              });

   // TODO: create methods to:
   // 1) list all devices
   // 2) find devices for a given product
   // 3) return info for a particular device

   // create a new device
   router.post('/:productName/devices',
               passport.authenticate('bearer', { session : false }),
               function(req, res, next) {
                  var productName = req.params.productName;
                  log.debug("Received POST to create a new device for product [" + productName + "]");

                  // find the product
                  ProductModel.findByName(productName, function(err1, product) {
                     if (err1) {
                        var message = "Error while trying to find product with name [" + productName + "]";
                        log.error(message + ": " + err1);
                        return res.jsendServerError(message);
                     }

                     if (product) {
                        // if the product is private, then make sure this user has access
                        if (product.isPublic || req.user.id == product.creatorUserId) {
                           log.debug("Found product [" + productName + "], will now create the device...");
                           var newDevice = req.body;
                           DeviceModel.create(newDevice, product.id, req.user.id, function(err2, result) {
                              if (err2) {
                                 if (err2 instanceof ValidationError) {
                                    return res.jsendClientError("Validation failure", err2.data, httpStatus.UNPROCESSABLE_ENTITY);   // HTTP 422 Unprocessable Entity
                                 }
                                 if (err2 instanceof DuplicateRecordError) {
                                    log.debug("Serial number [" + newDevice.serialNumber + "] for product [" + productName + "] already in use!");
                                    return res.jsendClientError("Serial number already in use.", {serialNumber : newDevice.serialNumber}, httpStatus.CONFLICT);  // HTTP 409 Conflict
                                 }

                                 var message = "Error while trying to create device [" + newDevice.serialNumber + "]";
                                 log.error(message + ": " + err2);
                                 return res.jsendServerError(message);
                              }

                              log.debug("Created new device [" + result.serialNumber + "] with id [" + result.insertId + "] ");

                              return res.jsendSuccess({
                                                  id : result.insertId,
                                                  serialNumber : result.serialNumber
                                               }, httpStatus.CREATED); // HTTP 201 Created
                           });
                        }
                        else {
                           return res.jsendClientError("Access denied.", null, httpStatus.FORBIDDEN);  // HTTP 403 Forbidden
                        }
                     }
                     else {
                        return res.jsendClientError("Unknown or invalid product name", null, httpStatus.NOT_FOUND); // HTTP 404 Not Found
                     }
                  });
               });

   return router;
};

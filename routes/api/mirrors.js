const express = require('express');
const router = express.Router();
const passport = require('passport');
const httpStatus = require('http-status');
const log = require('log4js').getLogger('esdr:routes:api:mirror-registrations');
const JSendError = require('jsend-utils').JSendError;
const ValidationError = require('../../lib/errors').ValidationError;
const DuplicateRecordError = require('../../lib/errors').DuplicateRecordError;

module.exports = function(ProductModel, MirrorRegistrationsModel) {

   router.post('/:realm/registrations/products/:productNameOrId',
               passport.authenticate(['basic-username-password', 'bearer'], { session : false }),
               function(req, res, next) {

                  // first try to find the product
                  const productNameOrId = req.params['productNameOrId'];
                  ProductModel.findByNameOrId(productNameOrId, 'id', function(err, product) {
                     if (err) {
                        const message = "Error while trying to find product [" + productNameOrId + "]";
                        log.error(message + ": " + err);
                        return res.jsendServerError(message);
                     }

                     // continue if we found the product, otherwise return a 404
                     if (product) {
                        const user = req.user;
                        const realm = req.params['realm'];

                        MirrorRegistrationsModel.createForProduct(realm, user.id, product.id, function(err, result) {
                           if (err) {
                              if (err instanceof JSendError) {
                                 return res.jsendPassThrough(err.data);
                              }
                              else {
                                 if (err instanceof ValidationError) {
                                    return res.jsendClientValidationError("Validation failure", err.data);   // HTTP 422 Unprocessable Entity
                                 }
                                 if (err instanceof DuplicateRecordError) {
                                    log.debug("Mirror registration for realm [" + realm + "], user [" + user.id + "], and product [" + product.id + "] already exists!");
                                    return res.jsendClientError("Mirror registration already exists.",
                                                                {
                                                                   realm : realm,
                                                                   userId : user.id,
                                                                   productId : product.id
                                                                },
                                                                httpStatus.CONFLICT);  // HTTP 409 Conflict
                                 }

                                 const message = "Error while trying to create mirror registration for realm [" + realm + "], user [" + user.id + "], and product [" + product.id + "]";
                                 log.error(message + ": " + err);
                                 return res.jsendServerError(message);
                              }
                           }

                           return res.jsendSuccess({ mirrorToken : result.mirrorToken }, httpStatus.CREATED); // HTTP 201 Created
                        });
                     }
                     else {
                        return res.jsendClientError("Unknown or invalid product", null, httpStatus.NOT_FOUND); // HTTP 404 Not Found
                     }
                  });
               });

   router.get('/:realm/registrations/products/:productNameOrId',
              passport.authenticate(['basic-username-password', 'bearer'], { session : false }),
              function(req, res, next) {

                 // first try to find the product
                 const productNameOrId = req.params['productNameOrId'];
                 ProductModel.findByNameOrId(productNameOrId, 'id', function(err, product) {
                    if (err) {
                       const message = "Error while trying to find product [" + productNameOrId + "]";
                       log.error(message + ": " + err);
                       return res.jsendServerError(message);
                    }

                    // continue if we found the product, otherwise return a 404
                    if (product) {
                       const user = req.user;
                       const realm = req.params['realm'];
                       MirrorRegistrationsModel.findByRealmUserAndProduct(realm, user.id, product.id, function(err, mirrorRegistration) {
                          if (err) {
                             if (err instanceof ValidationError) {
                                return res.jsendClientValidationError(err.message || "Validation failure", err.data);   // HTTP 422 Unprocessable Entity
                             }
                             if (err instanceof JSendError) {
                                return res.jsendPassThrough(err.data);
                             }

                             const message = "Error while trying to find mirror registration for realm [" + realm + "], user [" + user.id + "], and product [" + product.id + "]";
                             log.error(message + ": " + err);
                             return res.jsendServerError(message);
                          }

                          if (mirrorRegistration) {
                             // we found it, so now filter the fields to return based on fields specified in the query string (if any)
                             MirrorRegistrationsModel.filterFields(mirrorRegistration, req.query.fields, function(err, filteredMirrorRegistration) {
                                if (err) {
                                   return res.jsendServerError("Failed to find mirror registration: " + err.message, null);
                                }
                                return res.jsendSuccess(filteredMirrorRegistration, httpStatus.OK); // HTTP 200 OK
                             });
                          }
                          else {
                             return res.jsendClientError("Unknown or invalid mirror registration", null, httpStatus.NOT_FOUND); // HTTP 404 Not Found
                          }
                       });
                    }
                    else {
                       return res.jsendClientError("Unknown or invalid product", null, httpStatus.NOT_FOUND); // HTTP 404 Not Found
                    }
                 });
              });

   router.get('/:realm/registrations/:mirrorToken',
              function(req, res, next) {
                 const realm = req.params['realm'];
                 const mirrorToken = req.params['mirrorToken'];

                 MirrorRegistrationsModel.findByRealmAndMirrorToken(realm, mirrorToken, function(err, mirrorRegistration) {
                    if (err) {
                       if (err instanceof ValidationError) {
                          return res.jsendClientValidationError(err.message || "Validation failure", err.data);   // HTTP 422 Unprocessable Entity
                       }
                       if (err instanceof JSendError) {
                          return res.jsendPassThrough(err.data);
                       }

                       const message = "Error while trying to find mirror registration for realm [" + realm + "], mirror token [" + mirrorToken + "]";
                       log.error(message + ": " + err);
                       return res.jsendServerError(message);
                    }

                    if (mirrorRegistration) {
                       // we found it, so now filter the fields to return based on fields specified in the query string (if any)
                       MirrorRegistrationsModel.filterFields(mirrorRegistration, req.query.fields, function(err, filteredMirrorRegistration) {
                          if (err) {
                             return res.jsendServerError("Failed to find mirror registration: " + err.message, null);
                          }
                          return res.jsendSuccess(filteredMirrorRegistration, httpStatus.OK); // HTTP 200 OK
                       });
                    }
                    else {
                       return res.jsendClientError("Unknown or invalid mirror registration", null, httpStatus.NOT_FOUND); // HTTP 404 Not Found
                    }
                 });
              }
   );

   router.delete('/:realm/registrations/:mirrorToken',
                 function(req, res, next) {
                    const realm = req.params['realm'];
                    const mirrorToken = req.params['mirrorToken'];

                    MirrorRegistrationsModel.deleteRegistration(realm, mirrorToken, function(err, deleteResult) {
                       if (err) {
                          if (err instanceof ValidationError) {
                             return res.jsendClientValidationError(err.message || "Validation failure", err.data);   // HTTP 422 Unprocessable Entity
                          }
                          if (typeof err.data !== 'undefined' &&
                              typeof err.data.code !== 'undefined' &&
                              typeof err.data.status !== 'undefined') {
                             return res.jsendPassThrough(err.data);
                          }

                          const message = "Error while deleting mirror registration for realm [" + realm + "] with mirror token [" + mirrorToken + "]";
                          log.error(message + ": " + err);
                          return res.jsendServerError(message);
                       }

                       return res.jsendSuccess(deleteResult); // HTTP 200 OK
                    });
                 }
   );

   return router;
};
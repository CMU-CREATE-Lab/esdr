var express = require('express');
var router = express.Router();
var passport = require('passport');
var ValidationError = require('../../lib/errors').ValidationError;
var DuplicateRecordError = require('../../lib/errors').DuplicateRecordError;
var httpStatus = require('http-status');
var log = require('log4js').getLogger('esdr:routes:api:multifeeds');

module.exports = function(FeedModel, MultifeedModel) {

   // Find multifeeds
   router.get('/',
              function(req, res, next) {

                 MultifeedModel.find(req.query, function(err, result, selectedFields) {
                    if (err) {
                       log.error(JSON.stringify(err, null, 3));
                       // See if the error contains a JSend data object.  If so, pass it on through.
                       if (typeof err.data !== 'undefined' &&
                           typeof err.data.code !== 'undefined' &&
                           typeof err.data.status !== 'undefined') {
                          return res.jsendPassThrough(err.data);
                       }
                       return res.jsendServerError("Failed to get multifeeds", null);
                    }

                    // inflate the spec, if selected
                    if ((selectedFields.indexOf('spec') >= 0)) {
                       result.rows.forEach(function(multifeed) {
                          multifeed.spec = JSON.parse(multifeed.spec);
                       });
                    }
                    // inflate the querySpec, if selected
                    if ((selectedFields.indexOf('querySpec') >= 0)) {
                       result.rows.forEach(function(multifeed) {
                          multifeed.querySpec = JSON.parse(multifeed.querySpec);
                       });
                    }

                    return res.jsendSuccess(result);

                 });
              });

   // Creates a new multifeed
   router.post('/',
               passport.authenticate('bearer', { session : false }),
               function(req, res, next) {
                  var multifeed = req.body;
                  MultifeedModel.create(multifeed, req.user.id, function(err, result) {
                     if (err) {
                        if (err instanceof ValidationError) {
                           return res.jsendClientValidationError(err.message || "Validation failure", err.data);   // HTTP 422 Unprocessable Entity
                        }
                        if (err instanceof DuplicateRecordError) {
                           log.debug("Multifeed name [" + multifeed.name + "] already in use!");
                           return res.jsendClientError("Multifeed name already in use.", { name : multifeed.name }, httpStatus.CONFLICT);  // HTTP 409 Conflict
                        }
                        if (typeof err.data !== 'undefined' &&
                            typeof err.data.code !== 'undefined' &&
                            typeof err.data.status !== 'undefined') {
                           return res.jsendPassThrough(err.data);
                        }

                        var message = "Error while trying to create multifeed [" + multifeed.name + "]";
                        log.error(message + ": " + err);
                        return res.jsendServerError(message);
                     }

                     log.debug("Created new multifeed [" + multifeed.name + "] for user [" + req.user.id + "] with id [" + result.insertId + "]");

                     return res.jsendSuccess({
                                                id : result.insertId,
                                                name : result.name
                                             }, httpStatus.CREATED); // HTTP 201 Created
                  });
               });

   // Returns info about the specified multifeed
   router.get('/:multifeedNameOrId',
              function(req, res, next) {
                 var multifeedNameOrId = req.params.multifeedNameOrId;
                 log.debug("Received GET for multifeed [" + multifeedNameOrId + "]");

                 findMultifeedByNameOrId(res, multifeedNameOrId, req.query.fields, function(multifeed) {
                    // inflate the channel specs JSON text into an object
                    if ('spec' in multifeed) {
                       multifeed.spec = JSON.parse(multifeed.spec);
                    }
                    if ('querySpec' in multifeed) {
                       multifeed.querySpec = JSON.parse(multifeed.querySpec);
                    }
                    return res.jsendSuccess(multifeed); // HTTP 200 OK
                 });
              }
   );

   // Returns the feeds included in the specified multifeed set. Returned feed fields can (and should!) be filtered with
   // the fields query string param. The various where clause query string params are ignored, but results can be sorted
   // with orderBy and/or windowed with limit and offset.
   router.get('/:multifeedNameOrId/feeds',
              function(req, res, next) {
                 var multifeedNameOrId = req.params.multifeedNameOrId;
                 log.debug("Received GET for feeds contained in multifeed [" + multifeedNameOrId + "]");

                 findMultifeedByNameOrId(res, multifeedNameOrId, 'querySpec', function(multifeed) {
                    // inflate the querySpec
                    multifeed.querySpec = JSON.parse(multifeed.querySpec);

                    // build the WHERE clause for the query
                    var whereParts = [];
                    var values = [];
                    multifeed.querySpec.forEach(function(specItem) {
                       whereParts.push("(" + specItem.feeds.where + ")");
                       values = values.concat(specItem.feeds.values);
                    });
                    var sqlWhere = {
                       where : "((isPublic=1) AND (" + whereParts.join(' OR ') + "))",
                       values : values
                    };

                    FeedModel.findBySqlWhere(sqlWhere,
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

                                                var willInflateChannelSpecs = (selectedFields.indexOf('channelSpecs') >= 0);
                                                var willInflateChannelBounds = (selectedFields.indexOf('channelBounds') >= 0);

                                                if (willInflateChannelSpecs || willInflateChannelBounds) {
                                                   result.rows.forEach(function(feed) {
                                                      if (willInflateChannelSpecs) {
                                                         feed.channelSpecs = JSON.parse(feed.channelSpecs);
                                                      }
                                                      if (willInflateChannelBounds) {
                                                         feed.channelBounds = JSON.parse(feed.channelBounds);
                                                      }
                                                   });
                                                }

                                                return res.jsendSuccess(result);
                                             });
                 });
              }
   );

   var findMultifeedByNameOrId = function(res, multifeedNameOrId, fieldsToSelect, successCallback) {
      MultifeedModel.findByNameOrId(multifeedNameOrId, fieldsToSelect, function(err, multifeed) {
         if (err) {
            var message = "Error while trying to find multifeed [" + multifeedNameOrId + "]";
            log.error(message + ": " + err);
            return res.jsendServerError(message);
         }

         // call the successCallback if we found the multifeed, otherwise return a 404
         if (multifeed) {
            return successCallback(multifeed);
         }
         else {
            return res.jsendClientError("Unknown or invalid multifeed", null, httpStatus.NOT_FOUND); // HTTP 404 Not Found
         }
      });
   };

   return router;

};

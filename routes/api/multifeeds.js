const express = require('express');
const router = express.Router();
const passport = require('passport');
const ValidationError = require('../../lib/errors').ValidationError;
const DuplicateRecordError = require('../../lib/errors').DuplicateRecordError;
const httpStatus = require('http-status');
const flow = require('nimble');
const log = require('log4js').getLogger('esdr:routes:api:multifeeds');

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
                  const multifeed = req.body;
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

                        const message = "Error while trying to create multifeed [" + multifeed.name + "]";
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
                 const multifeedNameOrId = req.params.multifeedNameOrId;
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

   // Returns the multi-tile for the specified multifeed at the specified level and offset
   router.get('/:multifeedNameOrId/tiles/:level.:offset',
              function(req, res, next) {
                 const multifeedNameOrId = req.params.multifeedNameOrId;
                 const level = req.params.level;
                 const offset = req.params.offset;
                 log.debug("Received GET for tiles at level.offset [" + level + "." + offset + "] for multifeed [" + multifeedNameOrId + "]");

                 findMultifeedByNameOrId(res, multifeedNameOrId, 'querySpec', function(multifeed) {
                    // inflate the querySpec
                    multifeed.querySpec = JSON.parse(multifeed.querySpec);

                    // build functions to find the feeds described by each item in the querySpec.  We'll execute them
                    // in parallel, combining the results which we'll then use to build the call to the datastore.
                    const queryFunctions = [];
                    const feedsAndChannels = [];
                    const errors = [];
                    multifeed.querySpec.forEach(function(specItem) {
                       queryFunctions.push(
                             function(done) {
                                const sqlWhere = {
                                   where : "((isPublic=1) AND (" + specItem.feeds.where + "))",
                                   values : specItem.feeds.values
                                };

                                FeedModel.findBySqlWhere(sqlWhere,
                                                         {
                                                            fields : ['id', 'userId'],
                                                            orderBy : ['id']
                                                         },
                                                         false,   // false here to ensure the SQL doesn't include a LIMIT clause
                                                         function(err, feeds) {
                                                            if (err) {
                                                               log.error(JSON.stringify(err, null, 3));
                                                               errors.push(err);
                                                            }
                                                            else {
                                                               if (feeds && feeds.length > 0) {
                                                                  feedsAndChannels.push({
                                                                                           feeds : feeds,
                                                                                           channels : specItem.channels
                                                                                        });
                                                               }
                                                            }
                                                            done();
                                                         });
                             });
                    });

                    flow.parallel(queryFunctions,
                                  function() {
                                     if (errors.length > 0) {
                                        // just report the first error
                                        const err = errors[0];

                                        // See if the error contains a JSend data object.  If so, pass it on through.
                                        if (typeof err.data !== 'undefined' &&
                                            typeof err.data.code !== 'undefined' &&
                                            typeof err.data.status !== 'undefined') {
                                           return res.jsendPassThrough(err.data);
                                        }
                                        return res.jsendServerError("Failed to get feeds", null);
                                     }
                                     else {
                                        FeedModel.getTiles(feedsAndChannels, level, offset, function(err, eventEmitter) {
                                           if (err) {
                                              if (err.data && err.data.code === httpStatus.UNPROCESSABLE_ENTITY) {
                                                 return res.jsendPassThrough(err.data)
                                              }

                                              log.error("Failed to get tiles for multifeed: " + JSON.stringify(err, null, 3));
                                              return res.jsendServerError("Failed to get tiles for multifeed", null);
                                           }

                                           // set the status code and set the connection to close
                                           res
                                                 .status(httpStatus.OK)
                                                 .set("Content-Type", "application/json")
                                                 .set("Connection", "close");

                                           // I don't really understand why, but we must have a function (even an empty
                                           // one!) listening on stderr, or else sometimes I get no data on stdout.
                                           eventEmitter.stderr.on('data', function(data) {
                                              // log.error(data);
                                           });

                                           eventEmitter.on('error', function(e) {
                                              log.error("Error event from EventEmitter while getting tiles: " + JSON.stringify(e, null, 3));
                                           });

                                           // pipe the eventEmitter to the response
                                           return eventEmitter.stdout.pipe(res);
                                        });
                                     }
                                  });
                 });
              }
   );

   // Returns the feeds included in the specified multifeed set. Returned feed fields can (and should!) be filtered with
   // the fields query string param. The various where clause query string params are ignored, but results can be sorted
   // with orderBy and/or windowed with limit and offset.
   router.get('/:multifeedNameOrId/feeds',
              function(req, res, next) {
                 const multifeedNameOrId = req.params.multifeedNameOrId;
                 log.debug("Received GET for feeds contained in multifeed [" + multifeedNameOrId + "]");

                 findMultifeedByNameOrId(res, multifeedNameOrId, 'querySpec', function(multifeed) {
                    // inflate the querySpec
                    multifeed.querySpec = JSON.parse(multifeed.querySpec);

                    // build the WHERE clause for the query
                    const whereParts = [];
                    let values = [];
                    multifeed.querySpec.forEach(function(specItem) {
                       whereParts.push("(" + specItem.feeds.where + ")");
                       values = values.concat(specItem.feeds.values);
                    });
                    const sqlWhere = {
                       where : "((isPublic=1) AND (" + whereParts.join(' OR ') + "))",
                       values : values
                    };

                    FeedModel.findBySqlWhere(sqlWhere,
                                             req.query,
                                             true, // true here so that results are windowed with limit/offset
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

                                                const willInflateChannelSpecs = (selectedFields.indexOf('channelSpecs') >= 0);
                                                const willInflateChannelBounds = (selectedFields.indexOf('channelBounds') >= 0);

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

   const findMultifeedByNameOrId = function(res, multifeedNameOrId, fieldsToSelect, successCallback) {
      MultifeedModel.findByNameOrId(multifeedNameOrId, fieldsToSelect, function(err, multifeed) {
         if (err) {
            const message = "Error while trying to find multifeed [" + multifeedNameOrId + "]";
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

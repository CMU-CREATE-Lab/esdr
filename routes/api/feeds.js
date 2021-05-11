const express = require('express');
const router = express.Router();
const passport = require('passport');
const httpStatus = require('http-status');
const log = require('log4js').getLogger('esdr:routes:api:feeds');
const JSendError = require('jsend-utils').JSendError;
const ValidationError = require('../../lib/errors').ValidationError;
const isPositiveIntString = require('../../lib/typeUtils').isPositiveIntString;
const isString = require('data-type-utils').isString;
const isNonEmptyString = require('data-type-utils').isNonEmptyString;
const isFeedApiKey = require('../../lib/typeUtils').isFeedApiKey;

/** @type {Readonly<{CSV: {format: string, contentType: string}, JSON: {format: string, contentType: string}}>} */
const OutputFormat = Object.freeze({
                                      CSV : { format : 'csv', contentType : 'text/plain' },
                                      JSON : { format : 'json', contentType : 'application/json' }
                                   });

const CSV_FIELD_DELIMITER = ',';
const CSV_RECORD_DELIMITER = '\n';
const CSV_DATE_FIELD_NAMES = ['created', 'modified', 'lastUpload'];

function convertFeedDateFieldToIsoDateString(feed, dateFieldName) {
   if (dateFieldName in feed) {
      if (typeof feed[dateFieldName] !== 'undefined' && feed[dateFieldName] !== null) {
         if (feed[dateFieldName] !== '0000-00-00 00:00:00') {
            feed[dateFieldName] = feed[dateFieldName].toISOString();
         }
      }
      else {
         feed[dateFieldName] = '';
      }
   }
}

module.exports = function(FeedModel, FeedPropertiesModel, feedRouteHelper) {

   // for searching for feeds, optionally matching specified criteria and sort order
   router.get('/',
              function(req, res, next) {
                 passport.authenticate('bearer', function(err, user, info) {
                    if (err) {
                       const message = "Error while authenticating to find feeds";
                       log.error(message + ": " + err);
                       return res.jsendServerError(message);
                    }

                    FeedModel.find(user ? user.id : null,
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

                                      const outputFormat = parseOutputFormat(req, OutputFormat.JSON.format);

                                      if (outputFormat === null) {
                                         res.set("Content-Type", "application/json");
                                         return res.jsendClientError("Invalid format, must be one of 'csv' or 'json'.", { format : req.query.format }, httpStatus.UNPROCESSABLE_ENTITY);  // HTTP 422 UNPROCESSABLE_ENTITY
                                      }

                                      res.set("Content-Type", outputFormat.contentType);

                                      if (outputFormat === OutputFormat.CSV) {
                                         // Build up a map of fields to return, filtering out any disallowed ones, and
                                         // also create an array containing field names for the headers.  We don't allow
                                         // JSON fields when requesting CSV because if you know how to deal with JSON,
                                         // you'd just request JSON. Plus, I don't want to deal with commas.
                                         const fieldsToReturn = {};
                                         const headerFields = [];
                                         selectedFields
                                               .filter(f => f !== 'channelSpecs')
                                               .filter(f => f !== 'channelBounds')
                                               .forEach(f => {
                                                           headerFields.push(f);
                                                           fieldsToReturn[f] = true;
                                                        }
                                               );

                                         // fix names, if requested, to deal with stupid commas
                                         if ('name' in fieldsToReturn) {
                                            // If the feed name was requested, and includes a comma, then
                                            // surround it with quotes.  TODO: the name might include
                                            // quotes, too, in which case I need to change all quotes
                                            // within in name to "".  Ugh.
                                            result.rows.forEach(function(feed) {
                                               if (feed['name'].indexOf(CSV_FIELD_DELIMITER) >= 0) {
                                                  feed['name'] = '"' + feed['name'] + '"';
                                               }
                                            });
                                         }

                                         // use ISO format for dates, if any dates were requested
                                         CSV_DATE_FIELD_NAMES.forEach(dateFieldName => {
                                            if (dateFieldName in fieldsToReturn) {
                                               result.rows.forEach(function(feed) {
                                                  convertFeedDateFieldToIsoDateString(feed, dateFieldName);
                                               });
                                            }
                                         });

                                         // create the CSV
                                         let csv = headerFields.join(CSV_FIELD_DELIMITER) + CSV_RECORD_DELIMITER;
                                         csv += result.rows
                                                      .map(row => headerFields.map(field => row[field]).join(CSV_FIELD_DELIMITER))
                                                      .join(CSV_RECORD_DELIMITER)
                                                + CSV_RECORD_DELIMITER;

                                         return res
                                               .set("Connection", "close")
                                               .status(httpStatus.OK)
                                               .send(csv);
                                      }
                                      else {
                                         // inflate all the channelSpecs fields, if it's a requested field
                                         if ((selectedFields.indexOf('channelSpecs') >= 0)) {
                                            result.rows.forEach(function(feed) {
                                               feed.channelSpecs = JSON.parse(feed.channelSpecs);
                                            });
                                         }

                                         // inflate all the channelBounds fields, if it's a requested field
                                         if ((selectedFields.indexOf('channelBounds') >= 0)) {
                                            result.rows.forEach(function(feed) {
                                               feed.channelBounds = JSON.parse(feed.channelBounds);
                                            });
                                         }

                                         return res.jsendSuccess(result); // HTTP 200 OK
                                      }
                                   });
                 })(req, res, next);
              });

   // For uploads authenticated using the user's OAuth2 access token or the feed's read-write API key in the URL or request header
   //
   // NOTE: authenticating with the OAuth2 access token will be slower than authenticating with the feed's apiKey
   // because we have to make an extra call to the database to authenticate the user so we can determine whether she has
   // access.
   router.put('/:feedIdOrApiKey',
              function(req, res, next) {
                 getFeedForWritingByIdOrApiKey(req.params.feedIdOrApiKey,
                                               'id,userId,apiKey',
                                               function(feed) {
                                                  return feedRouteHelper.importData(res, feed, req.body);
                                               },
                                               req, res, next);
              });

   // For getting info about a feed, optionally authenticated using the user's OAuth2 access token or the feed's
   // read-write or read-only API key in the URL or request header.
   //
   // NOTE: for a private feed or when requesting the API Key from a public feed, authenticating with the OAuth2 access
   // token will be slower than authenticating with the feed's apiKey because we have to make an extra call to the
   // database to authenticate the user so we can determine whether she has access.
   router.get('/:feedIdOrApiKey',
              function(req, res, next) {
                 const feedIdOrApiKey = req.params.feedIdOrApiKey;

                 log.debug("Received GET to get info for feed [" + feedIdOrApiKey + "]");
                 getFeedForReadingByIdOrApiKey(feedIdOrApiKey,
                                               null,  // passing null will cause it to select all fields--we'll filter them below
                                               function(feed, authInfo) {
                                                  // we found the feed, so now filter the fields to return based on fields
                                                  // specified in the query string (if any)
                                                  FeedModel.filterFields(feed, req.query.fields, function(err, filteredFeed) {
                                                     if (err) {
                                                        return res.jsendServerError("Failed to get feed: " + err.message, null);
                                                     }

                                                     const getInfo = function(isAllowedToSelectReadWriteFeedApiKey) {
                                                        const outputFormat = parseOutputFormat(req, OutputFormat.JSON.format);

                                                        if (outputFormat === null) {
                                                           res.set("Content-Type", "application/json");
                                                           return res.jsendClientError("Invalid format, must be one of 'csv' or 'json'.", { format : req.query.format }, httpStatus.UNPROCESSABLE_ENTITY);  // HTTP 422 UNPROCESSABLE_ENTITY
                                                        }

                                                        // delete the read-write feed API key if not allowed to see it
                                                        if (!isAllowedToSelectReadWriteFeedApiKey) {
                                                           delete filteredFeed.apiKey;
                                                        }

                                                        res.set("Content-Type", outputFormat.contentType);

                                                        if (outputFormat === OutputFormat.CSV) {
                                                           // Don't allow JSON fields when requesting CSV. Rationale: if
                                                           // you know how to deal with JSON, you'd just request JSON.
                                                           // Plus, I don't want to deal with commas.
                                                           delete filteredFeed.channelSpecs;
                                                           delete filteredFeed.channelBounds;

                                                           // use ISO format for dates, if any dates were requested
                                                           CSV_DATE_FIELD_NAMES.forEach(fieldName => {
                                                              convertFeedDateFieldToIsoDateString(filteredFeed, fieldName);
                                                           });

                                                           // If the feed name was requested, and includes a comma, then
                                                           // surround it with quotes.  TODO: the name might include
                                                           // quotes, too, in which case I need to change all quotes
                                                           // within in name to "".  Ugh.
                                                           if ('name' in filteredFeed && filteredFeed['name'].indexOf(CSV_FIELD_DELIMITER) >= 0) {
                                                              filteredFeed['name'] = '"' + filteredFeed['name'] + '"';
                                                           }

                                                           const headerFields = Object.keys(filteredFeed);
                                                           let csv = headerFields.join(CSV_FIELD_DELIMITER) + CSV_RECORD_DELIMITER;
                                                           csv += headerFields.map(field => filteredFeed[field]).join(CSV_FIELD_DELIMITER) + CSV_RECORD_DELIMITER;

                                                           return res
                                                                 .set("Connection", "close")
                                                                 .status(httpStatus.OK)
                                                                 .send(csv);
                                                        }
                                                        else {
                                                           // inflate the JSON fields into objects
                                                           if ("channelSpecs" in filteredFeed) {
                                                              filteredFeed.channelSpecs = JSON.parse(filteredFeed.channelSpecs);
                                                           }

                                                           if ("channelBounds" in filteredFeed) {
                                                              filteredFeed.channelBounds = JSON.parse(filteredFeed.channelBounds);
                                                           }
                                                           return res.jsendSuccess(filteredFeed); // HTTP 200 OK
                                                        }
                                                     };

                                                     // The only way authInfo won't be defined is if the feed is public, and is
                                                     // being accessed by feedId in the URL.
                                                     if (authInfo) {
                                                        return getInfo(authInfo.hasAccessToReadWriteFeedApiKey);
                                                     }
                                                     else {
                                                        // See whether they're even trying to ask for the read-write feed API
                                                        // key.  If so, then we need to auth the user either by feed API key in
                                                        // the request header or OAuth access token in the request header.
                                                        if ("apiKey" in filteredFeed) {
                                                           if ("feedapikey" in req.headers) {
                                                              // If the given feed API key matches the feed's read-write key,
                                                              // then they obviously should be allowed to see it because they
                                                              // already know it!
                                                              const wasGivenReadWriteApiKey = req.headers['feedapikey'] === feed.apiKey;
                                                              return getInfo(wasGivenReadWriteApiKey);
                                                           }
                                                           else {
                                                              // If they sent an OAuth2 Authorization header, then authenticate
                                                              // the user to see whether she owns the feed.  If so, then she
                                                              // should be granted access to see the read-write API key.
                                                              passport.authenticate('bearer', function(err, user) {
                                                                 if (err) {
                                                                    const message = "Error during bearer authentication";
                                                                    log.error(message + ": " + err);
                                                                    return res.jsendServerError(message);
                                                                 }

                                                                 // prevent selection of the read-write API key unless the user
                                                                 // was authenticated successfully, and she owns the feed
                                                                 return getInfo(user && user.id === feed.userId);
                                                              })(req, res, next);
                                                           }
                                                        }
                                                        else {
                                                           // they're not requesting the API key, so just return the filtered feed
                                                           return getInfo(false);
                                                        }
                                                     }
                                                  });
                                               },
                                               req, res, next);
              });

   // delete a feed (MUST be authenticated with OAuth2 access token)
   router.delete('/:feedId',
                 passport.authenticate('bearer', { session : false }),
                 function(req, res, next) {
                    let feedId = req.params.feedId;
                    if (isPositiveIntString(feedId)) {
                       feedId = parseInt(feedId);    // make it an int
                       FeedModel.deleteFeed(feedId,
                                            req.user.id,
                                            function(err, deleteResult) {
                                               if (err) {
                                                  if (err instanceof JSendError) {
                                                     return res.jsendPassThrough(err.data);
                                                  }
                                                  else {
                                                     return res.jsendServerError("Failed to delete feed", { id : feedId });
                                                  }
                                               }
                                               else {
                                                  return res.jsendSuccess(deleteResult);
                                               }
                                            });
                    }
                    else {
                       return res.jsendClientError("Unknown or invalid feed", null, httpStatus.NOT_FOUND); // HTTP 404 Not Found
                    }
                 });

   // Get the most recent data for all channels, optionally authenticated using the user's OAuth2 access token or the
   // feed's read-write or read-only API key in the URL or request header.
   //
   // NOTE: for a private feed, authenticating with the OAuth2 access token will be slower than authenticating with
   // either of the feed's API keys because we have to make an extra call to the database to authenticate the user so we
   // can determine whether she has access.
   router.get('/:feedIdOrApiKey/most-recent',
              function(req, res, next) {
                 getMostRecentDataSamples(req, res, next, req.params.feedIdOrApiKey)
              });

   // Get the most recent data for the specified channel, optionally authenticated using the user's OAuth2 access token or the
   // feed's read-write or read-only API key in the URL or request header.
   //
   // NOTE: for a private feed, authenticating with the OAuth2 access token will be slower than authenticating with
   // either of the feed's API keys because we have to make an extra call to the database to authenticate the user so we
   // can determine whether she has access.
   router.get('/:feedIdOrApiKey/channels/:channelName/most-recent',
              function(req, res, next) {
                 getMostRecentDataSamples(req, res, next, req.params.feedIdOrApiKey, req.params.channelName)
              });

   const getMostRecentDataSamples = function(req, res, next, feedIdOrApiKey, channelName) {
      getFeedForReadingByIdOrApiKey(feedIdOrApiKey,
                                    'id,userId,isPublic,apiKey,apiKeyReadOnly',
                                    function(feed) {
                                       FeedModel.getMostRecent(feed, isString(channelName) ? channelName : null, function(err, mostRecentInfo) {
                                          if (err) {
                                             if (err.data && err.data.code === httpStatus.UNPROCESSABLE_ENTITY) {
                                                return res.jsendPassThrough(err.data);
                                             }
                                             return res.jsendServerError(err.message, null);
                                          }

                                          res.jsendSuccess(mostRecentInfo);
                                       });
                                    }, req, res, next);
   };

   // For tile requests, optionally authenticated using the user's OAuth2 access token or the feed's read-write or
   // read-only API key in the URL or request header.
   //
   // NOTE: for a private feed, authenticating with the OAuth2 access token will be slower than authenticating with
   // either of the feed's API keys because we have to make an extra call to the database to authenticate the user so we
   // can determine whether she has access.
   router.get('/:feedIdOrApiKey/channels/:channelName/tiles/:level.:offset',
              function(req, res, next) {
                 const feedIdOrApiKey = req.params.feedIdOrApiKey;
                 const channelName = req.params.channelName;
                 const level = req.params.level;
                 const offset = req.params.offset;

                 getFeedForReadingByIdOrApiKey(feedIdOrApiKey,
                                               'id,userId,isPublic,apiKey,apiKeyReadOnly',
                                               function(feed) {
                                                  FeedModel.getTile(feed, channelName, level, offset, function(err, tile) {
                                                     if (err) {
                                                        if (err.data && err.data.code === httpStatus.UNPROCESSABLE_ENTITY) {
                                                           return res.jsendPassThrough(err.data);
                                                        }
                                                        return res.jsendServerError(err.message, null);
                                                     }

                                                     res.jsendSuccess(tile);
                                                  });
                                               }, req, res, next);
              });

   /**
    * Reads the <code>format</code> query string parameter (if it exists) and verifies that it matches (case
    * insensitive) one of the output formats defined in OutputFormat.  Defaults to <code>defaultFormat</code> if not
    * specified in the query string.  If valid, returns an object containing <code>format</code> and
    * <code>contentType</code> properties.  If invalid, returns null.
    *
    * @param req - the request
    * @param {string} defaultFormat - the default output format (csv or json)
    * @returns {null|{format: (string), contentType: string}}
    */
   const parseOutputFormat = function(req, defaultFormat) {
      let requestedFormat = (req.query.format || defaultFormat);
      if (isString(requestedFormat)) {
         requestedFormat = requestedFormat.toUpperCase().trim();
         if (requestedFormat in OutputFormat) {
            return OutputFormat[requestedFormat];
         }
      }
      return null;
   }

   const parseExportOptions = function(req, res, next) {
      // Pick out the timezone, if any.  I won't bother doing validation here other than verifying that it's
      // a non-empty string since node-bodytrack-datastore does its own validation.
      let timezone = isNonEmptyString(req.query.timezone) ? req.query.timezone : null;

      // parse the min and max times
      const parseTimeString = function(str) {
         if (isString(str)) {
            const val = parseFloat(str);
            if (isFinite(val)) {
               return val;
            }
         }
         return null;
      };
      let minTime = parseTimeString(req.query.from);
      let maxTime = parseTimeString(req.query.to);

      // swap the times if minTime is greater than maxTime
      if (minTime != null && maxTime != null && minTime > maxTime) {
         const temp = minTime;
         minTime = maxTime;
         maxTime = temp;
      }

      // make sure the format is valid
      let format = (req.query.format || 'csv');
      let contentType;
      if (isString(format)) {
         format = format.toLowerCase().trim();
         if (format === 'json') {
            contentType = 'application/json';
         }
         else if (format === 'csv') {
            contentType = 'text/plain';
         }
         else {
            res.set("Content-Type", "application/json");
            return res.jsendClientError("Invalid format, must be one of 'csv' or 'json'.", { format : format }, httpStatus.UNPROCESSABLE_ENTITY);  // HTTP 422 UNPROCESSABLE_ENTITY
         }
      }
      else {
         res.set("Content-Type", "application/json");
         return res.jsendClientError("Invalid format, must be one of 'csv' or 'json'.", { format : format }, httpStatus.UNPROCESSABLE_ENTITY);  // HTTP 422 UNPROCESSABLE_ENTITY
      }

      // insert the options into the request, for use downstream
      req.exportOptions = {
         timezone : timezone,
         minTime : minTime,
         maxTime : maxTime,
         format : format,
         contentType : contentType
      };

      next();
   };

   const exportData = function(req, res, feedAndChannels, filenamePrefix = "export") {
      let filename = filenamePrefix;
      if (req['exportOptions'].minTime != null) {
         filename += "_from_time_" + req['exportOptions'].minTime;
      }
      if (req['exportOptions'].maxTime != null) {
         filename += "_to_" + (req['exportOptions'].minTime == null ? "time_" : "") + req['exportOptions'].maxTime;
      }
      filename += "." + req['exportOptions'].format;

      FeedModel.exportData(feedAndChannels,
                           req['exportOptions'],
                           function(err, eventEmitter) {
                              if (err) {
                                 if (err.data && err.data.code === httpStatus.UNPROCESSABLE_ENTITY) {
                                    return res.jsendPassThrough(err.data)
                                 }

                                 log.error("Failed to export feed: " + JSON.stringify(err, null, 3));
                                 return res.jsendServerError("Failed to export feed", null);
                              }

                              // set the status code, the connection to close, content type, and specify the Content-disposition filename
                              res
                                    .status(httpStatus.OK)
                                    .set("Connection", "close")
                                    .set("Content-Type", req['exportOptions'].contentType)
                                    .attachment(filename);

                              // I don't really understand why, but we must have a
                              // function (even an empty one!) listening on stderr,
                              // or else sometimes I get no data on stdout.  As of
                              // 2015-01-13, I've only seen this on multifeed
                              // getTiles and not with export, but I guess it can't
                              // hurt here.
                              eventEmitter.stderr.on('data', function(data) {
                                 // log.error(data);
                              });

                              eventEmitter.on('error', function(e) {
                                 log.error("Error event from EventEmitter while exporting: " + JSON.stringify(e, null, 3));
                              });

                              // pipe the eventEmitter to the response
                              return eventEmitter.stdout.pipe(res);
                           });
   };

   // For exporting one or more channels from a single feed
   // /api/v1/feeds/{feedIdOrApiKey}/channels/{channels}/export?from={from}&to={to}
   router.get('/:feedIdOrApiKey/channels/:channels/export',
              parseExportOptions,
              function(req, res, next) {
                 // scrub the channels, removing dupes, but preserving the requested order of the unique ones
                 const requestedChannels = (req.params.channels || '').split(',').map(trim);
                 const alreadyIncludedChannels = {};
                 const channels = requestedChannels.filter(function(channel) {
                    const isNew = !(channel in alreadyIncludedChannels);
                    if (isNew) {
                       alreadyIncludedChannels[channel] = true;
                    }
                    return isNew;
                 });

                 getFeedForReadingByIdOrApiKey(req.params['feedIdOrApiKey'],
                                               'id,userId,isPublic,apiKey,apiKeyReadOnly',
                                               function(feed) {
                                                  // build the filename prefix for the Content-disposition header
                                                  const filenamePrefix = "export_of_feed_" + feed.id;

                                                  // export the data
                                                  exportData(req, res, [{
                                                     feed : feed,
                                                     channels : channels
                                                  }], filenamePrefix);
                                               },
                                               req, res, next)
              });

   // For exporting one or more channels from one or more public feeds.  Feeds and channels are specified in the URL as
   // a comma-delimited list of one or more feedId.channel items:
   //
   //    /api/v1/feeds/export/feedId.channel,feedId.channel,feedId.channel
   //
   // Supports the same optional query string params as single-feed export
   router.get('/export/:feedIdAndChannelList',
              parseExportOptions,
              function(req, res, next) {
                 // scrub the feedId.channel items, removing dupes, but preserving the requested order of the unique ones
                 const requestedFeedAndChannelItems = (req.params['feedIdAndChannelList'] || '').split(',').map(trim);
                 const alreadyIncluded = new Set();
                 const uniqueFeedAndChannelItems = requestedFeedAndChannelItems.filter(function(feedIdAndChannel) {
                    const isNew = !alreadyIncluded.has(feedIdAndChannel);
                    if (isNew) {
                       alreadyIncluded.add(feedIdAndChannel);
                    }
                    return isNew;
                 });

                 // Now filter out invalid feedId.channel items, again preserving order. Validation here is pretty
                 // simple...just checking for positive integer ID and making sure the channel name is a string. That's
                 // good enough for here. We'll verify the feeds exist and are public below, and the datastore does its
                 // own strict validation for device/channel names (see BodyTrackDatastore.isValidKey()).
                 const feedChannelPairs = [];
                 uniqueFeedAndChannelItems.forEach(function(feedIdAndChannel) {
                    const [feedId, channel] = feedIdAndChannel.split('.');
                    if (isPositiveIntString(feedId) && isString(channel)) {
                       feedChannelPairs.push({ id : parseInt(feedId), channel : channel });
                    }
                 });

                 // create a set of the requested feed IDs
                 const feedIds = new Set(feedChannelPairs.map(o => o.id));

                 log.debug("AFTER SCRUBDOWN");
                 log.debug(feedIds);
                 log.debug(feedChannelPairs);

                 // If we have feed IDs remaining after the above scrubdown, then call FeedModel's findBySqlWhere() to
                 // get all public feeds identified by the IDs in the feedIds set.
                 if (feedIds.size > 0) {
                    FeedModel.findBySqlWhere({
                                                where : "((isPublic=1) AND (id IN (?)))",
                                                values : [Array.from(feedIds)]
                                             },
                                             {
                                                fields : ['id', 'userId', 'isPublic'],
                                                orderBy : ['id']
                                             },
                                             false,   // false here to ensure the SQL doesn't include a LIMIT clause
                                             function(err, publicFeeds) {
                                                if (err) {
                                                   const message = "Error while trying to find feeds";
                                                   log.error(message + ": " + err);
                                                   return res.jsendServerError(message);
                                                }
                                                else {
                                                   if (publicFeeds && publicFeeds.length > 0) {
                                                      // Now that we know which feed IDs are public, we need to filter
                                                      // the feedChannelPairs again, stripping out any private ones.
                                                      // Begin by turning the feeds returned from the DB into a map, for
                                                      // fast lookups.
                                                      const publicFeedsById = {};
                                                      publicFeeds.forEach(function(feed) {
                                                         publicFeedsById[feed.id] = feed;
                                                      });

                                                      // Now build the collection of feed+channel items to be exported
                                                      // by filtering the feedChannelPairs for public feeds, and then
                                                      // converting to the format expected by FeedModel's exportData()
                                                      // method.
                                                      const publicFeedChannelPairs = feedChannelPairs
                                                            .filter(feedChannelPair => feedChannelPair.id in publicFeedsById)
                                                            .map(function(feedChannelPair) {
                                                               return {
                                                                  feed : {
                                                                     id : feedChannelPair.id,
                                                                     userId : publicFeedsById[feedChannelPair.id].userId
                                                                  },
                                                                  channels : [feedChannelPair.channel]
                                                               };
                                                            });

                                                      log.debug(JSON.stringify(publicFeedChannelPairs, null, 3));

                                                      // build the filename prefix by including all feed IDs in numerical order
                                                      let filenamePrefix = "export_of_feed";
                                                      let publicFeedIds = Object.keys(publicFeedsById);
                                                      if (publicFeedIds.length > 1) {
                                                         filenamePrefix += 's';
                                                      }
                                                      filenamePrefix += '_' + publicFeedIds.join('_');

                                                      log.debug("publicFeedIds=[" + Object.keys(publicFeedsById) + "]");
                                                      log.debug("FILENAME PREFIX=[" + filenamePrefix + "]");
                                                      // finally, export the data
                                                      exportData(req, res, publicFeedChannelPairs, filenamePrefix);
                                                   }
                                                   else {
                                                      return res.jsendClientError("Unknown or invalid feed(s)", null, httpStatus.NOT_FOUND); // HTTP 404 Not Found
                                                   }
                                                }
                                             });
                 }
                 else {
                    return res.jsendClientError("Unknown or invalid feed(s)", null, httpStatus.NOT_FOUND); // HTTP 404 Not Found
                 }
              }
   );

   router.put('/:feedId/properties/:key',
              passport.authenticate('bearer', { session : false }),
              function(req, res) {
                 verifyFeedOwnership(req, res, function(clientId, feedId) {
                    // try setting the property
                    FeedPropertiesModel.setProperty(clientId, feedId, req.params['key'], req.body, function(err, property) {
                       if (err) {
                          if (err instanceof ValidationError) {
                             return res.jsendClientValidationError(err.message || "Validation failure", err.data);   // HTTP 422 Unprocessable Entity
                          }
                          if (typeof err.data !== 'undefined' &&
                              typeof err.data.code !== 'undefined' &&
                              typeof err.data.status !== 'undefined') {
                             return res.jsendPassThrough(err.data);
                          }

                          const message = "Error setting property";
                          log.error(message + ": " + err);
                          return res.jsendServerError(message);
                       }

                       return res.jsendSuccess(property); // HTTP 200 OK
                    });
                 });
              }
   );

   router.get('/:feedId/properties/:key',
              passport.authenticate('bearer', { session : false }),
              function(req, res) {
                 verifyFeedOwnership(req, res, function(clientId, feedId) {
                    FeedPropertiesModel.getProperty(clientId, feedId, req.params['key'], function(err, property) {
                       if (err) {
                          if (err instanceof ValidationError) {
                             return res.jsendClientValidationError(err.message || "Validation failure", err.data);   // HTTP 422 Unprocessable Entity
                          }
                          if (typeof err.data !== 'undefined' &&
                              typeof err.data.code !== 'undefined' &&
                              typeof err.data.status !== 'undefined') {
                             return res.jsendPassThrough(err.data);
                          }

                          const message = "Error while finding property [" + req.params['key'] + "]";
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

   router.get('/:feedId/properties',
              passport.authenticate('bearer', { session : false }),
              function(req, res) {
                 verifyFeedOwnership(req, res, function(clientId, feedId) {
                    FeedPropertiesModel.find(clientId, feedId, req.query, function(err, properties) {
                       if (err) {
                          const message = "Error while finding the feed properties";
                          log.error(message + ": " + err);
                          return res.jsendServerError(message);
                       }

                       return res.jsendSuccess(properties); // HTTP 200 OK
                    });
                 });
              }
   );

   router.delete('/:feedId/properties',
                 passport.authenticate('bearer', { session : false }),
                 function(req, res) {

                    verifyFeedOwnership(req, res, function(clientId, feedId) {
                       FeedPropertiesModel.deleteAll(clientId, feedId, function(err, deleteResult) {
                          if (err) {
                             const message = "Error while deleting the feed properties";
                             log.error(message + ": " + err);
                             return res.jsendServerError(message);
                          }

                          return res.jsendSuccess(deleteResult); // HTTP 200 OK
                       });
                    });
                 }
   );

   router.delete('/:feedId/properties/:key',
                 passport.authenticate('bearer', { session : false }),
                 function(req, res) {
                    verifyFeedOwnership(req, res, function(clientId, feedId) {
                       FeedPropertiesModel.deleteProperty(clientId, feedId, req.params['key'], function(err, deleteResult) {
                          if (err) {
                             if (err instanceof ValidationError) {
                                return res.jsendClientValidationError(err.message || "Validation failure", err.data);   // HTTP 422 Unprocessable Entity
                             }
                             if (typeof err.data !== 'undefined' &&
                                 typeof err.data.code !== 'undefined' &&
                                 typeof err.data.status !== 'undefined') {
                                return res.jsendPassThrough(err.data);
                             }

                             const message = "Error while deleting property [" + req.params['key'] + "]";
                             log.error(message + ": " + err);
                             return res.jsendServerError(message);
                          }

                          return res.jsendSuccess(deleteResult); // HTTP 200 OK
                       });
                    });
                 }
   );

   /**
    * Executes the given <code>action</code> function if and only if the feed specified by the feedId in the URL is
    * owned by the OAuth2 authenticated user.
    *
    * @param req the HTTP request
    * @param res the HTTP response
    * @param {function} action function with signature <code>callback(clientId, feedId, doesFeedExist)</code>
    */
   const verifyFeedOwnership = function(req, res, action) {
      let feedId = req.params.feedId;
      if (isPositiveIntString(feedId)) {
         feedId = parseInt(feedId);    // make it an int
         FeedModel.isFeedOwnedByUser(feedId, req.user.id, function(err, isOwnedByUser, doesFeedExist) {
            if (err) {
               const message = "Error determining whether feed [" + feedId + "] is owned by user [" + req.user.id + "]";
               log.error(message + ": " + err);
               return res.jsendServerError(message);
            }
            else {
               if (isOwnedByUser) {
                  action(req.authInfo.token.clientId, feedId);
               }
               else {
                  if (doesFeedExist) {
                     return res.jsendClientError("Access denied", null, httpStatus.FORBIDDEN);  // HTTP 403 Forbidden
                  }
                  else {
                     return res.jsendClientError("Unknown or invalid feed", null, httpStatus.NOT_FOUND); // HTTP 404 Not Found
                  }
               }
            }
         });
      }
      else {
         return res.jsendClientError("Unknown or invalid feed", null, httpStatus.NOT_FOUND); // HTTP 404 Not Found
      }
   };

   // Finds a feed for writing by ID or API Key
   const getFeedForWritingByIdOrApiKey = function(feedIdOrApiKey, fieldsToSelect, successCallback, req, res, next) {
      if (isFeedApiKey(feedIdOrApiKey)) {
         const feedApiKey = feedIdOrApiKey;
         FeedModel.findByApiKey(feedApiKey,
                                fieldsToSelect,
                                function(err, feed) {
                                   if (err) {
                                      const message = "Error while trying to find feed with API key [" + feedApiKey + "]";
                                      log.error(message + ": " + err);
                                      return res.jsendServerError(message);
                                   }

                                   if (feed) {
                                      // make sure user is using the read-write API key
                                      if (feed.apiKey === feedApiKey) {
                                         return successCallback(feed);
                                      }
                                      else {
                                         return res.jsendClientError("Access denied.", null, httpStatus.FORBIDDEN);  // HTTP 403 Forbidden
                                      }
                                   }
                                   else {
                                      return res.jsendClientError("Unknown or invalid feed", null, httpStatus.NOT_FOUND); // HTTP 404 Not Found
                                   }
                                });
      }
      else {
         let feedId = feedIdOrApiKey;
         // Not a Feed API key, but now make sure the ID is an int or a string that parses as a positive int (e.g. reject things like '4240abc')
         if (isPositiveIntString(feedId)) {
            feedId = parseInt(feedId);    // make it an int
            FeedModel.findById(feedId,
                               fieldsToSelect,
                               function(err, feed) {
                                  if (err) {
                                     const message = "Error while trying to find feed with ID [" + feedId + "]";
                                     log.error(message + ": " + err);
                                     return res.jsendServerError(message);
                                  }

                                  if (feed) {
                                     // verify acces, either by the read-write API key in the header, or the OAuth2 authorization
                                     if ("feedapikey" in req.headers) {
                                        if ((req.headers['feedapikey'] === feed.apiKey)) {
                                           return successCallback(feed);
                                        }
                                        return res.jsendClientError("Access denied.", null, httpStatus.FORBIDDEN);  // HTTP 403 Forbidden
                                     }
                                     else if ("authorization" in req.headers) {
                                        // If they sent an OAuth2 Authorization header, then authenticate the user to see whether she
                                        // owns the feed.  If so, then she should be granted access to see a tile.
                                        passport.authenticate('bearer', function(err, user) {
                                           if (err) {
                                              const message = "Error while authenticating with OAuth2 access token for feed [" + feed.id + "]";
                                              log.error(message + ": " + err);
                                              return res.jsendServerError(message);
                                           }

                                           if (user) {
                                              // make sure the user owns the feed
                                              if (user.id === feed.userId) {
                                                 return successCallback(feed);
                                              }
                                           }
                                           return res.jsendClientError("Access denied.", null, httpStatus.FORBIDDEN);  // HTTP 403 Forbidden
                                        })(req, res, next);
                                     }
                                     else {
                                        // Otherwise, deny access.
                                        return res.jsendClientError("Authentication required.", null, httpStatus.UNAUTHORIZED);  // HTTP 401 Unauthorized
                                     }
                                  }
                                  else {
                                     return res.jsendClientError("Unknown or invalid feed", null, httpStatus.NOT_FOUND); // HTTP 404 Not Found
                                  }
                               });
         }
         else {
            return res.jsendClientError("Unknown or invalid feed", null, httpStatus.NOT_FOUND); // HTTP 404 Not Found
         }
      }
   };

   // Finds a feed for reading by ID or API Key
   const getFeedForReadingByIdOrApiKey = function(feedIdOrApiKey, fieldsToSelect, successCallback, req, res, next) {
      if (isFeedApiKey(feedIdOrApiKey)) {
         const feedApiKey = feedIdOrApiKey;
         FeedModel.findByApiKey(feedApiKey,
                                fieldsToSelect,
                                function(err, feed) {
                                   if (err) {
                                      const message = "Error while trying to find feed with API key [" + feedApiKey + "]";
                                      log.error(message + ": " + err);
                                      return res.jsendServerError(message);
                                   }

                                   if (feed) {
                                      return successCallback(feed, { hasAccessToReadWriteFeedApiKey : feed.apiKey === feedApiKey });
                                   }
                                   else {
                                      return res.jsendClientError("Unknown or invalid feed", null, httpStatus.NOT_FOUND); // HTTP 404 Not Found
                                   }
                                });
      }
      else {
         let feedId = feedIdOrApiKey;
         // Not a Feed API key, but now make sure the ID is an int or a string that parses as a positive int (e.g. reject things like '4240abc')
         if (isPositiveIntString(feedId)) {
            feedId = parseInt(feedId);    // make it an int
            FeedModel.findById(feedId,
                               fieldsToSelect,
                               function(err, feed) {
                                  if (err) {
                                     const message = "Error while trying to find feed with ID [" + feedId + "]";
                                     log.error(message + ": " + err);
                                     return res.jsendServerError(message);
                                  }

                                  if (feed) {
                                     // Allow access if the feed is public
                                     if (feed.isPublic) {
                                        return successCallback(feed);
                                     }
                                     else {
                                        // if the feed is private, then check for authorization
                                        if ("feedapikey" in req.headers) {
                                           const isReadWriteKey = (req.headers['feedapikey'] === feed.apiKey);
                                           const isReadOnlyKey = (req.headers['feedapikey'] === feed.apiKeyReadOnly);

                                           if (isReadWriteKey || isReadOnlyKey) {
                                              return successCallback(feed, { hasAccessToReadWriteFeedApiKey : isReadWriteKey });
                                           }
                                           return res.jsendClientError("Access denied.", null, httpStatus.FORBIDDEN);  // HTTP 403 Forbidden
                                        }
                                        else if ("authorization" in req.headers) {
                                           // If they sent an OAuth2 Authorization header, then authenticate the user to see whether she
                                           // owns the feed.  If so, then she should be granted access to see a tile.
                                           passport.authenticate('bearer', function(err, user) {
                                              if (err) {
                                                 const message = "Error while authenticating with OAuth2 access token for feed [" + feed.id + "]";
                                                 log.error(message + ": " + err);
                                                 return res.jsendServerError(message);
                                              }

                                              if (user) {
                                                 // make sure the user owns the feed
                                                 if (user.id === feed.userId) {
                                                    return successCallback(feed, { hasAccessToReadWriteFeedApiKey : true });
                                                 }
                                              }
                                              return res.jsendClientError("Access denied.", null, httpStatus.FORBIDDEN);  // HTTP 403 Forbidden
                                           })(req, res, next);
                                        }
                                        else {
                                           // Otherwise, deny access.
                                           return res.jsendClientError("Authentication required.", null, httpStatus.UNAUTHORIZED);  // HTTP 401 Unauthorized
                                        }
                                     }
                                  }
                                  else {
                                     return res.jsendClientError("Unknown or invalid feed", null, httpStatus.NOT_FOUND); // HTTP 404 Not Found
                                  }
                               });
         }
         else {
            return res.jsendClientError("Unknown or invalid feed", null, httpStatus.NOT_FOUND); // HTTP 404 Not Found
         }
      }
   };

   /**
    * Trims the given string.  If not a string, returns an empty string.
    *
    * @param {string} str the string to be trimmed
    */
   const trim = function(str) {
      if (isString(str)) {
         return str.trim();
      }
      return '';
   };

   return router;
};

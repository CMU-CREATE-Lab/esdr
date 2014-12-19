var trimAndCopyPropertyIfNonEmpty = require('../lib/objectUtils').trimAndCopyPropertyIfNonEmpty;
var JaySchema = require('jayschema');
var jsonValidator = new JaySchema();
var ValidationError = require('../lib/errors').ValidationError;
var Query2Query = require('query2query');
var createRandomHexToken = require('../lib/token').createRandomHexToken;
var S = require('string');
var qs = require('qs');
var feedsQuery2query = require('./feeds-query2query');
var log = require('log4js').getLogger('esdr:models:multifeeds');

var CREATE_TABLE_QUERY = " CREATE TABLE IF NOT EXISTS `Multifeeds` ( " +
                         "`id` bigint(20) NOT NULL AUTO_INCREMENT, " +
                         "`name` varchar(255) NOT NULL, " +
                         "`userId` bigint(20) NOT NULL, " +
                         "`spec` text NOT NULL, " +
                         "`querySpec` text NOT NULL, " +
                         "`created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, " +
                         "`modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, " +
                         "PRIMARY KEY (`id`), " +
                         "UNIQUE KEY `name` (`name`), " +
                         "KEY `userId` (`userId`), " +
                         "KEY `created` (`created`), " +
                         "KEY `modified` (`modified`), " +
                         "CONSTRAINT `multifeeds_userId_fk_1` FOREIGN KEY (`userId`) REFERENCES `Users` (`id`) " +
                         ") ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8";

var MAX_FOUND_MULTIFEEDS = 100;

var query2query = new Query2Query();
query2query.addField('id', true, true, false, Query2Query.types.INTEGER);
query2query.addField('name', true, true, false);
query2query.addField('userId', true, true, false, Query2Query.types.INTEGER);
query2query.addField('spec', false, false, false);
query2query.addField('querySpec', false, false, false);
query2query.addField('created', true, true, false, Query2Query.types.DATETIME);
query2query.addField('modified', true, true, false, Query2Query.types.DATETIME);

var JSON_SCHEMA = {
   "$schema" : "http://json-schema.org/draft-04/schema#",
   "title" : "Multitile",
   "description" : "An ESDR multitile",
   "type" : "object",
   "properties" : {
      "name" : {
         "type" : "string",
         "pattern" : "^[a-zA-Z0-9_\\-]+$",   // alphanumeric, underscore, and hyphen
         "minLength" : 1,
         "maxLength" : 255
      },
      "spec" : {
         "type" : "array",
         "minItems" : 1,
         "items" : {
            "type" : "object",
            "properties" : {
               "feeds" : {
                  "type" : "string",
                  "minLength" : 1
               },
               "channels" : {
                  "type" : "array",
                  "minItems" : 1,
                  "uniqueItems" : true,
                  "items" : {
                     "type" : "string",
                     "minLength" : 1
                  }
               }
            },
            "required" : ["feeds", "channels"]
         }
      }
   },
   "required" : ["name", "spec"]
};

module.exports = function(databaseHelper) {

   this.jsonSchema = JSON_SCHEMA;

   this.initialize = function(callback) {
      databaseHelper.execute(CREATE_TABLE_QUERY, [], function(err) {
         if (err) {
            log.error("Error trying to create the Multifeeds table: " + err);
            return callback(err);
         }

         return callback(null, true);
      });
   };

   this.create = function(multifeedDetails, userId, callback) {
      var multifeed = {
         userId : userId,
         spec : multifeedDetails.spec,
         querySpec : "" // created below...
      };
      trimAndCopyPropertyIfNonEmpty(multifeedDetails, multifeed, "name");
      if (typeof multifeed.name === 'undefined' || multifeed.name == null) {
         multifeed.name = createRandomHexToken(32);
      }

      // now validate
      jsonValidator.validate(multifeed, JSON_SCHEMA, function(err) {
         if (err) {
            return callback(new ValidationError(err));
         }

         // convert the spec to a more usable form for SQL queries, so we don't have to rebuild this for every request
         var querySpecParts = [];
         for (var i = 0; i < multifeedDetails.spec.length; i++) {
            var specItem = multifeedDetails.spec[i];
            var miniQueryString = qs.parse(specItem.feeds);
            log.debug("multifeed create: miniQueryString: " + JSON.stringify(miniQueryString, null, 3));
            try {
               var result = feedsQuery2query.parseSync(miniQueryString);
               log.debug("multifeed create: result: " + JSON.stringify(result, null, 3));
               if (result.where != null && result.where.length > 0) {
                  querySpecParts.push({
                                            feeds : {
                                               where : result.where,
                                               values : result.whereValues
                                            },
                                            channels : specItem.channels
                                         });
               }
               else {
                  return callback(new ValidationError(miniQueryString, "No where clause found"));
               }
            }
            catch (e) {
               return callback(e);
            }
         }

         // need to stringify the spec and querySpec objects for storage in the DB
         multifeed.spec = JSON.stringify(multifeedDetails.spec);
         multifeed.querySpec = JSON.stringify(querySpecParts);

         // now that we have the hashed secret, try to insert
         databaseHelper.execute("INSERT INTO Multifeeds SET ?", multifeed, function(err, result) {
            if (err) {
               return callback(err);
            }

            return callback(null, {
               insertId : result.insertId,
               // include these because they might have been modified by the trimming
               name : multifeed.name
            });
         });
      });
   };

   this.find = function(queryString, callback) {
      log.debug("Multifeed Find: " + JSON.stringify(queryString, null, 3));
      query2query.parse(queryString, function(err, queryParts) {

                           if (err) {
                              return callback(err);
                           }

                           var sql = queryParts.sql("Multifeeds");
                           log.debug("Multifeeds.find(): " + sql + (queryParts.whereValues.length > 0 ? " [where values: " + queryParts.whereValues + "]" : ""));

                           // use findWithLimit so we can also get a count of the total number of records that would have been returned
                           // had there been no LIMIT clause included in the query
                           databaseHelper.findWithLimit(sql, queryParts.whereValues, function(err, result) {
                              if (err) {
                                 return callback(err);
                              }

                              // copy in the offset and limit
                              result.offset = queryParts.offset;
                              result.limit = queryParts.limit;

                              return callback(null, result, queryParts.selectFields);
                           });
                        },
                        MAX_FOUND_MULTIFEEDS);
   };

   /**
    * Tries to find the mulitfeed with the given name or ID and returns it to the given
    * <code>callback</code>. If successful, the mulitfeed is returned as the 2nd argument to the <code>callback</code>
    * function.  If unsuccessful, <code>null</code> is returned to the callback.
    *
    * @param {string} nameOrId The name or Id of the multifeed to find.
    * @param {string|array} fieldsToSelect comma-delimited string or array of strings of field names to select.
    * @param {function} callback function with signature <code>callback(err, feed)</code>
    */
   this.findByNameOrId = function(nameOrId, fieldsToSelect, callback) {
      var methodName = S(nameOrId).isNumeric() ? "findById" : "findByName";

      this[methodName](nameOrId, fieldsToSelect, callback);
   };

   /**
    * Tries to find the mulitfeed with the given name and returns it to the given
    * <code>callback</code>. If successful, the mulitfeed is returned as the 2nd argument to the <code>callback</code>
    * function.  If unsuccessful, <code>null</code> is returned to the callback.
    *
    * @param {string} name The name of the multifeed to find.
    * @param {string|array} fieldsToSelect comma-delimited string or array of strings of field names to select.
    * @param {function} callback function with signature <code>callback(err, feed)</code>
    */
   this.findByName = function(name, fieldsToSelect, callback) {
      findMultifeed(fieldsToSelect, 'name', name, callback);
   };

   /**
    * Tries to find the mulitfeed with the given ID and returns it to the given
    * <code>callback</code>. If successful, the mulitfeed is returned as the 2nd argument to the <code>callback</code>
    * function.  If unsuccessful, <code>null</code> is returned to the callback.
    *
    * @param {string} id ID of the mulitfeed to find.
    * @param {string|array} fieldsToSelect comma-delimited string or array of strings of field names to select.
    * @param {function} callback function with signature <code>callback(err, feed)</code>
    */
   this.findById = function(id, fieldsToSelect, callback) {
      findMultifeed(fieldsToSelect, 'id', id, callback);
   };

   var findMultifeed = function(fieldsToSelect, whereField, whereValue, callback) {
      query2query.parse({ fields : fieldsToSelect }, function(err, queryParts) {
         if (err) {
            return callback(err);
         }

         databaseHelper.findOne(queryParts.selectClause + " FROM Multifeeds WHERE " + whereField + "=?",
                                [whereValue],
                                callback);
      });
   };
};

var JaySchema = require('jayschema');
var jsonValidator = new JaySchema();
var ValidationError = require('../lib/errors').ValidationError;
var Query2Query = require('query2query');
var PROPERTY_KEY_REGEX_STR = require('../lib/typeUtils').PROPERTY_KEY_REGEX_STR;

var config = require('../config');

var log = require('log4js').getLogger('esdr:models:userproperties');

var CREATE_TABLE_QUERY = " CREATE TABLE IF NOT EXISTS `UserProperties` ( " +
                         "`id` bigint(20) NOT NULL AUTO_INCREMENT, " +
                         "`userId` bigint(20) NOT NULL, " +
                         "`clientId` bigint(20) NOT NULL, " +
                         "`propertyKey` varchar(255) NOT NULL, " +
                         "`valueType` enum('int','double','string','json','boolean') NOT NULL, " +
                         "`valueInt` bigint(20) DEFAULT NULL, " +
                         "`valueDouble` double DEFAULT NULL, " +
                         "`valueString` varchar(255) DEFAULT NULL, " +
                         "`valueJson` text DEFAULT NULL, " +
                         "`valueBoolean` boolean DEFAULT NULL, " +
                         "`created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, " +
                         "`modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, " +
                         "PRIMARY KEY (`id`), " +
                         "UNIQUE KEY `userId_clientId_propertyKey_index` (`userId`,`clientId`,`propertyKey`), " +
                         "KEY `userId` (`userId`), " +
                         "KEY `clientId` (`clientId`), " +
                         "KEY `propertyKey` (`propertyKey`), " +
                         "KEY `valueType` (`valueType`), " +
                         "KEY `created` (`created`), " +
                         "KEY `modified` (`modified`), " +
                         "CONSTRAINT `user_properties_userId` FOREIGN KEY (`userId`) REFERENCES `Users` (`id`), " +
                         "CONSTRAINT `user_properties_clientId` FOREIGN KEY (`clientId`) REFERENCES `Clients` (`id`) " +
                         ") ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8";

var query2query = new Query2Query();
query2query.addField('key', true, false, false);
query2query.addField('type', true, false, false);

const DATA_TYPE_TO_FIELD_NAME_MAP = {
   "int" : "valueInt",
   "double" : "valueDouble",
   "string" : "valueString",
   "json" : "valueJson",
   "boolean" : "valueBoolean"
};

var PROPERTY_KEY_ATTRS = {
   "type" : "string",
   "minLength" : 1,
   "maxLength" : 255,
   "pattern" : PROPERTY_KEY_REGEX_STR
};

var JSON_SCHEMA_PROPERTY_KEY = {
   "$schema" : "http://json-schema.org/draft-04/schema#",
   "title" : "Property Key",
   "description" : "An ESDR property key",
   "type" : "object",
   "properties" : {
      "key" : PROPERTY_KEY_ATTRS
   },
   "required" : ["key"]
};

var JSON_SCHEMA_PROPERTY_VALUE = {
   "$schema" : "http://json-schema.org/draft-04/schema#",
   "title" : "Property Value",
   "description" : "An ESDR property value",
   "type" : "object",
   "properties" : {
      "type" : {
         "enum" : Object.keys(DATA_TYPE_TO_FIELD_NAME_MAP)
      },
      "value" : {
         "type" : ["integer", "number", "string", "object", "boolean", "null"]
      }
   },
   "required" : ["type", "value"]
};

var TYPE_VALIDATION_JSON_SCHEMAS = {
   'int' : {
      "$schema" : "http://json-schema.org/draft-04/schema#",
      "type" : "object",
      "properties" : {
         "value" : {
            "type" : ["integer", "null"]
         }
      },
      "required" : ["value"]
   },
   'double' : {
      "$schema" : "http://json-schema.org/draft-04/schema#",
      "type" : "object",
      "properties" : {
         "value" : {
            "type" : ["number", "null"]
         }
      },
      "required" : ["value"]
   },
   'string' : {
      "$schema" : "http://json-schema.org/draft-04/schema#",
      "type" : "object",
      "properties" : {
         "value" : {
            "type" : ["string", "null"],
            "maxLength" : 255
         }
      },
      "required" : ["value"]
   },
   'json' : {
      "$schema" : "http://json-schema.org/draft-04/schema#",
      "type" : "object",
      "properties" : {
         "value" : {
            "type" : ["object", "null"]
         }
      },
      "required" : ["value"]
   },
   'boolean' : {
      "$schema" : "http://json-schema.org/draft-04/schema#",
      "type" : "object",
      "properties" : {
         "value" : {
            "type" : ["boolean", "null"]
         }
      },
      "required" : ["value"]
   }
};

module.exports = function(databaseHelper) {

   this.initialize = function(callback) {
      databaseHelper.execute(CREATE_TABLE_QUERY, [], function(err) {
         if (err) {
            log.error("Error trying to create the UserProperties table: " + err);
            return callback(err);
         }

         return callback(null, true);
      });
   };

   this.getProperty = function(clientId, userId, propertyKey, callback) {
      jsonValidator.validate({ key : propertyKey }, JSON_SCHEMA_PROPERTY_KEY, function(err) {
         if (err) {
            return callback(new ValidationError(err));
         }

         databaseHelper.findOne("SELECT " +
                                "   propertyKey, " +
                                "   valueType, " +
                                "   valueInt, " +
                                "   valueDouble, " +
                                "   valueString, " +
                                "   valueJson, " +
                                "   valueBoolean " +
                                "FROM UserProperties WHERE " +
                                "   clientId=? AND " +
                                "   userId=? AND " +
                                "   propertyKey=?",
                                [clientId, userId, propertyKey],
                                function(err, record) {
                                   if (err) {
                                      log.error("Error trying to find property [" + propertyKey + "] for user [" + userId + "] and client [" + clientId + "]: " + err);
                                      return callback(err);
                                   }

                                   if (record) {
                                      var propertyToReturn = {};

                                      propertyToReturn[propertyKey] = record[DATA_TYPE_TO_FIELD_NAME_MAP[record.valueType]];

                                      // value conversions, if appropriate
                                      if (propertyToReturn[propertyKey] != null) {
                                         if (record.valueType == 'json') {
                                            propertyToReturn[propertyKey] = JSON.parse(propertyToReturn[propertyKey]);
                                         }
                                         else if (record.valueType == 'boolean') {
                                            propertyToReturn[propertyKey] = !!propertyToReturn[propertyKey];
                                         }
                                      }

                                      return callback(null, propertyToReturn);
                                   }

                                   return callback(null, null);
                                });
      });
   };

   this.find = function(clientId, userId, queryString, callback) {
      query2query.parse(queryString, function(err, queryParts) {

                           if (err) {
                              return callback(err);
                           }

                           // We need to be really careful about security here!  Restrict the WHERE clause to allow returning
                           // only devices owned by the authenticated client user.
                           var whereClause = "WHERE (clientId = " + clientId + " AND userId = " + userId + ")";
                           if (queryParts.whereExpressions.length > 0) {
                              // first replace all instances of "key" with "propertyKey" and "type" with "valueType"
                              var where = queryParts.where.replace(/\(key/g, '(propertyKey');
                              where = where.replace(/\(type/g, '(valueType');
                              whereClause += " AND (" + where + ")";
                           }

                           // build the restricted SQL query
                           var restrictedSql = [
                              "SELECT propertyKey, valueType, valueInt, valueDouble, valueString, valueJson, valueBoolean ",
                              "FROM UserProperties",
                              whereClause
                           ].join(' ');

                           databaseHelper.execute(restrictedSql, queryParts.whereValues, function(err, rows) {
                              if (err) {
                                 return callback(err);
                              }

                              var properties = {};
                              if (rows) {
                                 for (var i = 0; i < rows.length; i++) {
                                    var row = rows[i];
                                    var key = row.propertyKey;
                                    var value = row[DATA_TYPE_TO_FIELD_NAME_MAP[row.valueType]];

                                    // value conversions, if appropriate
                                    if (value != null) {
                                       if (row.valueType == 'json') {
                                          value = JSON.parse(value);
                                       }
                                       else if (row.valueType == 'boolean') {
                                          value = !!value;
                                       }
                                    }

                                    properties[key] = value;
                                 }
                              }

                              return callback(null, properties);
                           });
                        },
                        0  // limit value doesn't matter here since we don't include a LIMIT clause in the query above anyway
      );
   };

   this.setProperty = function(clientId, userId, propertyKey, propertyValue, callback) {
      // first make sure that the property key is valid
      jsonValidator.validate({ key : propertyKey }, JSON_SCHEMA_PROPERTY_KEY, function(err) {
         if (err) {
            return callback(new ValidationError(err));
         }

         // Now verify that the property value at least has the expected fields and the right sort of field values.
         // We'll worry later whether the value actually matches the stated type
         jsonValidator.validate(propertyValue, JSON_SCHEMA_PROPERTY_VALUE, function(err) {
            if (err) {
               return callback(new ValidationError(err));
            }

            // Now, depending on the stated type, validate the value against the type
            var typeValidationSchema = TYPE_VALIDATION_JSON_SCHEMAS[propertyValue.type];
            if (typeValidationSchema == null) {
               return callback(new ValidationError("Unexpected property value type: " + propertyValue.type));
            }

            jsonValidator.validate(propertyValue, typeValidationSchema, function(err) {
               if (err) {
                  return callback(new ValidationError(err));
               }

               // We can now be sure that the property value has both 'type' and 'value' fields, and that the value
               // is of the stated type.  Now create the object we'll use to insert/update...

               var property = {
                  propertyKey : propertyKey
               };

               // stuff the userId and clientId into the property, and set the value type, preparing for insert/update
               property['userId'] = userId;
               property['clientId'] = clientId;
               property['valueType'] = propertyValue.type;
               property[DATA_TYPE_TO_FIELD_NAME_MAP[propertyValue.type]] = propertyValue.value;

               // stringify the JSON for storing in the DB
               if (property['valueJson'] != null) {
                  property['valueJson'] = JSON.stringify(property['valueJson']);
               }

               // now try to insert
               databaseHelper.execute("INSERT INTO UserProperties SET ? " +
                                      "ON DUPLICATE KEY UPDATE " +
                                      "valueType=VALUES(valueType)," +
                                      "valueInt=VALUES(valueInt)," +
                                      "valueDouble=VALUES(valueDouble)," +
                                      "valueString=VALUES(valueString)," +
                                      "valueJson=VALUES(valueJson)," +
                                      "valueBoolean=VALUES(valueBoolean)", property, function(err, result) {
                  if (err) {
                     return callback(err);
                  }

                  var propertyToReturn = {};
                  propertyToReturn[propertyKey] = propertyValue.value;
                  callback(null, propertyToReturn);
               });

            });
         });
      });
   };

   this.deleteAll = function(clientId, userId, callback) {
      databaseHelper.execute("DELETE FROM UserProperties WHERE clientId=? AND userId=?",
                             [clientId, userId],
                             function(err, deleteResult) {
                                if (err) {
                                   log.error("Error trying to delete all properties for user [" + userId + "] and client [" + clientId + "]: " + err);
                                   return callback(err);
                                }

                                return callback(null, { propertiesDeleted : deleteResult.affectedRows });
                             });
   };

   this.deleteProperty = function(clientId, userId, propertyKey, callback) {
      jsonValidator.validate({ key : propertyKey }, JSON_SCHEMA_PROPERTY_KEY, function(err) {
         if (err) {
            return callback(new ValidationError(err));
         }

         databaseHelper.execute("DELETE FROM UserProperties WHERE clientId=? AND userId=? and propertyKey=?",
                                [clientId, userId, propertyKey],
                                function(err, deleteResult) {
                                   if (err) {
                                      log.error("Error trying to delete property [" + propertyKey + "] for user [" + userId + "] and client [" + clientId + "]: " + err);
                                      return callback(err);
                                   }

                                   return callback(null, { propertiesDeleted : deleteResult.affectedRows });
                                });
      });
   };

};

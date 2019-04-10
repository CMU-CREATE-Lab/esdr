const ValidationError = require('../lib/errors').ValidationError;
const Query2Query = require('query2query');
const Properties = require('./Properties');

const log = require('log4js').getLogger('esdr:models:deviceproperties');

// language=MySQL
const CREATE_TABLE_QUERY = "CREATE TABLE IF NOT EXISTS `DeviceProperties` ( " +
                           "`id` bigint(20) NOT NULL AUTO_INCREMENT, " +
                           "`deviceId` bigint(20) NOT NULL, " +
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
                           "UNIQUE KEY `deviceId_clientId_propertyKey_index` (`deviceId`,`clientId`,`propertyKey`), " +
                           "KEY `deviceId` (`deviceId`), " +
                           "KEY `clientId` (`clientId`), " +
                           "KEY `propertyKey` (`propertyKey`), " +
                           "KEY `valueType` (`valueType`), " +
                           "KEY `created` (`created`), " +
                           "KEY `modified` (`modified`), " +
                           "CONSTRAINT `device_properties_deviceId` FOREIGN KEY (`deviceId`) REFERENCES `Devices` (`id`), " +
                           "CONSTRAINT `device_properties_clientId` FOREIGN KEY (`clientId`) REFERENCES `Clients` (`id`) " +
                           ") ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8";

const query2query = new Query2Query();
query2query.addField('key', true, false, false);
query2query.addField('type', true, false, false);

module.exports = function(databaseHelper) {

   this.initialize = function(callback) {
      databaseHelper.execute(CREATE_TABLE_QUERY, [], function(err) {
         if (err) {
            log.error("Error trying to create the DeviceProperties table: " + err);
            return callback(err);
         }

         return callback(null, true);
      });
   };

   this.getProperty = function(clientId, deviceId, propertyKey, callback) {
      Properties.ifPropertyKeyIsValid({ key : propertyKey })
            .then(function() {
               // language=MySQL
               const sql = "SELECT " +
                           "   propertyKey, " +
                           "   valueType, " +
                           "   valueInt, " +
                           "   valueDouble, " +
                           "   valueString, " +
                           "   valueJson, " +
                           "   valueBoolean " +
                           "FROM DeviceProperties WHERE " +
                           "   clientId=? AND " +
                           "   deviceId=? AND " +
                           "   propertyKey=?";
               databaseHelper.findOne(sql,
                                      [clientId, deviceId, propertyKey],
                                      function(err, record) {
                                         if (err) {
                                            log.error("Error trying to find property [" + propertyKey + "] for device [" + deviceId + "] and client [" + clientId + "]: " + err);
                                            return callback(err);
                                         }

                                         if (record) {
                                            const propertyToReturn = {};

                                            propertyToReturn[propertyKey] = record[Properties.DATA_TYPE_TO_FIELD_NAME_MAP[record.valueType]];

                                            // value conversions, if appropriate
                                            if (propertyToReturn[propertyKey] != null) {
                                               if (record.valueType === 'json') {
                                                  propertyToReturn[propertyKey] = JSON.parse(propertyToReturn[propertyKey]);
                                               }
                                               else if (record.valueType === 'boolean') {
                                                  propertyToReturn[propertyKey] = !!propertyToReturn[propertyKey];
                                               }
                                            }

                                            return callback(null, propertyToReturn);
                                         }

                                         return callback(null, null);
                                      });
            })
            .catch(err => callback(new ValidationError(err)));
   };

   this.find = function(clientId, deviceId, queryString, callback) {
      query2query.parse(queryString, function(err, queryParts) {

                           if (err) {
                              return callback(err);
                           }

                           // We need to be really careful about security here!  Restrict the WHERE clause to allow returning
                           // only properties for the device owned by the authenticated client user.
                           let whereClause = "WHERE (clientId = " + clientId + " AND deviceId = " + deviceId + ")";
                           if (queryParts.whereExpressions.length > 0) {
                              // first replace all instances of "key" with "propertyKey" and "type" with "valueType"
                              let where = queryParts.where.replace(/\(key/g, '(propertyKey');
                              where = where.replace(/\(type/g, '(valueType');
                              whereClause += " AND (" + where + ")";
                           }

                           // build the restricted SQL query
                           const restrictedSql = [
                              "SELECT propertyKey, valueType, valueInt, valueDouble, valueString, valueJson, valueBoolean ",
                              "FROM DeviceProperties",
                              whereClause
                           ].join(' ');

                           databaseHelper.execute(restrictedSql, queryParts.whereValues, function(err, rows) {
                              if (err) {
                                 return callback(err);
                              }

                              const properties = {};
                              if (rows) {
                                 for (let i = 0; i < rows.length; i++) {
                                    const row = rows[i];
                                    const key = row.propertyKey;
                                    let value = row[Properties.DATA_TYPE_TO_FIELD_NAME_MAP[row.valueType]];

                                    // value conversions, if appropriate
                                    if (value != null) {
                                       if (row.valueType === 'json') {
                                          value = JSON.parse(value);
                                       }
                                       else if (row.valueType === 'boolean') {
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

   this.setProperty = function(clientId, deviceId, propertyKey, propertyValue, callback) {
      // first make sure that the property key is valid
      Properties.ifPropertyKeyIsValid({ key : propertyKey })
            .then(function() {
               // Now verify that the property value at least has the expected fields and the right sort of field values.
               // We'll worry later whether the value actually matches the stated type
               Properties.ifPropertyValueIsValid(propertyValue)
                     .then(function() {
                        // Now, depending on the stated type, validate the value against the type
                        if (!(propertyValue.type in Properties.typeValidators)) {
                           return callback(new ValidationError("Unexpected property value type: " + propertyValue.type));
                        }
                        const ifTypeIsValid = Properties.typeValidators[propertyValue.type];
                        ifTypeIsValid(propertyValue)
                              .then(function() {
                                 // We can now be sure that the property value has both 'type' and 'value' fields, and that the value
                                 // is of the stated type.  Now create the object we'll use to insert/update...

                                 const property = {
                                    propertyKey : propertyKey
                                 };

                                 // stuff the deviceId and clientId into the property, and set the value type, preparing for insert/update
                                 property['deviceId'] = deviceId;
                                 property['clientId'] = clientId;
                                 property['valueType'] = propertyValue.type;
                                 property[Properties.DATA_TYPE_TO_FIELD_NAME_MAP[propertyValue.type]] = propertyValue.value;

                                 // stringify the JSON for storing in the DB
                                 if (property['valueJson'] != null) {
                                    property['valueJson'] = JSON.stringify(property['valueJson']);
                                 }

                                 // now try to insert
                                 // language=MySQL
                                 databaseHelper.execute("INSERT INTO DeviceProperties SET ? " +
                                                        "ON DUPLICATE KEY UPDATE " +
                                                        "valueType=VALUES(valueType)," +
                                                        "valueInt=VALUES(valueInt)," +
                                                        "valueDouble=VALUES(valueDouble)," +
                                                        "valueString=VALUES(valueString)," +
                                                        "valueJson=VALUES(valueJson)," +
                                                        "valueBoolean=VALUES(valueBoolean)",
                                                        property,
                                                        function(err) {
                                                           if (err) {
                                                              return callback(err);
                                                           }

                                                           const propertyToReturn = {};
                                                           propertyToReturn[propertyKey] = propertyValue.value;
                                                           callback(null, propertyToReturn);
                                                        });
                              })
                              .catch(err => callback(new ValidationError(err)));
                     })
                     .catch(err => callback(new ValidationError(err)));
            })
            .catch(err => callback(new ValidationError(err)));
   };

   this.deleteAll = function(clientId, deviceId, callback) {
      databaseHelper.execute("DELETE FROM DeviceProperties WHERE clientId=? AND deviceId=?",
                             [clientId, deviceId],
                             function(err, deleteResult) {
                                if (err) {
                                   log.error("Error trying to delete all properties for device [" + deviceId + "] and client [" + clientId + "]: " + err);
                                   return callback(err);
                                }

                                return callback(null, { propertiesDeleted : deleteResult.affectedRows });
                             });
   };

   this.deleteProperty = function(clientId, deviceId, propertyKey, callback) {
      Properties.ifPropertyKeyIsValid({ key : propertyKey })
            .then(function() {
               // language=MySQL
               databaseHelper.execute("DELETE FROM DeviceProperties WHERE clientId=? AND deviceId=? AND propertyKey=?",
                                      [clientId, deviceId, propertyKey],
                                      function(err, deleteResult) {
                                         if (err) {
                                            log.error("Error trying to delete property [" + propertyKey + "] for device [" + deviceId + "] and client [" + clientId + "]: " + err);
                                            return callback(err);
                                         }

                                         return callback(null, { propertiesDeleted : deleteResult.affectedRows });
                                      });

            })
            .catch(err => callback(new ValidationError(err)));
   };

};

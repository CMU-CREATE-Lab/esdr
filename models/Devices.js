var trimAndCopyPropertyIfNonEmpty = require('../lib/objectUtils').trimAndCopyPropertyIfNonEmpty;
var JaySchema = require('jayschema');
var jsonValidator = new JaySchema();
var ValidationError = require('../lib/errors').ValidationError;
var log = require('log4js').getLogger();

var CREATE_TABLE_QUERY = " CREATE TABLE IF NOT EXISTS `Devices` ( " +
                         "`id` bigint(20) NOT NULL AUTO_INCREMENT, " +
                         "`serialNumber` varchar(255) NOT NULL, " +
                         "`productId` bigint(20) NOT NULL, " +
                         "`userId` bigint(20) DEFAULT NULL, " +    // TODO: make this NOT NULL?
                         "`isPublic` boolean DEFAULT 0, " +
                         "`created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, " +
                         "`modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, " +
                         "PRIMARY KEY (`id`), " +
                         "UNIQUE KEY `serialNumber_productId_index` (`serialNumber`,`productId`), " +
                         "KEY `userId` (`userId`), " +
                         "KEY `serialNumber` (`serialNumber`), " +
                         "KEY `productId` (`productId`), " +
                         "CONSTRAINT `devices_productId_fk_1` FOREIGN KEY (`productId`) REFERENCES `Products` (`id`), " +
                         "CONSTRAINT `devices_userId_fk_1` FOREIGN KEY (`userId`) REFERENCES `Users` (`id`) " +
                         ") ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8";

var JSON_SCHEMA = {
   "$schema" : "http://json-schema.org/draft-04/schema#",
   "title" : "Device",
   "description" : "An ESDR device",
   "type" : "object",
   "properties" : {
      "serialNumber" : {
         "type" : "string",
         "pattern" : "^[a-zA-Z0-9_\\+\\-\\,\\:]+$",   // alphanumeric and _ + - , :
         "minLength" : 1,
         "maxLength" : 255
      },
      "isPublic" : {
         "type" : "boolean"
      }
   },
   "required" : ["serialNumber"]
};

module.exports = function(databaseHelper) {

   this.jsonSchema = JSON_SCHEMA;

   this.initialize = function(callback) {
      databaseHelper.execute(CREATE_TABLE_QUERY, [], function(err) {
         if (err) {
            log.error("Error trying to create the Devices table: " + err);
            return callback(err);
         }

         return callback(null, true);
      });
   };

   this.create = function(deviceDetails, productId, userId, callback) {
      // first build a copy and trim some fields
      var device = {
         productId : productId,
         userId : userId,
         isPublic : !!deviceDetails.isPublic
      };
      trimAndCopyPropertyIfNonEmpty(deviceDetails, device, "serialNumber");

      // now validate
      jsonValidator.validate(device, JSON_SCHEMA, function(err1) {
         if (err1) {
            return callback(new ValidationError(err1));
         }

         // now that we have the hashed secret, try to insert
         databaseHelper.execute("INSERT INTO Devices SET ?", device, function(err2, result) {
            if (err2) {
               return callback(err2);
            }

            return callback(null, {
               insertId : result.insertId,
               // include these because they might have been modified by the trimming
               serialNumber : device.serialNumber
            });
         });
      });
   };

   /**
    * Tries to find the device with the given <code>deviceId</code> and returns it to the given <code>callback</code>.
    * If successful, the device is returned as the 2nd argument to the <code>callback</code> function.  If unsuccessful,
    * <code>null</code> is returned to the callback.
    *
    * @param {number} deviceId id of the device to find.
    * @param {function} callback function with signature <code>callback(err, device)</code>
    */
   this.findById = function(deviceId, callback) {
      findDevice("SELECT * FROM Devices WHERE id=?", [deviceId], callback);
   };

   var findDevice = function(query, params, callback) {
      databaseHelper.findOne(query, params, function(err, device) {
         if (err) {
            log.error("Error trying to find device: " + err);
            return callback(err);
         }

         return callback(null, device);
      });
   };
};

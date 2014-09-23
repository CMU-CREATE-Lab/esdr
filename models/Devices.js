var trimAndCopyPropertyIfNonEmpty = require('../lib/objectUtils').trimAndCopyPropertyIfNonEmpty;
var JaySchema = require('jayschema');
var jsonValidator = new JaySchema();
var ValidationError = require('../lib/errors').ValidationError;
var log = require('log4js').getLogger();

var CREATE_TABLE_QUERY = " CREATE TABLE IF NOT EXISTS `Devices` ( " +
                         "`id` bigint(20) NOT NULL AUTO_INCREMENT, " +
                         "`serialNumber` varchar(255) NOT NULL, " +
                         "`productId` bigint(20) NOT NULL, " +
                         "`userId` bigint(20) NOT NULL, " +
                         "`created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, " +
                         "`modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, " +
                         "PRIMARY KEY (`id`), " +
                         "UNIQUE KEY `serialNumber_productId_userId_index` (`serialNumber`,`productId`,`userId`), " +
                         "KEY `serialNumber` (`serialNumber`), " +
                         "KEY `productId` (`productId`), " +
                         "KEY `userId` (`userId`), " +
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
         userId : userId
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

   /**
    * Find all devices with the given <code>productId</code> for the given user and returns them to the given
    * <code>callback</code>.  If successful, the devices are returned in an array to the 2nd argument to the
    * <code>callback</code> function.  If unsuccessful, <code>null</code> is returned to the callback.
    *
    * @param {number} productId id of the product to find.
    * @param {number} userId id of the user owning this device.
    * @param {function} callback function with signature <code>callback(err, device)</code>
    */
   this.findByProductIdForUser = function(productId, userId, callback) {
      databaseHelper.execute("SELECT * FROM Devices WHERE productId=? AND userId=?",
                             [productId, userId],
                             callback);
   };

   /**
    * Tries to find the device with the given <code>productId</code> and <code>serialNumber</code> for the given user
    * and returns it to the given <code>callback</code>.  If successful, the device is returned in an array to the 2nd
    * argument to the <code>callback</code> function.  If unsuccessful, <code>null</code> is returned to the callback.
    *
    * @param {number} productId id of the product to find.
    * @param {number} serialNumber serial number of the device to find.
    * @param {number} userId id of the user owning this device.
    * @param {function} callback function with signature <code>callback(err, device)</code>
    */
   this.findByProductIdAndSerialNumberForUser = function(productId, serialNumber, userId, callback) {
      findDevice("SELECT * FROM Devices WHERE productId=? AND serialNumber=? AND userId=?",
                 [productId, serialNumber, userId],
                 callback);
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

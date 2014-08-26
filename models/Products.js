var trimAndCopyPropertyIfNonEmpty = require('../lib/objectUtils').trimAndCopyPropertyIfNonEmpty;
var JaySchema = require('jayschema');
var jsonValidator = new JaySchema();
var ValidationError = require('../lib/errors').ValidationError;
var log = require('log4js').getLogger();

var CREATE_TABLE_QUERY = " CREATE TABLE IF NOT EXISTS `Products` ( " +
                         "`id` bigint(20) NOT NULL AUTO_INCREMENT, " +
                         "`name` varchar(255) NOT NULL, " +
                         "`prettyName` varchar(255) NOT NULL, " +
                         "`vendor` varchar(255) DEFAULT NULL, " +
                         "`description` varchar(512) DEFAULT NULL, " +
                         "`creatorUserId` bigint(20) DEFAULT NULL, " +
                         "`isPublic` boolean DEFAULT 0, " +
                         "`defaultAllowUnauthenticatedUpload` boolean DEFAULT 0, " +
                         "`defaultChannelSpec` text NOT NULL, " +
                         "`created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, " +
                         "`modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, " +
                         "PRIMARY KEY (`id`), " +
                         "UNIQUE KEY `unique_name` (`name`), " +
                         "KEY `creatorUserId` (`creatorUserId`), " +
                         "KEY `isPublic` (`isPublic`), " +
                         "CONSTRAINT `products_creatorUserId_fk_1` FOREIGN KEY (`creatorUserId`) REFERENCES `Users` (`id`) " +
                         ") ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8";

var JSON_SCHEMA = {
   "$schema" : "http://json-schema.org/draft-04/schema#",
   "title" : "Product",
   "description" : "An ESDR product",
   "type" : "object",
   "properties" : {
      "name" : {
         "type" : "string",
         "minLength" : 3,
         "maxLength" : 255
      },
      "prettyName" : {
         "type" : "string",
         "minLength" : 3,
         "maxLength" : 255
      },
      "vendor" : {
         "type" : "string",
         "minLength" : 0,
         "maxLength" : 255
      },
      "description" : {
         "type" : "string",
         "minLength" : 0,
         "maxLength" : 512
      },
      "defaultChannelSpec" : {
         "type" : "string",
         "minLength" : 1
      }
   },
   "required" : ["name", "prettyName", "defaultChannelSpec"]
};

module.exports = function(databaseHelper) {

   this.jsonSchema = JSON_SCHEMA;

   this.initialize = function(callback) {
      databaseHelper.execute(CREATE_TABLE_QUERY, [], function(err) {
         if (err) {
            log.error("Error trying to create the Products table: " + err);
            return callback(err);
         }

         return callback(null, true);
      });
   };

   this.create = function(productDetails, creatorUserId, callback) {
      // first build a copy and trim some fields
      var defaultChannelSpec = productDetails.defaultChannelSpec || {};
      var product = {
         creatorUserId : creatorUserId,
         isPublic : !!productDetails.isPublic,
         defaultAllowUnauthenticatedUpload : !!productDetails.defaultAllowUnauthenticatedUpload,
         defaultChannelSpec : JSON.stringify(defaultChannelSpec)
      };
      trimAndCopyPropertyIfNonEmpty(productDetails, product, "name");
      trimAndCopyPropertyIfNonEmpty(productDetails, product, "prettyName");
      trimAndCopyPropertyIfNonEmpty(productDetails, product, "vendor");
      trimAndCopyPropertyIfNonEmpty(productDetails, product, "description");

      // now validate
      jsonValidator.validate(product, JSON_SCHEMA, function(err1) {
         if (err1) {
            return callback(new ValidationError(err1));
         }

            // now that we have the hashed secret, try to insert
            databaseHelper.execute("INSERT INTO Products SET ?", product, function(err2, result) {
               if (err2) {
                  return callback(err2);
               }

               return callback(null, {
                  insertId : result.insertId,
                  // include these because they might have been modified by the trimming
                  name : product.name
               });
            });
      });
   };

   
   /**
    * Tries to find the product with the given <code>name</code> and returns it to the given <code>callback</code>. If
    * successful, the product is returned as the 2nd argument to the <code>callback</code> function.  If unsuccessful,
    * <code>null</code> is returned to the callback.
    *
    * @param {string} name name of the product to find.
    * @param {function} callback function with signature <code>callback(err, product)</code>
    */
   this.findByName = function(name, callback) {
      findProduct("SELECT * FROM Products WHERE name=?", [name], callback);
   };

   var findProduct = function(query, params, callback) {
      databaseHelper.findOne(query, params, function(err, product) {
         if (err) {
            log.error("Error trying to find product: " + err);
            return callback(err);
         }

         return callback(null, product);
      });
   };
};

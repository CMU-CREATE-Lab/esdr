const trimAndCopyPropertyIfNonEmpty = require('../lib/objectUtils').trimAndCopyPropertyIfNonEmpty;
const Ajv = require('ajv');
const ValidationError = require('../lib/errors').ValidationError;
const Query2Query = require('query2query');
const log = require('log4js').getLogger('esdr:models:products');
const isPositiveIntString = require('../lib/typeUtils').isPositiveIntString;

// language=MySQL
const CREATE_TABLE_QUERY = "CREATE TABLE IF NOT EXISTS `Products` ( " +
                           "`id` bigint(20) NOT NULL AUTO_INCREMENT, " +
                           "`name` varchar(255) NOT NULL, " +
                           "`prettyName` varchar(255) NOT NULL, " +
                           "`vendor` varchar(255) DEFAULT NULL, " +
                           "`description` varchar(512) DEFAULT NULL, " +
                           "`creatorUserId` bigint(20) DEFAULT NULL, " +
                           "`defaultChannelSpecs` text NOT NULL, " +
                           "`created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, " +
                           "`modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, " +
                           "PRIMARY KEY (`id`), " +
                           "UNIQUE KEY `unique_name` (`name`), " +
                           "KEY `prettyName` (`prettyName`), " +
                           "KEY `vendor` (`vendor`), " +
                           "KEY `creatorUserId` (`creatorUserId`), " +
                           "KEY `created` (`created`), " +
                           "KEY `modified` (`modified`), " +
                           "CONSTRAINT `products_creatorUserId_fk_1` FOREIGN KEY (`creatorUserId`) REFERENCES `Users` (`id`) " +
                           ") ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8";

const MAX_FOUND_PRODUCTS = 1000;

const query2query = new Query2Query();
query2query.addField('id', true, true, false, Query2Query.types.INTEGER);
query2query.addField('name', true, true, false);
query2query.addField('prettyName', true, true, false);
query2query.addField('vendor', true, true, true);
query2query.addField('description', false, false, true);
query2query.addField('creatorUserId', true, true, true, Query2Query.types.INTEGER);
query2query.addField('defaultChannelSpecs', false, false, false);
query2query.addField('created', true, true, false, Query2Query.types.DATETIME);
query2query.addField('modified', true, true, false, Query2Query.types.DATETIME);

const JSON_SCHEMA = {
   "$async" : true,
   "title" : "Product",
   "description" : "An ESDR product",
   "type" : "object",
   "properties" : {
      "name" : {
         "type" : "string",
         "pattern" : "^(?=.*[a-zA-Z])([a-zA-Z0-9_]+)$",   // must contain at least one letter
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
      "defaultChannelSpecs" : {
         "type" : "string",
         "minLength" : 2
      }
   },
   "required" : ["name", "prettyName", "defaultChannelSpecs"]
};

const ajv = new Ajv({ allErrors : true });
const ifProductIsValid = ajv.compile(JSON_SCHEMA);

module.exports = function(databaseHelper) {

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
      const product = {
         creatorUserId : creatorUserId
      };
      trimAndCopyPropertyIfNonEmpty(productDetails, product, "name");
      trimAndCopyPropertyIfNonEmpty(productDetails, product, "prettyName");
      trimAndCopyPropertyIfNonEmpty(productDetails, product, "vendor");
      trimAndCopyPropertyIfNonEmpty(productDetails, product, "description");
      if (typeof productDetails.defaultChannelSpecs !== 'undefined' && productDetails.defaultChannelSpecs != null) {
         product.defaultChannelSpecs = JSON.stringify(productDetails.defaultChannelSpecs);
      }

      // now validate
      ifProductIsValid(product)
            .then(function() {
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
            })
            .catch(err => callback(new ValidationError(err)));
   };

   /**
    * Tries to find the product with the given <code>name</code> and returns it to the given <code>callback</code>. If
    * successful, the product is returned as the 2nd argument to the <code>callback</code> function.  If unsuccessful,
    * <code>null</code> is returned to the callback.
    *
    * @param {string} name name of the product to find.
    * @param {string|array} fieldsToSelect comma-delimited string or array of strings of field names to select.
    * @param {function} callback function with signature <code>callback(err, product)</code>
    */
   this.findByName = function(name, fieldsToSelect, callback) {
      findProduct(fieldsToSelect, 'name', name, callback);
   };

   /**
    * Tries to find the product with the given <code>id</code> and returns it to the given <code>callback</code>. If
    * successful, the product is returned as the 2nd argument to the <code>callback</code> function.  If unsuccessful,
    * <code>null</code> is returned to the callback.
    *
    * @param {string} id ID of the product to find.
    * @param {string|array} fieldsToSelect comma-delimited string or array of strings of field names to select.
    * @param {function} callback function with signature <code>callback(err, product)</code>
    */
   this.findById = function(id, fieldsToSelect, callback) {
      findProduct(fieldsToSelect, 'id', id, callback);
   };

   /**
    * Tries to find the product with the given <code>productNameOrId</code> and returns it to the given
    * <code>callback</code>. If successful, the product is returned as the 2nd argument to the <code>callback</code>
    * function.  If unsuccessful, <code>null</code> is returned to the callback.
    *
    * @param {string|int} productNameOrId name or ID of the product to find.
    * @param {string|array} fieldsToSelect comma-delimited string or array of strings of field names to select.
    * @param {function} callback function with signature <code>callback(err, product)</code>
    */
   this.findByNameOrId = function(productNameOrId, fieldsToSelect, callback) {
      const isId = isPositiveIntString('' + productNameOrId);
      if (isId) {
         this.findById(parseInt(productNameOrId), fieldsToSelect, callback)
      }
      else {
         this.findByName(productNameOrId, fieldsToSelect, callback)
      }
   };

   this.find = function(queryString, callback) {
      query2query.parse(queryString, function(err, queryParts) {

                           if (err) {
                              return callback(err);
                           }

                           const sql = queryParts.sql("Products");
                           log.debug("Products.find(): " + sql + (queryParts.whereValues.length > 0 ? " [where values: " + queryParts.whereValues + "]" : ""));

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
                        MAX_FOUND_PRODUCTS);
   };

   const findProduct = function(fieldsToSelect, whereField, whereValue, callback) {
      query2query.parse({ fields : fieldsToSelect }, function(err, queryParts) {
         if (err) {
            return callback(err);
         }

         const sql = queryParts.selectClause + " FROM Products WHERE " + whereField + "=?";
         databaseHelper.findOne(sql, [whereValue], function(err, product) {
            if (err) {
               log.error("Error trying to find product with " + whereField + " [" + whereValue + "]: " + err);
               return callback(err);
            }

            return callback(null, product);
         });
      });
   };
};

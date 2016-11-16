const PROPERTY_KEY_REGEX_STR = '^[a-zA-Z][a-zA-Z0-9_]*$';
const PROPERTY_KEY_REGEX = new RegExp(PROPERTY_KEY_REGEX_STR);

const DATA_TYPE_TO_FIELD_NAME_MAP = Object.freeze({
   "int" : "valueInt",
   "double" : "valueDouble",
   "string" : "valueString",
   "json" : "valueJson",
   "boolean" : "valueBoolean"
});

var PROPERTY_KEY_ATTRS = Object.freeze({
   "type" : "string",
   "minLength" : 1,
   "maxLength" : 255,
   "pattern" : PROPERTY_KEY_REGEX_STR
});

var JSON_SCHEMA_PROPERTY_KEY = Object.freeze({
   "$schema" : "http://json-schema.org/draft-04/schema#",
   "title" : "Property Key",
   "description" : "An ESDR property key",
   "type" : "object",
   "properties" : Object.freeze({
      "key" : PROPERTY_KEY_ATTRS
   }),
   "required" : Object.freeze(["key"])
});


var JSON_SCHEMA_PROPERTY_VALUE = Object.freeze({
   "$schema" : "http://json-schema.org/draft-04/schema#",
   "title" : "Property Value",
   "description" : "An ESDR property value",
   "type" : "object",
   "properties" : Object.freeze({
      "type" : Object.freeze({
         "enum" : Object.freeze(Object.keys(DATA_TYPE_TO_FIELD_NAME_MAP))
      }),
      "value" : Object.freeze({
         "type" : Object.freeze(["integer", "number", "string", "object", "boolean", "null"])
      })
   }),
   "required" : Object.freeze(["type", "value"])
});

var TYPE_VALIDATION_JSON_SCHEMAS = Object.freeze({
   'int' : Object.freeze({
      "$schema" : "http://json-schema.org/draft-04/schema#",
      "type" : "object",
      "properties" : Object.freeze({
         "value" : Object.freeze({
            "type" : Object.freeze(["integer", "null"])
         })
      }),
      "required" : Object.freeze(["value"])
   }),
   'double' : Object.freeze({
      "$schema" : "http://json-schema.org/draft-04/schema#",
      "type" : "object",
      "properties" : Object.freeze({
         "value" : Object.freeze({
            "type" : Object.freeze(["number", "null"])
         })
      }),
      "required" : Object.freeze(["value"])
   }),
   'string' : Object.freeze({
      "$schema" : "http://json-schema.org/draft-04/schema#",
      "type" : "object",
      "properties" : Object.freeze({
         "value" : Object.freeze({
            "type" : Object.freeze(["string", "null"]),
            "maxLength" : 255
         })
      }),
      "required" : Object.freeze(["value"])
   }),
   'json' : Object.freeze({
      "$schema" : "http://json-schema.org/draft-04/schema#",
      "type" : "object",
      "properties" : Object.freeze({
         "value" : Object.freeze({
            "type" : Object.freeze(["object", "null"])
         })
      }),
      "required" : Object.freeze(["value"])
   }),
   'boolean' : Object.freeze({
      "$schema" : "http://json-schema.org/draft-04/schema#",
      "type" : "object",
      "properties" : Object.freeze({
         "value" : Object.freeze({
            "type" : Object.freeze(["boolean", "null"])
         })
      }),
      "required" : Object.freeze(["value"])
   })
});


/**
 * Returns <code>true</code> if the given string is a valid property key.  For our purposes, a valid property key is:
 * <ul>
 *    <li>a string</li>
 *    <li>non empty</li>
 *    <li>starts with a letter</li>
 *    <li>consists of only letters, numbers, and underscores</li>
 * </ul>
 * @param {string} key - the datastore key to be tested
 * @returns {boolean}
 */
var isPropertyKey = function(key) {
   return isString(key) &&                                              // is defined, non-null, and a string
          key.length > 0 &&                                             // is non empty
          key.match(PROPERTY_KEY_REGEX) != null;     // contains only legal characters
};

module.exports.DATA_TYPE_TO_FIELD_NAME_MAP = DATA_TYPE_TO_FIELD_NAME_MAP;
module.exports.JSON_SCHEMA_PROPERTY_KEY = JSON_SCHEMA_PROPERTY_KEY;
module.exports.JSON_SCHEMA_PROPERTY_VALUE = JSON_SCHEMA_PROPERTY_VALUE;
module.exports.TYPE_VALIDATION_JSON_SCHEMAS = TYPE_VALIDATION_JSON_SCHEMAS;

module.exports.isPropertyKey = isPropertyKey;
module.exports.PROPERTY_KEY_REGEX_STR = PROPERTY_KEY_REGEX_STR;
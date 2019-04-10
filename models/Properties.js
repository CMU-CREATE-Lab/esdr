const PROPERTY_KEY_REGEX_STR = '^[a-zA-Z][a-zA-Z0-9_]*$';

const DATA_TYPE_TO_FIELD_NAME_MAP = Object.freeze({
                                                     "int" : "valueInt",
                                                     "double" : "valueDouble",
                                                     "string" : "valueString",
                                                     "json" : "valueJson",
                                                     "boolean" : "valueBoolean"
                                                  });

const PROPERTY_KEY_ATTRS = Object.freeze({
                                            "type" : "string",
                                            "minLength" : 1,
                                            "maxLength" : 255,
                                            "pattern" : PROPERTY_KEY_REGEX_STR
                                         });

const JSON_SCHEMA_PROPERTY_KEY = Object.freeze({
                                                  "$async" : true,
                                                  "title" : "Property Key",
                                                  "description" : "An ESDR property key",
                                                  "type" : "object",
                                                  "properties" : Object.freeze({
                                                                                  "key" : PROPERTY_KEY_ATTRS
                                                                               }),
                                                  "required" : Object.freeze(["key"])
                                               });

const JSON_SCHEMA_PROPERTY_VALUE = Object.freeze({
                                                    "$async" : true,
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

const TYPE_VALIDATION_JSON_SCHEMAS = Object.freeze({
                                                      'int' : Object.freeze({
                                                                               "$async" : true,
                                                                               "type" : "object",
                                                                               "properties" : Object.freeze({
                                                                                                               "value" : Object.freeze({
                                                                                                                                          "type" : Object.freeze(["integer", "null"])
                                                                                                                                       })
                                                                                                            }),
                                                                               "required" : Object.freeze(["value"])
                                                                            }),
                                                      'double' : Object.freeze({
                                                                                  "$async" : true,
                                                                                  "type" : "object",
                                                                                  "properties" : Object.freeze({
                                                                                                                  "value" : Object.freeze({
                                                                                                                                             "type" : Object.freeze(["number", "null"])
                                                                                                                                          })
                                                                                                               }),
                                                                                  "required" : Object.freeze(["value"])
                                                                               }),
                                                      'string' : Object.freeze({
                                                                                  "$async" : true,
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
                                                                                "$async" : true,
                                                                                "type" : "object",
                                                                                "properties" : Object.freeze({
                                                                                                                "value" : Object.freeze({
                                                                                                                                           "type" : Object.freeze(["object", "null"])
                                                                                                                                        })
                                                                                                             }),
                                                                                "required" : Object.freeze(["value"])
                                                                             }),
                                                      'boolean' : Object.freeze({
                                                                                   "$async" : true,
                                                                                   "type" : "object",
                                                                                   "properties" : Object.freeze({
                                                                                                                   "value" : Object.freeze({
                                                                                                                                              "type" : Object.freeze(["boolean", "null"])
                                                                                                                                           })
                                                                                                                }),
                                                                                   "required" : Object.freeze(["value"])
                                                                                })
                                                   });

const Ajv = require('ajv');
const ajv = new Ajv({ allErrors : true });

const typeValidators = {};
Object.keys(TYPE_VALIDATION_JSON_SCHEMAS).forEach(function(t) {
   const schema = TYPE_VALIDATION_JSON_SCHEMAS[t];
   typeValidators[t] = ajv.compile(schema);
});

module.exports.DATA_TYPE_TO_FIELD_NAME_MAP = DATA_TYPE_TO_FIELD_NAME_MAP;

module.exports.ifPropertyKeyIsValid = ajv.compile(JSON_SCHEMA_PROPERTY_KEY);
module.exports.ifPropertyValueIsValid = ajv.compile(JSON_SCHEMA_PROPERTY_VALUE);
module.exports.typeValidators = Object.freeze(typeValidators);
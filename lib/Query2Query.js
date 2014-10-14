var util = require('util');
var JSendClientValidationError = require('jsend-utils').JSendClientValidationError;
var S = require('string');

var MIN_OFFSET = 0;
var MAX_OFFSET = Number.MAX_VALUE;
var MIN_LIMIT = 1;
var DEFAULT_LIMIT = 20;

var TOKEN_SEPARATOR = ',';
var WHERE_JOIN_AND = 'AND';
var WHERE_JOIN_OR = 'OR';
var DEFAULT_WHERE_JOIN = WHERE_JOIN_AND;
var VALID_WHERE_JOINS = [WHERE_JOIN_AND, WHERE_JOIN_OR];

// allowed operators are <>, <=, >=, <, >, and =
var WHERE_OPERERATORS_REGEX = /(<>|<=|>=|<|>|=)/;

var NULL_VALUE = "__NULL__";

var DEFAULT_TOKEN_PROCESSOR = function(token) {
   return {
      field : token,
      expression : token
   };
};

function Query2Query() {

   var allowedSelectFieldsArray = [];
   var allowedSelectFields = {};
   var allowedWhereFields = {};
   var allowedOrderByFields = {};
   var allowNullValue = {};
   var dataTypes = {};

   this.addField = function(fieldName, allowWhere, allowOrderBy, canHaveNullValue, dataType) {
      if (typeof fieldName !== 'undefined' && fieldName != null) {
         if (!(fieldName in allowedSelectFields)) {
            allowedSelectFieldsArray.push(fieldName);
            allowedSelectFields[fieldName] = true;

            // record whether the field can have a null value
            allowNullValue[fieldName] = !!canHaveNullValue;

            // if the data type is defined, then see whether it's valid
            if (typeof dataType !== 'undefined' && dataType != null) {
               dataType = dataType.trim().toUpperCase();

               // check whether the requested type is valid
               if (dataType in Query2Query.types) {
                  // Don't bother recording the type for this field if it's a string--all the values will
                  // start out as strings since they come from the query string, so there's no conversion
                  // necessary
                  if (dataType != Query2Query.types.STRING) {
                     dataTypes[fieldName] = dataType
                  }
               }
               else {
                  throw new TypeError("Invalid Query2Query field data type: " + dataType);
               }
            }
         }
         if (!!allowWhere) {
            allowedWhereFields[fieldName] = true;
         }
         if (!!allowOrderBy) {
            allowedOrderByFields[fieldName] = true;
         }
      }
   };

   this.parse = function(queryString, callback, maxLimit) {
      maxLimit = Math.max(MIN_LIMIT, (maxLimit || DEFAULT_LIMIT));

      var validationErrors = [];
      var fields = arrayify(queryString.fields);
      var whereAnd = arrayify(queryString.whereAnd, true);
      var whereOr = arrayify(queryString.whereOr, true);
      var whereJoin = arrayify(queryString.whereJoin || DEFAULT_WHERE_JOIN);
      var orderBy = arrayify(queryString.orderBy);
      var offset = parseIntAndEnforceBounds(queryString.offset, MIN_OFFSET, MIN_OFFSET, MAX_OFFSET);
      var limit = parseIntAndEnforceBounds(queryString.limit, maxLimit, MIN_LIMIT, maxLimit);

      // where is a synonym for whereAnd, so just concatenate them
      whereAnd = whereAnd.concat(arrayify(queryString.where, true));

      // helper method for collecting validation errors
      var addValidationError = function(message, data) {
         validationErrors.push({message : message, data : data});
      };

      // helper methods for converting data types
      var dataTypeConverters = {};
      dataTypeConverters[Query2Query.types.INTEGER] = function(fieldName, valStr) {
         var val = S(valStr).toInt();
         if (isNaN(val)) {
            addValidationError("Failed to convert the value '" + valStr + "' of field '" + fieldName + "' to an integer");
         }
         return val;
      };
      dataTypeConverters[Query2Query.types.NUMBER] = function(fieldName, valStr) {
         var val = S(valStr).toFloat();
         if (isNaN(val)) {
            addValidationError("Failed to convert the value '" + valStr + "' of field '" + fieldName + "' to a number");
         }
         return val;
      };
      dataTypeConverters[Query2Query.types.BOOLEAN] = function(fieldName, valStr) {
         return S(valStr).toBoolean();
      };

      dataTypeConverters[Query2Query.types.DATETIME] = function(fieldName, valStr) {
         // if the string contains a colon, assume it's something that Date.parse() can handle
         var millis;
         if (S(valStr).contains(':')) {
            millis = Date.parse(valStr);
         }
         else {
            millis = S(valStr).toFloat();
         }
         if (isNaN(millis)) {
            addValidationError("Failed to convert the value '" + valStr + "' of field '" + fieldName + "' to a datetime");
            return millis;
         }

         return new Date(millis);
      };

      // validate the WHERE join
      whereJoin = whereJoin[0].toUpperCase();
      if (VALID_WHERE_JOINS.indexOf(whereJoin) < 0) {
         addValidationError("Invalid whereJoin value '" + whereJoin + "'.  Must be one of: " + VALID_WHERE_JOINS, {whereJoin : whereJoin});
      }

      // parse the SELECT fields
      var selectFields = processTokens(fields, allowedSelectFields);
      if (selectFields.length <= 0) {
         selectFields = selectFields.concat(allowedSelectFieldsArray);
      }

      // parse the WHERE expressions
      var whereExpressions = [];
      var whereValues = [];
      var processWhereExpressions = function(groups, joinTerm) {
         groups.forEach(function(expressionsGroup) {
            var expressions = expressionsGroup.split(TOKEN_SEPARATOR);
            var parsedExpressions = processTokens(expressions,
                                                  allowedWhereFields,
                                                  function(expression) {
                                                     var expressionParts = expression.split(WHERE_OPERERATORS_REGEX);
                                                     if (expressionParts.length == 3) {

                                                        var field = expressionParts[0].trim();

                                                        // first see whether this is even a field we should bother considering
                                                        if (field in allowedWhereFields) {
                                                           var operator = expressionParts[1].trim();
                                                           var value = expressionParts[2].trim();

                                                           if (value.toUpperCase() == NULL_VALUE) {
                                                              value = null;

                                                              // see whether this field's value is allowed to be null
                                                              if (allowNullValue[field]) {
                                                                 if (operator == '=') {
                                                                    operator = "IS"
                                                                 }
                                                                 else if (operator == '<>') {
                                                                    operator = "IS NOT"
                                                                 }
                                                                 else {
                                                                    addValidationError("Invalid WHERE operator '" + operator + "' when comparing with NULL.  Must be '=' or '<>'.");
                                                                 }
                                                              }
                                                              else {
                                                                 addValidationError("Field '" + field + "' cannot be compared with NULL", {field : field});
                                                              }
                                                           }
                                                           else {
                                                              // value isn't NULL, so now check whether it's of the correct data type
                                                              if (field in dataTypes) {
                                                                 value = dataTypeConverters[dataTypes[field]](field, value);
                                                              }
                                                           }

                                                           whereValues.push(value);
                                                           return {field : field, expression : "(" + [field, operator, '?'].join(' ') + ")"};
                                                        }
                                                     }
                                                     return null;
                                                  },
                                                  true);
            if (parsedExpressions.length > 0) {
               var parsedExpressionsStr = parsedExpressions.join(" " + joinTerm + " ");
               if (parsedExpressions.length == 1) {
                  whereExpressions.push(parsedExpressionsStr);
               }
               else {
                  whereExpressions.push("(" + parsedExpressionsStr + ")")
               }
            }
         });
      };
      processWhereExpressions(whereAnd, WHERE_JOIN_AND);
      processWhereExpressions(whereOr, WHERE_JOIN_OR);

      // see if there where validation errors
      if (validationErrors.length > 0) {
         return callback(new JSendClientValidationError("Query Validation Error", validationErrors));
      }

      // build the ORDER BY fields
      var orderByFields = processTokens(orderBy, allowedOrderByFields, function(token) {
         var fieldAndExpression = {
            field : token,
            expression : token
         };

         // if the token starts with a dash, then we want the expression to be "[FIELD] DESC"
         if (token.indexOf('-') == 0) {
            fieldAndExpression.field = token.slice(1).trim();   // trim off the dash, leaving us with just the field
            fieldAndExpression.expression = fieldAndExpression.field + " DESC"
         }

         return fieldAndExpression;
      });

      // finally, build the various parts of the query
      var select = selectFields.join(',');
      var selectClause = "SELECT " + select;

      var where = whereExpressions.join(' ' + whereJoin + ' ');
      var whereClause = (whereValues.length > 0) ? "WHERE " + where : '';

      var orderByStr = orderByFields.join(',');
      var orderByClause = (orderByFields.length > 0) ? "ORDER BY " + orderByStr : '';

      return callback(null, {
         select : select,
         selectClause : selectClause,
         selectFields : selectFields,

         where : where,
         whereClause : whereClause,
         whereExpressions : whereExpressions,
         whereValues : whereValues,
         whereJoin : whereJoin,

         orderBy : orderByStr,
         orderByClause : orderByClause,
         orderByFields : orderByFields,

         offset : offset,
         limit : limit,
         limitClause : "LIMIT " + offset + "," + limit,

         sql : function(tableName, willExcludeOffsetAndLimit) {
            willExcludeOffsetAndLimit = !!willExcludeOffsetAndLimit;

            var sqlParts = [this.selectClause, "FROM " + tableName, this.whereClause, this.orderByClause];
            if (!willExcludeOffsetAndLimit) {
               sqlParts.push(this.limitClause);
            }
            return sqlParts.join(' ');
         }
      });
   };

   var arrayify = function(o, willNotProcessSubTokens) {
      willNotProcessSubTokens = !!willNotProcessSubTokens;
      var argType = typeof o;
      if (argType !== 'undefined' && o != null) {
         if (util.isArray(o)) {
            // see if the array elements need to be split into tokens
            if (willNotProcessSubTokens) {
               return o;
            }
            else {
               var tokens = [];
               o.forEach(function(token) {
                  tokens = tokens.concat(token.split(TOKEN_SEPARATOR));
               });
               return tokens;
            }
         }

         if (argType === 'string') {
            return willNotProcessSubTokens ? [o] : o.split(TOKEN_SEPARATOR);
         }

         throw new Error("arrayify: Unexpected type: " + argType)
      }
      return [];
   };

   var parseIntAndEnforceBounds = function(str, defaultValue, min, max) {
      if (typeof str === 'string' || typeof str === 'number') {
         var num = parseInt(str, 10);
         num = isNaN(num) ? defaultValue : num;
         return Math.min(Math.max(min, num), max);
      }
      return defaultValue;
   };

   var processTokens = function(tokens, allowedFields, tokenProcessor, willAllowFieldMultiples) {
      // use the default token processor if undefined
      if (typeof tokenProcessor !== 'function') {
         tokenProcessor = DEFAULT_TOKEN_PROCESSOR;
      }

      willAllowFieldMultiples = !!willAllowFieldMultiples;

      // array for storing the created expressions
      var expressions = [];

      // the map helps us keep track of which fields we've already considered (we don't want to allow dupes)
      var fieldMap = {};

      // process the tokens into expressions
      tokens.forEach(function(token) {
         token = token.trim();
         if (token.length > 0) {
            // process the token into the base field and the associated expression
            var fieldAndExpression = tokenProcessor(token);

            if (fieldAndExpression) {
               // get the field
               var field = fieldAndExpression.field;

               // have we already considered this field?
               if (willAllowFieldMultiples || !(field in fieldMap)) {
                  // is this an allowed field?
                  if (field in allowedFields) {
                     expressions.push(fieldAndExpression.expression);
                  }

                  // remember this field so we don't consider it again if willAllowFieldMultiples is false
                  fieldMap[field] = true;
               }
            }
         }
      });

      return expressions;
   };
}

Query2Query.types = {
   INTEGER : 'INTEGER',
   NUMBER : 'NUMBER',
   STRING : 'STRING',
   DATETIME : 'DATETIME',
   BOOLEAN : 'BOOLEAN'
};

module.exports = Query2Query;
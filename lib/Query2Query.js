var util = require('util');
var log = require('log4js').getLogger();
var JSendClientValidationError = require('../lib/jsend').JSendClientValidationError;

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

   var schema = {
      "$schema" : "http://json-schema.org/draft-04/schema#",
      "type" : "object",
      "properties" : {}
   };

   this.addField = function(fieldName, allowWhere, allowOrderBy) {
      if (typeof fieldName !== 'undefined' && fieldName != null) {
         if (!(fieldName in allowedSelectFields)) {
            allowedSelectFieldsArray.push(fieldName);
            allowedSelectFields[fieldName] = true;
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

      var fields = arrayify(queryString.fields);
      var where = arrayify(queryString.where, true);
      var whereAnd = arrayify(queryString.whereAnd, true);
      var whereOr = arrayify(queryString.whereOr, true);
      var whereJoin = arrayify(queryString.whereJoin || DEFAULT_WHERE_JOIN);
      var orderBy = arrayify(queryString.orderBy);
      var offset = parseIntAndEnforceBounds(queryString.offset, MIN_OFFSET, MIN_OFFSET, MAX_OFFSET);
      var limit = parseIntAndEnforceBounds(queryString.limit, maxLimit, MIN_LIMIT, maxLimit);

      // where is a synonym for whereAnd, so just concatenate them
      whereAnd = where.concat(whereAnd);

      // validate the WHERE join
      whereJoin = whereJoin[0].toUpperCase();
      if (VALID_WHERE_JOINS.indexOf(whereJoin) < 0) {
         return callback(new JSendClientValidationError("Invalid whereJoin value.  Must be 'and' or 'or'.", {whereJoin : whereJoin}));
      }

      // parse the SELECT fields
      var selectFields = processTokens(fields, allowedSelectFields);

      // parse the WHERE clasues
      var whereClauses = [];
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
                                                              var operator = expressionParts[1];
                                                              var value = expressionParts[2];

                                                              if ((value.toUpperCase() == NULL_VALUE) && (operator == '=' || operator == '<>')) {
                                                                 if (operator == '=') {
                                                                    operator = "IS"
                                                                 }
                                                                 else {
                                                                    operator = "IS NOT"
                                                                 }
                                                                 value = null;
                                                              }

                                                              whereValues.push(value);
                                                              return {field : field, expression : "(" + [field, operator, '?'].join(' ') + ")"};
                                                           }
                                                        }
                                                        return null;
                                                     },
                                                     true);
               whereClauses.push("(" + parsedExpressions.join(" " + joinTerm + " ") + ")")
            });
         };
      processWhereExpressions(whereAnd, WHERE_JOIN_AND);
      processWhereExpressions(whereOr, WHERE_JOIN_OR);

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

      return callback(null, {
         select : selectFields.join(',') || allowedSelectFieldsArray.join(','),
         selectFields : selectFields,
         orderBy : orderByFields.join(','),
         orderByFields : orderByFields,
         where : whereClauses.join(' ' + whereJoin + ' '),
         whereClauses : whereClauses,
         whereJoin : whereJoin,
         whereValues : whereValues,
         offset : offset,
         limit : limit,
         sql : function(tableName, willExcludeOffsetAndLimit){
            willExcludeOffsetAndLimit = !!willExcludeOffsetAndLimit;
            var sql = "SELECT " + this.select + " FROM " + tableName;
            if (this.where) {
               sql += " WHERE " + this.where;
            }
            if (this.orderBy) {
               sql += " ORDER BY " + this.orderBy;
            }
            if (!willExcludeOffsetAndLimit) {
               sql += " LIMIT " + this.offset + "," + this.limit
            }
            return sql;
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

module.exports = Query2Query;
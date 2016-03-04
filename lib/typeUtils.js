const POSITIVE_INTEGER_PATTERN = /^[1-9]\d*$/;
const FEED_API_KEY_REGEX = /^[a-f0-9]{64}$/i;

/**
 * Returns <code>true</code> if the given value is an integer, or can be parsed as an integer
 * @param {*} value
 * @return {boolean}
 */
var isInt = function(value) {
   // Got this from http://stackoverflow.com/a/14794066
   return !isNaN(value) && (function(x) { return (x | 0) === x; })(parseFloat(value))
};

/**
 * Returns <code>true</code> if the given value is a string; returns <code>false</code> otherwise.
 *
 * @param {*} o
 * @return {boolean}
 */
var isString = function(o) {
   // Got this from http://stackoverflow.com/a/9436948/703200
   return (typeof o == 'string' || o instanceof String)
};

/**
 * Performs strict tests to ensure the given string represents a positive integer.
 *
 * @param {string} n
 * @returns {boolean}
 */

var isPositiveIntString = function(n) {
   if (typeof n !== 'undefined' && n != null && isString(n)) {
      return POSITIVE_INTEGER_PATTERN.test(n) && String(parseInt(n)) === n;
   }
   return false;
};

/**
 * Returns <code>true</code> if the given value is a string and is the proper length and character set to be a Feed API Key.
 * @param {string} str
 * @return {boolean}
 */
var isFeedApiKey = function(str) {
   return (isString(str) && FEED_API_KEY_REGEX.test(str));
};

module.exports.isInt = isInt;
module.exports.isString = isString;
module.exports.isPositiveIntString = isPositiveIntString;
module.exports.isFeedApiKey = isFeedApiKey;
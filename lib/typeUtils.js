const isString = require('data-type-utils').isString;

const POSITIVE_INTEGER_PATTERN = /^[1-9]\d*$/;
const FEED_API_KEY_REGEX = /^[a-f0-9]{64}$/i;

/**
 * Performs strict tests to ensure the given value is a string and represents a positive integer.
 *
 * @param {string} n
 * @returns {boolean}
 */
const isPositiveIntString = function(n) {
   if (isString(n)) {
      return POSITIVE_INTEGER_PATTERN.test(n) && String(parseInt(n)) === n;
   }
   return false;
};

/**
 * Returns <code>true</code> if the given value is a string and is the proper length and character set to be a Feed API Key.
 * @param {string} str
 * @return {boolean}
 */
const isFeedApiKey = function(str) {
   return (isString(str) && FEED_API_KEY_REGEX.test(str));
};

module.exports.isPositiveIntString = isPositiveIntString;
module.exports.isFeedApiKey = isFeedApiKey;

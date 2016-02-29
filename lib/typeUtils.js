/**
 * Returns <code>true</code> if the given value is an integer, or can be parsed as an integer
 * @param {*} value
 * @return {boolean}
 */
module.exports.isInt = function(value) {
   // Got this from http://stackoverflow.com/a/14794066
   return !isNaN(value) && (function(x) { return (x | 0) === x; })(parseFloat(value))
};

/**
 * Returns <code>true</code> if the given value is a string; returns <code>false</code> otherwise.
 *
 * @param {*} o
 * @return {boolean}
 */
module.exports.isString = function(o) {
   // Got this from http://stackoverflow.com/a/9436948/703200
   return (typeof o == 'string' || o instanceof String)
};

var crypto = require('crypto');

/**
 * Creates a random token consisting of <code>numBytes</code> bytes in hexidecimal. Since 1 byte in hex is represented
 * by 2 characters, the returned string will be <code>2 * numBytes</code> characters long.
 *
 * @param {int} numBytes the size in bytes of the generated token.
 */
module.exports.createRandomHexToken = function(numBytes) {
   return crypto.randomBytes(numBytes).toString('hex');
};

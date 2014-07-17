/**
 * If a property with the given <code>propertyName</code> exists in the given <code>srcObj</code>, then its value is
 * trimmed and copied to the given <code>destObj</code>.
 *
 * @param {object} srcObj the source object
 * @param {object} destObj the destination object
 * @param {string} propertyName the name of the property to be trimmed and copied
 */
module.exports.trimAndCopyPropertyIfNonEmpty = function(srcObj, destObj, propertyName) {
   if (srcObj[propertyName]) {
      var trimmedVal = srcObj[propertyName].trim();
      if (trimmedVal.length > 0) {
         destObj[propertyName] = trimmedVal;
      }
   }
};

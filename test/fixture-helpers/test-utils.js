var shallowClone = function(obj) {
   if (obj) {
      var clone = {};
      Object.keys(obj).forEach(function(key) {
         clone[key] = obj[key];
      });
      return clone;
   }
   return obj;
};

module.exports.shallowClone = shallowClone;
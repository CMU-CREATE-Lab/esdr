//======================================================================================================================
// VERIFY NAMESPACE
//======================================================================================================================
// Create the global symbol "org" if it doesn't exist.  Throw an error if it does exist but is not an object.
var org;
if (!org) {
   org = {};
}
else {
   if (typeof org != "object") {
      var orgExistsMessage = "Error: failed to create org namespace: org already exists and is not an object";
      alert(orgExistsMessage);
      throw new Error(orgExistsMessage);
   }
}

if (!org.cmucreatelab) {
   org.cmucreatelab = {};
}
else {
   if (typeof org.cmucreatelab != "object") {
      var orgCmucreatelabExistsMessage = "Error: failed to create org.cmucreatelab namespace: org.cmucreatelab already exists and is not an object";
      alert(orgCmucreatelabExistsMessage);
      throw new Error(orgCmucreatelabExistsMessage);
   }
}

if (!org.cmucreatelab.esdr) {
   org.cmucreatelab.esdr = {};
}
else {
   if (typeof org.cmucreatelab.esdr != "object") {
      var orgCmucreatelabEsdrExistsMessage = "Error: failed to create org.cmucreatelab.esdr namespace: org.cmucreatelab.esdr already exists and is not an object";
      alert(orgCmucreatelabEsdrExistsMessage);
      throw new Error(orgCmucreatelabEsdrExistsMessage);
   }
}
//======================================================================================================================
// DEPENDECIES
//======================================================================================================================
if (!window['$']) {
   var nojQueryMsg = "The jQuery library is required by org.cmucreatelab.esdr.Messages.js";
   alert(nojQueryMsg);
   throw new Error(nojQueryMsg);
}
//======================================================================================================================

(function() {

   org.cmucreatelab.esdr.Messages = function() {
      var messages = [];

      this.render = function(containerElement) {
         if (messages.length > 0) {
            containerElement.empty();
            messages.forEach(function(message) {
               containerElement.append('<div>' + message + '</div>');
            });
            containerElement.show();
         }
      };

      this.add = function(message) {
         if (message) {
            messages.push(message);
         }
      };

      this.isEmpty = function() {
         return messages.length == 0;
      };
   };

})();

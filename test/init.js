// sanity check before doing anything else--make sure we're running in test mode!
if (!require('run-mode').isTest()) {
   console.log("FATAL ERROR: Tests must be run in the 'test' Node environment (NODE_ENV=test). Aborting.");
   process.exit(1);
}

const Database = require("../models/Database");

global.db = null;

before("Initializing the database", function(initDone) {

   // this makes sure the database and tables exist
   Database.create(function(err, theDatabase) {
      if (err) {
         throw err;
      }
      global.db = theDatabase;

      initDone();
   });
});

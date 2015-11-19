// sanity check: make sure we're running in test mode!
if (!require('run-mode').isTest()) {
   console.log("FATAL ERROR: the database fixture library may only be used in the 'test' Node environment (NODE_ENV=test). Aborting.");
   process.exit(1);
}

var mysql = require('mysql');
var flow = require('nimble');
var DatabaseHelper = require("../../models/DatabaseHelper");
var config = require('../../config');

var log4js = require('log4js');
log4js.configure('log4js-config-test.json');
var log = log4js.getLogger('esdr:test:fixture-helpers:database');

var databaseHelper = new DatabaseHelper(mysql.createPool({
                                                            connectionLimit : config.get("database:pool:connectionLimit"),
                                                            host : config.get("database:host"),
                                                            port : config.get("database:port"),
                                                            database : config.get("database:database"),
                                                            user : config.get("database:username"),
                                                            password : config.get("database:password")
                                                         }));

var createDeleteAllRowsFromTableFunction = function(tableName, sql) {
   sql = sql || "DELETE FROM " + tableName;
   return function(done) {
      log.trace("Wiping table: " + tableName);
      databaseHelper.execute(sql, null, done);
   };
};

var wipeTableCommands = [];
wipeTableCommands.push(createDeleteAllRowsFromTableFunction("Multifeeds"));
wipeTableCommands.push(createDeleteAllRowsFromTableFunction("Feeds"));
wipeTableCommands.push(createDeleteAllRowsFromTableFunction("Devices"));
wipeTableCommands.push(createDeleteAllRowsFromTableFunction("Products"));
wipeTableCommands.push(createDeleteAllRowsFromTableFunction("Tokens"));
wipeTableCommands.push(createDeleteAllRowsFromTableFunction("Clients", "DELETE FROM Clients WHERE clientName <> 'ESDR'"));
wipeTableCommands.push(createDeleteAllRowsFromTableFunction("Users"));

function wipeAllTables(callback) {
   flow.series(wipeTableCommands, function() {
      log.trace("Database tables erased.");
      callback();
   });
}

module.exports.wipeAllTables = wipeAllTables;

module.exports.insertUser = function(user, callback) {
   databaseHelper.execute("INSERT INTO Users SET ?", user, callback);
};

module.exports.insertProduct = function(product, callback) {
   databaseHelper.execute("INSERT INTO Products SET ?", product, callback);
};

module.exports.insertDevice = function(device, callback) {
   databaseHelper.execute("INSERT INTO Devices SET ?", device, callback);
};

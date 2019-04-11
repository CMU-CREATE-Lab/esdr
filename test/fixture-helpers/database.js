// sanity check: make sure we're running in test mode!
if (!require('run-mode').isTest()) {
   console.log("FATAL ERROR: the database fixture library may only be used in the 'test' Node environment (NODE_ENV=test). Aborting.");
   process.exit(1);
}

const mysql = require('mysql');
const flow = require('nimble');
const bcrypt = require('bcrypt');
const DatabaseHelper = require("../../models/DatabaseHelper");
const config = require('../../config');

const log4js = require('log4js');
log4js.configure('log4js-config-test.json');
const log = log4js.getLogger('esdr:test:fixture-helpers:database');

const databaseHelper = new DatabaseHelper(mysql.createPool({
                                                              connectionLimit : config.get("database:pool:connectionLimit"),
                                                              host : config.get("database:host"),
                                                              port : config.get("database:port"),
                                                              database : config.get("database:database"),
                                                              user : config.get("database:username"),
                                                              password : config.get("database:password")
                                                           }));

const createDeleteAllRowsFromTableFunction = function(tableName, sql) {
   sql = sql || "DELETE FROM " + tableName;
   return function(done) {
      log.trace("Wiping table: " + tableName);
      databaseHelper.execute(sql, null, done);
   };
};

const wipeTableCommands = [];
wipeTableCommands.push(createDeleteAllRowsFromTableFunction("MirrorRegistrations"));
wipeTableCommands.push(createDeleteAllRowsFromTableFunction("Multifeeds"));
wipeTableCommands.push(createDeleteAllRowsFromTableFunction("FeedProperties"));
wipeTableCommands.push(createDeleteAllRowsFromTableFunction("Feeds"));
wipeTableCommands.push(createDeleteAllRowsFromTableFunction("DeviceProperties"));
wipeTableCommands.push(createDeleteAllRowsFromTableFunction("Devices"));
wipeTableCommands.push(createDeleteAllRowsFromTableFunction("Products"));
wipeTableCommands.push(createDeleteAllRowsFromTableFunction("Tokens"));
wipeTableCommands.push(createDeleteAllRowsFromTableFunction("UserProperties"));
wipeTableCommands.push(createDeleteAllRowsFromTableFunction("Clients", "DELETE FROM Clients WHERE clientName <> 'ESDR'"));
wipeTableCommands.push(createDeleteAllRowsFromTableFunction("Users"));

function wipeAllTables(callback) {
   flow.series(wipeTableCommands, function() {
      log.trace("Database tables erased.");
      callback();
   });
}

module.exports.wipeAllTables = wipeAllTables;

module.exports.insertClient = function(client, callback) {
   // remember the plain-text clientSecret so we can set it back
   const plainTextClientSecret = client.clientSecret;

   // encrypt the clientSecret for storage in the DB
   client.clientSecret = bcrypt.hashSync(plainTextClientSecret, 8);

   // insert the client, then reset the clientSecret back to the plain-text one
   databaseHelper.execute("INSERT INTO Clients SET ?", client, function(err, result) {
      client.clientSecret = plainTextClientSecret;
      callback(err, result);
   });
};

module.exports.insertUser = function(user, callback) {
   // remember the plain-text password so we can set it back
   const plainTextPassword = user.password;

   // encrypt the password for storage in the DB
   user.password = bcrypt.hashSync(plainTextPassword, 8);

   // insert the user, then reset the password back to the plain-text one
   databaseHelper.execute("INSERT INTO Users SET ?", user, function(err, result) {
      user.password = plainTextPassword;
      callback(err, result);
   });
};

module.exports.insertProduct = function(product, callback) {
   if (typeof product.defaultChannelSpecs === 'object') {
      product.defaultChannelSpecs = JSON.stringify(product.defaultChannelSpecs);
   }
   databaseHelper.execute("INSERT INTO Products SET ?", product, callback);
};

module.exports.insertDevice = function(device, callback) {
   databaseHelper.execute("INSERT INTO Devices SET ?", device, callback);
};

module.exports.insertFeed = function(feed, callback) {
   databaseHelper.execute("INSERT INTO Feeds SET ?", feed, callback);
};

module.exports.deleteFeed = function(feedId, callback) {
   databaseHelper.execute("DELETE FROM Feeds WHERE id=?", feedId, callback);
};

module.exports.insertMultifeed = function(feed, callback) {
   databaseHelper.execute("INSERT INTO Multifeeds SET ?", feed, callback);
};

module.exports.expireAccessToken = function(accessToken, callback) {
   // set the new creation date such that the token will have expired 24 hours ago
   const newCreatedDate = new Date(Date.now() - (86400 + config.get("security:tokenLifeSecs")) * 1000);
   databaseHelper.execute("UPDATE Tokens SET created=? WHERE accessToken=?", [newCreatedDate, accessToken], callback);
};

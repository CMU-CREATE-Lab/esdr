module.exports.UserSchema = {
   "$schema" : "http://json-schema.org/draft-04/schema#",
   "title" : "User",
   "description" : "A cattfish.com user",
   "type" : "object",
   "properties" : {
      "username" : {
         "type" : "string",
         "minLength" : 5
      },
      "password" : {
         "type" : "string",
         "minLength" : 5
      },
      "email" : {
         "type" : "string",
         "minLength" : 5,
         "format" : "email"
      }
   },
   "required" : ["username", "password", "email"]
};
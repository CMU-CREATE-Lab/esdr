To run these tests, do the following first:

1) In mysql, execute the following to create the test database and esdr user:

      CREATE DATABASE IF NOT EXISTS esdr_test;
      GRANT ALL PRIVILEGES ON esdr_test.* To 'esdr'@'localhost' IDENTIFIED BY 'password';
      GRANT SELECT,INSERT,UPDATE,DELETE,CREATE ON esdr_test.* TO 'esdr'@'localhost';

2) Run the server in test mode, like this:

      NODE_ENV=test npm start

   In test mode, the server runs on port 3001, so make sure you don't have anything else
   running on that port.

3) Run the tests:

      npm test
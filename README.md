Environmental Sensor Data Repository (ESDR)
===========================================

The ESDR web site.

Setup
=====

1. Install the module dependencies:

        npm install
    
2. Do the following to create the MySQL database and user:

        CREATE DATABASE IF NOT EXISTS esdr;
        GRANT ALL PRIVILEGES ON esdr.* To 'esdr'@'localhost' IDENTIFIED BY 'password';
        GRANT SELECT,INSERT,UPDATE,DELETE,CREATE ON esdr.* TO 'esdr'@'localhost';

    Make sure the password you specify matches the password in the config JSON.

3. If you want to run the tests, do the following to create the test database and user:

        CREATE DATABASE IF NOT EXISTS esdr_test;
        GRANT ALL PRIVILEGES ON esdr_test.* To 'esdr'@'localhost' IDENTIFIED BY 'password';
        GRANT SELECT,INSERT,UPDATE,DELETE,CREATE ON esdr_test.* TO 'esdr'@'localhost';

    Again, make sure the password you specify matches the password in the `config-test.json`.

Run
===

To run the server in development mode, do:

    npm start
    
To run the server in test mode, do:

    NODE_ENV=test npm start
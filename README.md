Environmental Sensor Data Repository (ESDR)
===========================================

The ESDR web site.

Setup
=====

1. Install the module dependencies:

        npm install
    
2. Install the BodyTrack Datastore by doing the following

    1. Fetch the BodyTrack Datastore. In your terminal window, set your working directory to the root of the ESDR repository and do the following:
               
               git clone https://github.com/BodyTrack/datastore.git
       
    2. Follow the BodyTrack Datastore's build and install instructions.

3. Install MySQL if necessary.  ESDR was tested with and assumes MySQL 5.6 (there are known issues with 5.5).

4. Do the following to create the development MySQL database and user:

        CREATE DATABASE IF NOT EXISTS esdr_dev;
        GRANT ALL PRIVILEGES ON esdr_dev.* To 'esdr_dev'@'localhost' IDENTIFIED BY 'password';
        GRANT SELECT,INSERT,UPDATE,DELETE,CREATE ON esdr_dev.* TO 'esdr_dev'@'localhost';

    If you choose to change the password, make sure it matches the password in `config-dev.json`.

5. If you want to be able to run the tests, do the following to create the test database and user:

        CREATE DATABASE IF NOT EXISTS esdr_test;
        GRANT ALL PRIVILEGES ON esdr_test.* To 'esdr_test'@'localhost' IDENTIFIED BY 'password';
        GRANT SELECT,INSERT,UPDATE,DELETE,CREATE ON esdr_test.* TO 'esdr_test'@'localhost';

    If you choose to change the password, make sure it matches the password in `config-test.json`.

6. If running in production, dow the following:

    1. Create the `config-prod.json` and `mail-config-prod.json` files. Just copy from the other configs, but you need only include the parts that differ from `config.js`.

    2. Do the following to create the production database and user:
                                    
            CREATE DATABASE IF NOT EXISTS esdr_prod;
            GRANT ALL PRIVILEGES ON esdr_prod.* To 'esdr_prod'@'localhost' IDENTIFIED BY 'USE_A_GOOD_PASSWORD_HERE';
            GRANT SELECT,INSERT,UPDATE,DELETE,CREATE ON esdr_prod.* TO 'esdr_prod'@'localhost';

        Again, make sure the user and password you specify matches those in `config-prod.json`.

7. Make sure the datastore data directory defined in the config file exists.

Run
===

The `NODE_ENV` environment variable may be specified when running, and must be one of `dev`, `development`, `test`, `prod`, or `production`. Defaults to `dev` if unspecified.

To run the server in development mode, do any of the following:

    npm start
    NODE_ENV=dev npm start
    NODE_ENV=development npm start

To run the server in test mode, do:

    NODE_ENV=test npm start
    
To run the server in production mode, do either of the following:

    NODE_ENV=prod npm start
    NODE_ENV=production npm start

Development
===========
To generate the CSS from the SCSS template, do:

    npm run-script gen-css


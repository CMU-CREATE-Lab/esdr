# MySQL Backup Script

You must specify both the MySQL database name and a login-path when invoking this script.

## Usage

General usage is:

```shell
./mysql-backup.sh DATABASE_NAME LOGIN_PATH
```

The login-path must already have been predefined with a command like this:

```shell
mysql_config_editor set --host=localhost --user=USERNAME --password --login-path=SOME_NAME_OF_YOUR_CHOOSING
```

For example, to save a login-path named `esdr_backup_script` for the root user, you would do:

```shell
mysql_config_editor set --host=localhost --user=root --password --login-path=esdr_backup_script
```

The `mysql_config_editor` command will prompt you for a password, and then save the host, username, and password under the login-path name `esdr_backup_script` in the file `~/.mylogin.cnf`.

You would then invoke this script to backup the `esdr_prod` database like this:

```shell
./mysql-backup.sh esdr_prod esdr_backup_script
```

Note that the `~/.mylogin.cnf` file's contents are obfuscated, and permissions set to readable only by the user, so it should be safe enough.

See here for more info: https://dev.mysql.com/doc/refman/5.7/en/mysql-config-editor.html

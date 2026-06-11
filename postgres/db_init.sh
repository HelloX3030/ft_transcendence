#!/bin/bash

# set -e

for db in $DB_TEST_NAME $DB_NAME
do
  psql --username $DB_USER <<-EOSQL
    CREATE DATABASE $db;
EOSQL
done
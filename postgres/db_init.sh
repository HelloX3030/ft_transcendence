#!/bin/sh
set -e

psql --username "$POSTGRES_USER" <<-EOSQL
CREATE DATABASE $DB_TEST_NAME;
EOSQL
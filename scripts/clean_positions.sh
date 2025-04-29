#!/bin/bash

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Execute the SQL script using psql
psql -h localhost -U postgres -d locateme -c "\i ${SCRIPT_DIR}/clean_positions.sql"

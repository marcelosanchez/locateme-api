#!/bin/bash
psql -U postgres -d locateme -c "\i /var/www/locateme/locateme-api/scripts/clean_positions.sql"

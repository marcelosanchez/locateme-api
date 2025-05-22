const { Pool } = require('pg')
const pool = new Pool() // use default connection settings

module.exports = { pool }
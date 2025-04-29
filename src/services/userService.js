const pool = require('../db');

/**
 * Finds user by google_id
 * If not found, creates a new user with email and google_id
 * @param {Object} profile - Google profile
 * @returns {Object} found or newly created user
 */
async function findOrCreateUser(profile) {
  const { id: googleId, emails } = profile;
  const email = emails && emails.length > 0 ? emails[0].value : null;

  if (!email || !googleId) {
    throw new Error('Google profile is missing required information.');
  }

  try {
    // Search for an existing user
    const { rows } = await pool.query(
      'SELECT * FROM users WHERE google_id = $1',
      [googleId]
    );

    if (rows.length > 0) {
      console.log('[AUTH] Existing user found:', email);
      return rows[0];
    }

    // If user does not exist, create a new one
    const { rows: insertedRows } = await pool.query(
      `INSERT INTO users (email, google_id)
       VALUES ($1, $2)
       RETURNING *`,
      [email, googleId]
    );

    console.log('[AUTH] New user created:', email);
    return insertedRows[0];

  } catch (err) {
    console.error('[AUTH ERROR]', err);
    throw err;
  }
}

module.exports = {
  findOrCreateUser,
};

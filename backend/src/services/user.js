const { getDBPool } = require('../database/getDBPool')

exports.ensureUser = async ({ sub, email, username, firstname, lastname }) => {
  const pool = await getDBPool();
  await pool.query(`CREATE TABLE IF NOT EXISTS users(
                  id UUID PRIMARY KEY,
                  username VARCHAR(100) NOT NULL,
                  first_name VARCHAR(50) NOT NULL,
                  last_name VARCHAR(50) NOT NULL,
                  email VARCHAR(100) UNIQUE NOT NULL,
                  created_at TIMESTAMP DEFAULT now())`);
  const { rows } = await pool.query(`INSERT INTO users (id, username, email, first_name, last_name)
                          VALUES ($1, $2, $3, $4, $5)
                          RETURNING id, username, email, created_at`,
    [sub, username, email, firstname, lastname]);
  return rows[0];
};

exports.getUserRole = async (sub) => {
  const pool = await getDBPool();
  try {
    const { rows } = await pool.query(`
            SELECT
            EXISTS (SELECT 1 FROM artists    WHERE user_id = $1) AS is_artist,
            EXISTS (SELECT 1 FROM collector WHERE user_id = $1) AS is_collector`, [sub]);

    const { is_artist, is_collector } = rows[0];
    const roles = ['user'];
    if (is_artist) roles.push('artist');
    if (is_collector) roles.push('collector');

    return { message: roles, status: 200 };
  } catch (error) {
    console.warn(error);
    return { message: error.sqlMessage ? error.sqlMessage : error.message, status: 406 };
  }
};

exports.getUserAction = async (artworkID, sub) => {
  const pool = await getDBPool();
  const sql = `SELECT
                EXISTS (SELECT 1
                        FROM artwork ar 
                        WHERE ar.artwork_id = $1
                          AND ar.artists_id = $2
                          AND ar.authenticated = false) AS "canAuthenticate",
                EXISTS (SELECT 1
                        FROM artwork ar 
                        WHERE ar.artwork_id = $1
                          AND ar.owner_id = $2
                          AND ar.verified = false) AS "canVerify"`;
  const values = [artworkID, sub];
  try {

    const { rows } = await pool.query(sql, values);

    const { canAuthenticate, canVerify } = rows[0]
    const action = { canAuthenticate, canVerify };

    return { message: action, status: 200 };

  } catch (error) {
    console.warn(error);
    return { message: error.sqlMessage ? error.sqlMessage : error.message, status: 406 };
  }
}
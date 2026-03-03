// const awsCaBundle = require('aws-ssl-profiles');
const { Pool, Client } = require('pg');
// const { getAWSsecret } = require("../utils/awsGetSecret.js");
const {
  target_env,
  POSTGRES_HOST,
  POSTGRES_DB,
  POSTGRES_USER,
  POSTGRES_PORT,
  POSTGRES_PASSWORD,
  POSTGRES_waitForConnections,
  POSTGRES_connectionLimit,
  POSTGRES_maxIdle,
  POSTGRES_idleTimeout,
  POSTGRES_queueLimit,
  POSTGRES_aws_secretId
} = require('../config.js');

let pool;

async function getDBPool() {
  // Defence - we don't want to create it again
  if (global.pool !== undefined) {
    // Verify the pool is still connected
    let client;
    try {
      client = await global.pool.connect();

      // Test connection with a simple query instead of ping
      await client.query('SELECT 1');
      console.log('Pool connection is healthy');

      client.release();
      return global.pool;
    } catch (error) {
      console.warn('Pool connection test failed: DB connection is not working.\nTry to reestablish the connection.', error);

      try {
        if (client !== undefined) {
          client.release();
        }
        await global.pool.end();
      } catch (endError) {
        // We don't care about this error
        console.log('Error while ending the pool:', endError);
      }

      global.pool = undefined;
    }
  }

  let awsIdentity;

  // First we need to check if we connect to an AWS resource
  if (POSTGRES_aws_secretId !== undefined) {
    // Let's get the AWS Secret.
    // TODO: remove this throw
    throw new Error('AWS secret is not supported yet');
    // try{
    //   awsIdentity = await getAWSsecret(POSTGRES_aws_secretId);
    // } catch(error){
    //   console.error(error);
    //   throw error;
    // }
  }
  // else {
  //   // The following ENVs must use an AWS secret
  //   const allowedEnvironments = ['DEV', 'TEST', 'PROD'];
  //   if (allowedEnvironments.includes(target_env)) {
  //     const msg = `Target_env: ${target_env} must use an AWS secret for DB connection`;
  //     console.error(msg);
  //     throw new Error(msg);
  //   }
  // }

  try {
    let options = {
      host: POSTGRES_HOST,
      port: POSTGRES_PORT,
      user: POSTGRES_USER,
      password: POSTGRES_PASSWORD,
      database: POSTGRES_DB,
      // PostgreSQL-specific pool options
      max: POSTGRES_connectionLimit || 20,  // Maximum number of clients in pool
      idleTimeoutMillis: POSTGRES_idleTimeout || 30000,  // How long a client is allowed to remain idle
      connectionTimeoutMillis: 30000,  // How long to wait when connecting a new client
      maxUses: 7500, // Maximum number of times to use a connection before closing
      allowExitOnIdle: false // Allow the pool to close connections and exit when all clients are idle
    };

    // if (awsIdentity !== undefined) {
    //   // We are always using SSL to connect to AWS RDS.
    //   options.ssl = awsCaBundle;
    // }

    const retval = new Pool(options);

    // Test the connection
    // const result = await retval.query('SELECT * FROM artwork LIMIT 1');
    // console.log('Connection test successful, found', result.rows.length, 'artwork records');

    global.pool = retval;
    return global.pool;
  } catch (error) {
    console.error('Error creating database pool:', error);
    throw error;
  }
}

/**
 * Get a client connection from the pool for transaction support
 * Use this when you need transaction control (BEGIN, COMMIT, ROLLBACK)
 */
async function getDBConnection() {
  const pool = await getDBPool();
  return await pool.connect();
}

/**
 * Execute a query without transaction support
 * Use this for simple queries that don't need transactions
 */
async function query(text, params) {
  const pool = await getDBPool();
  return await pool.query(text, params);
}

module.exports = {
  getDBPool,
  getDBConnection,
  query
};
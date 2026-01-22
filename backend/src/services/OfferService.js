const { getDBPool, getDBConnection } = require('../database/getDBPool.js');
const { limitOffsetGuardCheck } = require('../utils/limitOffsetGuardCheck.js');
const { idGuardCheck, } = require('../utils/variableGuardCheck.js');
const { getS3Url, uploadToS3, deleteFromS3 } = require('../utils/s3Bucket.js');
/**
 * Creates offer entity
 * This operation creates an offer entity.
 *
 * body Offer Offer object that needs to be added (optional)
 * returns Offer
 **/
exports.postOffer = async function (artworkID, body, sub) {
  const response = await postOfferDB(artworkID, body, sub);

  if (response.status === 200) {
    return new Promise(function (resolve, reject) {
      resolve({ message: response.message, status: response.status });
    });
  }
  else {
    return new Promise(function (resolve, reject) {
      reject({ message: response.message, status: response.status });
    });
  }
}

/**
 * List or find offer objects related to ID
 * List or find offer objects 
 *
 * returns Offer
 **/
exports.listOffers = async function (artworkID, offset, limit) {
  // Input guard for limit and offset
  const limitCheck = limitOffsetGuardCheck(limit, offset);

  if (limitCheck.status != 200) {
    return new Promise(function (resolve, reject) {
      reject(limitCheck);
    });
  }
  const response = await listOffersDB(artworkID, limitCheck.message.limit, limitCheck.message.offset);

  if (response.status === 200) {
    return new Promise(function (resolve, reject) {
      resolve({ message: response.message, status: response.status });
    });
  }
  else {
    return new Promise(function (resolve, reject) {
      reject({ message: response.message, status: response.status });
    });
  }
}

exports.listSentOffers = async function (sub, offset, limit) {
  // Input guard for limit and offset
  const limitCheck = limitOffsetGuardCheck(limit, offset);

  if (limitCheck.status != 200) {
    return new Promise(function (resolve, reject) {
      reject(limitCheck);
    });
  }
  const response = await listSentOffersDB(sub, limitCheck.message.limit, limitCheck.message.offset);

  if (response.status === 200) {
    return new Promise(function (resolve, reject) {
      resolve({ message: response.message, status: response.status });
    });
  }
  else {
    return new Promise(function (resolve, reject) {
      reject({ message: response.message, status: response.status });
    });
  }
}

exports.listReceivedOffers = async function (sub, offset, limit) {
  // Input guard for limit and offset
  const limitCheck = limitOffsetGuardCheck(limit, offset);

  if (limitCheck.status != 200) {
    return new Promise(function (resolve, reject) {
      reject(limitCheck);
    });
  }
  const response = await listReceivedOffersDB(sub, limitCheck.message.limit, limitCheck.message.offset);

  if (response.status === 200) {
    return new Promise(function (resolve, reject) {
      resolve({ message: response.message, status: response.status });
    });
  }
  else {
    return new Promise(function (resolve, reject) {
      reject({ message: response.message, status: response.status });
    });
  }
}


/**
 * Updates an offer object
 * Updates the status of an offer object
 *
 * returns Offer
 **/
exports.putOffer = async function (offerID, status) {
  const response = await putOfferDB(offerID, status);

  if (response.status === 202) {
    if (status === 'accepted') {
      const transaction = await processTransaction(offerID);
      if (transaction.status === 202) {
        return new Promise(function (resolve, reject) {
          resolve({ message: response.message, status: response.status });
        });
      }
      else {
        return new Promise(function (resolve, reject) {
          reject({ message: transaction.message, status: transaction.status }); // <- FIX: Use transaction.status instead of response.status
        });
      }
    }
    if (response.status === 202) {
      return new Promise(function (resolve, reject) {
        resolve({ message: response.message, status: response.status });
      });
    }
  }
  else {
    return new Promise(function (resolve, reject) {
      reject({ message: response.message, status: response.status });
    });
  }
}



async function listReceivedOffersDB(sub, limit, offset) {
  // input guard check
  try {
    limitOffsetGuardCheck(limit, offset);
  } catch (error) {
    console.warn(error.message);
    return { message: error.message, status: 406 };
  }

  const pool = await getDBPool();

  // const sql = `
  //               SELECT 
  //                 o.offer_id,
  //                 o.offer_amount,
  //                 o.user_id AS sender_id,
  //                 o.artwork_id,
  //                 o.status,
  //                 o.created_at,
  //                 a.artwork_name,
  //                 a.author_first_name,
  //                 a.author_last_name
  //               FROM offer o
  //               INNER JOIN artwork a ON o.artwork_id = a.artwork_id
  //               WHERE a.owner_id = $1
  //                 AND a.deleted IS NOT TRUE
  //               ORDER BY o.created_at DESC
  //               LIMIT $2 OFFSET $3;
  //             `;

  const sql = `
              SELECT 
                a.artwork_id AS artworkID,
                a.artwork_name AS artwork_name,
                a.author_first_name AS artist_first_name,
                a.author_last_name AS artist_last_name,
                COUNT(*) AS offer_count,
                MAX(o.created_at) AS latest_offer_date
              FROM offer o
              INNER JOIN artwork a ON o.artwork_id = a.artwork_id
              WHERE a.owner_id = $1
                AND a.deleted IS NOT TRUE
                AND a.public_record IS TRUE
                AND o.status = 'pending'
              GROUP BY a.artwork_id, a.artwork_name, a.author_first_name, a.author_last_name
              ORDER BY latest_offer_date DESC
              LIMIT $2 OFFSET $3;
            `;

  const values = [sub, limit, offset];

  try {
    const results = await pool.query(sql, values);

    if (results.rows.length === 0) {
      return { message: 'No data found', status: 404 };
    }

    return { message: results.rows, status: 200 };
  } catch (error) {
    console.warn(error);
    return { message: error.message, status: 406 };
  }
}

async function listSentOffersDB(sub, limit, offset) {
  // input guard check
  try {
    limitOffsetGuardCheck(limit, offset);
  }
  catch (error) {
    console.warn(error.message)
    return { message: error.message, status: 406 };
  }

  const pool = await getDBPool();
  // const sql = `SELECT * FROM offer WHERE user_id = $1 LIMIT $2 OFFSET $3;`;
  const sql = `SELECT a.artwork_id AS artworkID,
                      a.artwork_name AS artwork_name,
                      a.author_first_name AS artist_first_name,
                      a.author_last_name AS artist_last_name,
                      o.offer_id AS offer_id,
                      a.owner_id AS owner_id,
                      u.first_name AS owner_first_name,
                      u.last_name AS owner_last_name,
                      o.offer_amount AS price,
                      o.status AS status,
                      o.created_at AS date
               FROM offer o
               JOIN artwork a ON a.artwork_id = o.artwork_id
               JOIN users u ON a.owner_id = u.id
               WHERE o.user_id = $1 
               LIMIT $2 OFFSET $3;`;
  const values = [sub, limit, offset];
  try {
    const results = await pool.query(sql, values); // Removed array destructuring
    if (results.rows.length === 0) {
      return { message: 'No data found', status: 404 };
    }

    return { message: results.rows, status: 200 }; // Changed to results.rows
  }
  catch (error) {
    console.warn(error);
    return { message: error.message, status: 406 };
  }
}

async function listOffersDB(artworkID, limit, offset) {
  // input guard check
  try {
    limitOffsetGuardCheck(limit, offset);
  }
  catch (error) {
    console.warn(error.message)
    return { message: error.message, status: 406 };
  }

  const pool = await getDBPool();
  // const sql = `SELECT * FROM offer WHERE artwork_id = $1 LIMIT $2 OFFSET $3;`;
  const sql = `SELECT a.*, 
                m.price AS market_price
                FROM artwork a
                INNER JOIN market_listing m 
                    ON a.artwork_id = m.artwork_id
                WHERE a.artwork_id = $1;`;
  const values = [artworkID];
  try {
    const artwork_results = await pool.query(sql, values); // Removed array destructuring
    if (artwork_results.rows.length === 0) {
      return { message: 'No artwork data found', status: 404 };
    }
    const sql_offer = `SELECT o.offer_id AS offerID, 
                        o.user_id AS buyer_id,
                        u.first_name AS buyer_first_name,
                        u.last_name AS buyer_last_name,
                        o.offer_amount AS price,
                        o.status AS status,
                        o.created_at AS date
                 FROM offer o
                 JOIN users u ON o.user_id = u.id
                 WHERE o.artwork_id = $1 AND o.status = 'pending'
                 LIMIT $2 OFFSET $3;`;
    const values_offer = [artworkID, limit, offset];

    const offer_results = await pool.query(sql_offer, values_offer); // Removed array destructuring
    if (offer_results.rows.length === 0) {
      return { message: 'No offer data found', status: 404 };
    }

    const resultsTransform = await Promise.all(
      artwork_results.rows.map(async (item) => {
        const imageUuid = item.jpeg_reference;
        const imageKey = `images/${imageUuid}.jpg`;
        const ImageUrl = await getS3Url(imageKey);
        item.jpeg_reference = ImageUrl;
        return item;
      })
    );

    return {
      message: {
        artwork: resultsTransform[0],
        offers: offer_results.rows
      }, status: 200
    }; // Changed to results.rows
  }
  catch (error) {
    console.warn(error);
    return { message: error.message, status: 406 };
  }
}


async function postOfferDB(artworkID, body, sub) {

  // const sql = `SELECT 1 from offer 
  //              WHERE offer.user_id = $1 and offer.artwork_id = $2`;
  const pool = await getDBPool();
  const sql = `WITH upd AS (
             UPDATE offer
                SET offer_amount = $1,
                    created_at = now()
              WHERE user_id = $2 AND artwork_id = $3 AND status = $4
          RETURNING offer_id), 
                    ins AS (
        INSERT INTO offer (offer_amount, user_id, artwork_id, status)
             SELECT $1, $2, $3, $4
   WHERE NOT EXISTS (SELECT 1 FROM upd)
          RETURNING offer_id)
          SELECT offer_id
            FROM upd
           UNION
          SELECT offer_id
            FROM ins;`; // Added RETURNING
  // const values = [body.amount, body.userID , artworkID, 'pending'];
  const values = [body.amount, sub, artworkID, 'pending'];
  try {
    const results = await pool.query(sql, values); // Removed array destructuring
    if (results.rows.length === 0) {
      return { message: 'error appending to table', status: 404 };
    }

    return { message: results.rows[0], status: 200 }; // Return the inserted record
  }
  catch (error) {
    console.warn(error);
    return { message: error.message, status: 406 };
  }
}

/**
 * Updates an offer object with atomic transaction support
 */
async function putOfferDB(offerID, status) {
  const pool = await getDBPool();

  const sql = ` UPDATE offer 
                SET status = $1
                WHERE offer_id = $2;`;

  const values = [status, offerID];

  try {
    const results = await pool.query(sql, values); // Removed array destructuring

    if (results.rowCount === 0) { // Changed from affectedRows to rowCount
      return { message: 'No rows updated — offer not found', status: 404 };
    }

    return { message: 'Offer updated successfully', status: 202 };
  } catch (error) {
    console.warn(error);
    return {
      message: error.message,
      status: 406
    };
  }
}

/**
 * Process transaction atomically - all operations succeed or all fail
 * This function handles:
 * 1. Creating the transaction record
 * 2. Updating artwork ownership
 * 3. Rejecting all other offers for the same artwork
 */
async function processTransaction(offerID) {
  const client = await getDBConnection();

  try {
    // Start transaction
    await client.query('BEGIN');

    // Step 1: Create transaction record and get offer details
    const sqlTransaction = `
            WITH selected_offer AS (
                SELECT 
                    o.offer_id,
                    o.offer_amount AS total_amount,
                    o.user_id AS payer_id,   
                    a.owner_id AS payee_id,
                    o.artwork_id        
                FROM offer o
                JOIN artwork a ON o.artwork_id = a.artwork_id
                WHERE o.offer_id = $1
            )
            INSERT INTO transactions (offer_id, payer_id, payee_id, total_amount)
            SELECT offer_id, payer_id, payee_id, total_amount
            FROM selected_offer
            RETURNING transaction_id, processed_at;`;

    const transactionResults = await client.query(sqlTransaction, [offerID]);

    if (transactionResults.rows.length === 0) {
      throw new Error('Failed to create transaction record');
    }

    // Step 2: Update artwork ownership
    const sqlArtwork = `
            UPDATE artwork
            SET owner_id = (SELECT user_id FROM offer WHERE offer_id = $1), verified = false
            WHERE artwork_id = (SELECT artwork_id FROM offer WHERE offer_id = $2);`;

    const artworkResults = await client.query(sqlArtwork, [offerID, offerID]);

    if (artworkResults.rowCount === 0) {
      throw new Error('Failed to update artwork ownership');
    }

    // Step 3: Reject all other offers for the same artwork (except the accepted one)
    const sqlRejectOtherOffers = `
            UPDATE offer 
            SET status = 'rejected'
            WHERE artwork_id = (SELECT artwork_id FROM offer WHERE offer_id = $1)
            AND offer_id != $2
            AND status = 'pending';`;

    const rejectResults = await client.query(sqlRejectOtherOffers, [offerID, offerID]);

    // Log how many offers were rejected
    console.log(`Rejected ${rejectResults.rowCount} other offers for the artwork`);

    // Step 4: Optionally, mark the artwork as sold/unavailable
    // const sqlMarkArtworkSold = `
    //     UPDATE artwork 
    //     SET available = false 
    //     WHERE artwork_id = (SELECT artwork_id FROM offer WHERE offer_id = $1);`;
    const sqlMarkArtworkSold = `
            UPDATE artwork 
            SET public_record = false 
            WHERE artwork_id = (SELECT artwork_id FROM offer WHERE offer_id = $1);`;

    await client.query(sqlMarkArtworkSold, [offerID]);

    // Commit transaction - all operations succeeded
    await client.query('COMMIT');

    return {
      message: `Transaction processed successfully. Transaction ID: ${transactionResults.rows[0].transaction_id}. ${rejectResults.rowCount} other offers rejected.`,
      status: 202,
      transactionId: transactionResults.rows[0].transaction_id,
      rejectedOffers: rejectResults.rowCount
    };

  } catch (error) {
    // Rollback transaction on any error
    await client.query('ROLLBACK');
    console.warn('Transaction rolled back due to error:', error);

    return {
      message: `Transaction failed: ${error.message}`,
      status: 406
    };
  } finally {
    // Always release the client back to the pool
    client.release();
  }
}
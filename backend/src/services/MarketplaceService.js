'use strict';
/**************************************************************************************************/

/**
 * @file        MarketplaceService.js
 * @description --tbd
 * 
 * @enterprise  THE UNIVERSITY OF MELBOURNE
 * @author      [Xiangyu Zhang]
 * @created     23/08/2025
 * @license     --tbd
 */
const { getDBPool } = require('../database/getDBPool')
const { idGuardCheck, } = require('../utils/variableGuardCheck')
const { limitOffsetGuardCheck } = require('../utils/limitOffsetGuardCheck')
const {getS3Url, uploadToS3, deleteFromS3} = require('../utils/s3Bucket.js');
exports.getArtistProfileInMarket = async function getArtistProfileInMarket(artistID, limit, offset, body) {
  const response = await getArtistProfileInMarketDB(artistID, limit, offset, body);

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
};

async function getArtistProfileInMarketDB(artistID, limit, offset, body) {
  // input guard check
  try {
    limitOffsetGuardCheck(limit, offset);
  }
  catch (error) {
    console.warn(error.message);
    return { message: error.message, status: 406 };
  }

  const pool = await getDBPool();
  const sql = `SELECT * 
              FROM artwork aw
              LEFT JOIN (SELECT id AS artists_id, first_name AS artist_first_name, last_name AS artist_last_name FROM users) u USING (artists_id)
              WHERE aw.artists_id = $1
                AND toggle = True 
                AND deleted = False
              LIMIT $2 OFFSET $3 `;

  const values = [artistID, limit, offset];
  try {
    const { rows, rowCount } = await pool.query(sql, values);

    if (rowCount === 0) {
      return { message: 'No data found', status: 404 };
    }
    const resultsTransform = await Promise.all(
      rows.map(async (item) => {
        const imageUuid = item.jpeg_reference; 
        const imageKey = `images/${imageUuid}.jpg`;
        const ImageUrl = await getS3Url(imageKey);   
        item.jpeg_reference = ImageUrl;            
        return item;
      })
    );
    return { message: resultsTransform, status: 200 };
  }
  catch (error) {
    console.warn(error.message);
    return { message: error.sqlMessage ? error.sqlMessage : error.message, status: 406 };
  }
}

/**
 * Service for listing artwork in marketplace based on limit and offset.
 * 
 * @param {number} limit - Maximum number of artworks to retrieve per request.
 * @param {number} offset - The number of artworks to skip before starting to collect the results.
 * @returns {Promise<Object>} A promise that resolves with `{ message, status }` if successful,
 *                            or rejects with `{ message, status }` if validation or database query fails.
 */
exports.listArtworksInMarket = async function listArtworksInMarket(limit, offset) {
  // Input guard for limit and offset
  const limitCheck = limitOffsetGuardCheck(limit, offset);

  if (limitCheck.status != 200) {
    return new Promise(function (resolve, reject) {
      reject(limitCheck);
    });
  }

  const response = await listArtworksInMarketDB(limitCheck.message.limit,
    limitCheck.message.offset);

  if (response.status === 200) {
    return new Promise(function (resolve, reject) {
      resolve({ message: response.message, status: response.status });
    });
  }
  else {
    return new Promise(function (resove, reject) {
      reject({ message: response.message, status: response.status });
    });
  }
};

/**
 * Retrieves a paginated list of artworks available in the marketplace from the database.
 * 
 * @param {number} limit - Maximum number of artworks to retrieve.
 * @param {number} offset - Number of artworks to skip before starting to collect results.
 * @returns {Promise<Object>} A promise that resolves with `{ message: artworkList, status: 200 }` if successful,
 *                            or an error object `{ message, status }` if no data or an error occurs.  
 */
async function listArtworksInMarketDB(limit, offset) {
  // input guard check
  try {
    limitOffsetGuardCheck(limit, offset);
  }
  catch (error) {
    console.warn(error.message);
    return { message: error.message, status: 406 };
  }

  const pool = await getDBPool();
  const sql = `SELECT * 
              FROM artwork aw
              LEFT JOIN (SELECT id AS artists_id, first_name AS artist_first_name, last_name AS artist_last_name FROM users) u USING (artists_id)
              LEFT JOIN (SELECT id AS owner_id, first_name AS owner_first_name, last_name AS owner_last_name FROM users) u1 USING (owner_id)              
              LEFT JOIN market_listing m USING (artwork_id)
              WHERE public_record = True
                AND (aw.verified OR aw.authenticated)
                AND deleted = False
              LIMIT $1 OFFSET $2 `;

  const values = [limit, offset];
  try {
    const { rows, rowCount } = await pool.query(sql, values);

    if (rowCount === 0) {
      return { message: 'No data found', status: 404 };
    }
    const resultsTransform = await Promise.all(
      rows.map(async (item) => {
        const imageUuid = item.jpeg_reference; 
        const imageKey = `images/${imageUuid}.jpg`;
        const ImageUrl = await getS3Url(imageKey);  
        item.jpeg_reference = ImageUrl;           
        return item;
      })
    );
    return { message: resultsTransform, status: 200 };
  }
  catch (error) {
    console.warn(error.message);
    return { message: error.sqlMessage ? error.sqlMessage : error.message, status: 406 };
  }
}

exports.getArtworkProfileInMarket = async function getArtworkProfileInMarket(artworkID, body) {
  const response = await getArtworkProfileInMarketDB(artworkID, body);

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
};

async function getArtworkProfileInMarketDB(artworkID, body) {
  const pool = await getDBPool();
  const sql = `SELECT * 
               FROM artwork aw
               LEFT JOIN (SELECT id AS artists_id, first_name AS artist_first_name, last_name AS artist_last_name FROM users) u USING (artists_id)
               LEFT JOIN (SELECT user_id AS artists_id, description AS artist_description, image AS artist_image FROM artists) ai USING (artists_id)
               LEFT JOIN (SELECT id AS owner_id, first_name AS owner_first_name, last_name AS owner_last_name FROM users) u1 USING (owner_id)              
               LEFT JOIN market_listing m USING (artwork_id)
               WHERE aw.artwork_id = $1
                 AND aw.deleted = False;`;
  const values = [artworkID];
  try {
    const { rows } = await pool.query(sql, values);
    if (rows.length === 0) {
      return { message: 'No data found', status: 404 };
    }

    const resultsTransform = await Promise.all(
      rows.map(async (item) => {
        const imageUuid = item.jpeg_reference; 
        const imageKey = `images/${imageUuid}.jpg`;
        const ImageUrl = await getS3Url(imageKey);      
        item.jpeg_reference = ImageUrl;       
        return item;
      })
    );
    return { message: resultsTransform[0], status: 200 };
  } catch (error) {
    console.warn(error);
    return { message: error.sqlMessage ? error.sqlMessage : error.message, status: 406 };
  }
};

exports.updateArtworkInMarket = async function updateArtworkInMarket(artworkID, body, sub) {

  const response = await updateArtworkInMarketDB(artworkID, body, sub);

  if (response.status === 202) {
    return new Promise(function (resolve, reject) {
      resolve({ message: response.message, status: response.status });
    });
  }
  else {
    return new Promise(function (resolve, reject) {
      reject({ message: response.message, status: response.status });
    });
  }

};

async function updateArtworkInMarketDB(artworkID, body, sub) {
  const pool = await getDBPool();
  const sql = `INSERT INTO market_listing (artwork_id, price)
              VALUES ($1, $2)
              ON CONFLICT (artwork_id) DO UPDATE
              SET price = $2;`;
  const values = [artworkID, body.price];
  try {
    const { rows, rowCount } = await pool.query(sql, values);

    if (rowCount === 1) {
      const sql = `UPDATE artwork
                      SET public_record = True, toggle = True
                    WHERE artwork_id = $1`;
      const values = [artworkID];
      const { rows, rowCount } = await pool.query(sql, values);
      if (rowCount === 1) {
        // update successfully
        return { message: 'Price updated successfully', status: 202 };
      }

    }
    // 1) artwork doesn't exist → 404
    const exist = await pool.query(
      `SELECT 1 FROM market_listing WHERE artwork_id = $1`,
      [artworkID]
    );
    if (exist.rowCount === 0) {
      return { message: 'Artwork not found', status: 404 };
    }
    // 2) artwork exists, but owner_id != sub → 403
    return { message: 'Forbidden: not the owner', status: 403 };
  } catch (error) {
    console.warn(error);
    return {
      message: error.sqlMessage ? error.sqlMessage : error.message,
      status: 406
    };
  }

};

/**
 * Service for deleting an specific artwork in marketplace based on artworkID.
 * 
 * @param {Object} body - The body of express request object. 
 * @param {number} artworkID - The unique identifier of the artwork to delete.
 * @returns {Promise<Object>} A promise that resolves with `{ message, status }` if successful,
 *                            or rejects with `{ message, status }` if deletion fails.
 */
exports.deleteArtworkInMarket = async function deleteArtworkInMarket(body, artworkID, sub) {
  const response = await deleteArtworkInMarketDB(body, artworkID, sub);

  if (response.status === 204) {
    return new Promise(function (resolve, reject) {
      resolve({ message: response.message, status: response.status });
    });
  }
  else {
    return new Promise(function (resolve, reject) {
      reject({ message: response.message, status: response.status });
    });
  }
};
/**
 * Service for deleting an specific artwork in marketplace based on artworkID.
 * 
 * @param {Object} body - Request body.
 * @param {number} artworkID - The unique identifier of the artwork to delete from the marketplace.
 * @returns {Promise<Object>} A promise that resolves with `{ message: artworkList, status: 200 }` if successful,
 *                            or an error object `{ message, status }` if no data or an error occurs.
 */
async function deleteArtworkInMarketDB(body, artworkID, sub) {
  const pool = await getDBPool();
  const sql = `UPDATE artwork 
               SET public_record = false
               WHERE artwork_id = $1
                 AND owner_id = $2
                 AND public_record = true
                 AND deleted = false
                 AND toggle = true`;

  const values = [artworkID, sub];
  try {
    const { rows, rowCount } = await pool.query(sql, values);

    if (rowCount === 1) {
      return { message: 'Delete an artwork successfully', status: 204 };
    }

    // 1) artwork doesn't exist → 404
    const exist = await pool.query(
      `SELECT 1 FROM market_listing WHERE artwork_id = $1`,
      [artworkID]
    );
    if (exist.rowCount === 0) {
      return { message: 'Artwork not found', status: 404 };
    }
    // 2) artwork exists, but owner_id != sub → 403
    return { message: 'Forbidden: not the owner', status: 403 };
  }
  catch (error) {
    console.warn(error.message);
    return { message: error.sqlMessage ? error.sqlMessage : error.message, status: 406 };
  }
}

exports.getProfile = async function getProfile(body, artistID) {
  const response = await getProfileDB(body, artistID);

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
};

async function getProfileDB(body, artistID) {
  const pool = await getDBPool();
  const sql1 = `SELECT count(*) FROM artwork
                WHERE artists_id = $1;`;

  const sql2 = `SELECT first_name, last_name, description, image FROM artists
                JOIN users ON users.id = artists.user_id
                WHERE user_id = $1;`;

  const values = [artistID];
  try {
    const result1 = await pool.query(sql1, values);
    const count = result1.rows[0].count;

    const result2 = await pool.query(sql2, values);
    const { first_name, last_name, description, image } = result2.rows[0];
    if (result1.rowCount === 0 || result2.rowCount === 0) {
      return { message: 'No artist found', status: 404 };
    }
    const result = { first_name, last_name, description, image, count };
    return { message: result, status: 200 };
  }
  catch (error) {
    console.warn(error.message);
    return { message: error.sqlMessage ? error.sqlMessage : error.message, status: 406 };
  }
}


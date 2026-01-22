'use strict';
const { getDBConnection, getDBPool } = require('../database/getDBPool.js');
const { limitOffsetGuardCheck } = require('../utils/limitOffsetGuardCheck.js');
const { idGuardCheck, } = require('../utils/variableGuardCheck.js');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getS3Url, uploadToS3, deleteFromS3 } = require('../utils/s3Bucket.js');
/**
 * Creates Artwork entity
 * This operation creates a Artwork entity.
 *
 * body Artwork Artwork object that needs to be added (optional)
 * returns Artwork
 **/
exports.getArtworkData = async function (artworkID) {
  // Input validation
  if (!artworkID || typeof artworkID !== 'string') {
    return new Promise(function (resolve, reject) {
      reject({ message: 'Invalid artwork ID', status: 400 });
    });
  }

  const response = await getArtworkDataDB(artworkID);

  if (response.status === 200) {
    return new Promise(function (resolve, reject) {
      resolve({ message: response.message, status: response.status });
    });
  } else {
    return new Promise(function (resolve, reject) {
      reject({ message: response.message, status: response.status });
    });
  }
}

async function getArtworkDataDB(artworkID) {
  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(artworkID)) {
    return { message: 'Invalid UUID format', status: 400 };
  }

  const pool = await getDBPool();
  // const sql = `SELECT * FROM artwork WHERE artwork_id = $1;`;
  const sql = `SELECT * 
              FROM artwork aw
              LEFT JOIN (SELECT id AS artists_id, first_name AS artist_first_name, last_name AS artist_last_name FROM users) u USING (artists_id)
              LEFT JOIN (SELECT user_id AS artists_id, description AS artist_description, image AS artist_image FROM artists) ai USING (artists_id)
              LEFT JOIN (SELECT user_id AS owner_id, description AS owner_description, image AS owner_image FROM collector) USING (owner_id)
              LEFT JOIN (SELECT id AS owner_id, first_name AS owner_first_name, last_name AS owner_last_name FROM users) u1 USING (owner_id)              
              LEFT JOIN market_listing m USING (artwork_id)
              WHERE aw.artwork_id = $1;`;
  const values = [artworkID];

  try {
    const result = await pool.query(sql, values);

    if (result.rows.length === 0) {
      return { message: 'Artwork not found', status: 404 };
    }

    const resultsTransform = await Promise.all(
      result.rows.map(async (item) => {
        const imageUuid = item.jpeg_reference;
        const imageKey = `images/${imageUuid}.jpg`;
        const ImageUrl = await getS3Url(imageKey);
        item.jpeg_reference = ImageUrl;
        return item;
      })
    );
    return { message: resultsTransform[0], status: 200 };
    // return { message: result.rows[0], status: 200 };
  } catch (error) {
    console.warn(error);
    return { message: error.message, status: 406 };
  }
}

exports.postArtwork = async function (body, image, dng, sub) {
  const response = await postArtworkDB(body, image, dng, sub);

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

async function postArtworkDB(body, image, dng, sub) {
  const {
    isArtist,
    authorFirstName,
    authorLastName,
    title,
    artMedium,
    dimensions,
    dateOfProduction,
    description,
    tags
  } = body;

  const parseTags = tags.replace('[', '{').replace(']', '}');
  const newDateOfProduction = new Date(dateOfProduction);

  // Generate UUIDs for S3 keys using crypto
  const dngUuid = crypto.randomUUID();
  const imageUuid = crypto.randomUUID();

  // Construct S3 keys
  const dngKey = `dng/${dngUuid}.dng.gz`;
  const imageKey = `images/${imageUuid}.jpg`;

  const client = await getDBConnection();
  var sql = '';
  var values = [];
  const isArtistRole = String(isArtist).toLowerCase() === 'true';

  try {
    // Upload to S3 first (before DB insert)
    await uploadToS3(dng, dngKey);
    await uploadToS3(image, imageKey);

    await client.query('BEGIN');

    if (isArtistRole) {
      sql = `INSERT INTO artists (user_id)
             VALUES ($1)
             ON CONFLICT (user_id) DO NOTHING`;
      values = [sub];
      await client.query(sql, values);
    }

    if (isArtistRole) {
      sql = `INSERT INTO artwork (artists_id, owner_id, author_first_name, author_last_name, artwork_name,
                                   dimensions, art_medium, tags, description,
                                   dng_reference, jpeg_reference, date_of_production,
                                   authenticated, verified, toggle, public_record, deleted)
             VALUES ($1,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING artwork_id;`;
      values = [sub, authorFirstName, authorLastName, title,
        dimensions, artMedium, parseTags, description,
        dngUuid, imageUuid, newDateOfProduction,
        true, false, false, false, false];
    } else {
      sql = `INSERT INTO artwork (owner_id, author_first_name, author_last_name, artwork_name,
                                   dimensions, art_medium, tags, description,
                                   dng_reference, jpeg_reference, date_of_production,
                                   authenticated, verified, toggle, public_record, deleted)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING artwork_id;`;
      values = [sub, authorFirstName, authorLastName, title,
        dimensions, artMedium, parseTags, description,
        dngUuid, imageUuid, newDateOfProduction,
        false, false, false, false, false];
    }

    const artworkResult = await client.query(sql, values);

    if (artworkResult.rows.length === 0) {
      // Rollback: delete uploaded files
      // await deleteFromS3(dngKey);
      // await deleteFromS3(imageKey);
      throw new Error('Failed to create new artwork');
    }

    // const ownershipValues = [artworkResult.rows[0].artwork_id, sub];
    // const ownershipRecord = await client.query(`INSERT INTO ownership_history (artwork_id, owner_id) 
    //                                            VALUES ($1, $2)
    //                                            RETURNING ownership_id`, ownershipValues);
    // if(ownershipRecord.rows.length === 0) {
    //     throw new Error('Failed to create new ownership');
    // }    

    await client.query('COMMIT');
    const dngUrl = await getS3Url(dngKey);
    const imageUrl = await getS3Url(imageKey);
    const resultsTransform = artworkResult.rows.map(item => ({
      ArtworkID: item.artwork_id,
      DngReference: dngUuid,
      ImageReference: imageUuid,
      DngUrl: dngUrl,
      ImageUrl: imageUrl
    }));
    return { message: resultsTransform, status: 200 };

  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { }
    console.warn(error);
    // Rollback: delete from S3 if DB insert fails
    try {
      // await deleteFromS3(dngKey);
      // await deleteFromS3(imageKey);
    } catch (deleteError) {
      console.error('Failed to cleanup S3 files:', deleteError);
    }
    return { message: error.message, status: 406 };
  } finally {
    // Always release the client back to the pool
    client.release();
  }
}

/**
 * List or find Artwork objects
 * List or find Artwork objects
 *
 * returns Artwork
 **/
exports.listArtworks = async function (sub, offset, limit) {
  // Input guard for limit and offset
  const limitCheck = limitOffsetGuardCheck(limit, offset);

  if (limitCheck.status != 200) {
    return new Promise(function (resolve, reject) {
      reject(limitCheck);
    });
  }

  const response = await listArtworksDB(sub, limitCheck.message.limit, limitCheck.message.offset);

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

async function listArtworksDB(sub, limit, offset) {
  // input guard check
  try {
    limitOffsetGuardCheck(limit, offset);
  }
  catch (error) {
    console.warn(error.message)
    return { message: error.message, status: 406 };
  }

  const pool = await getDBPool();
  // const sql = `SELECT artwork_id AS "ArtworkID" FROM artwork LIMIT $1 OFFSET $2`;
  // const values = [limit, offset];
  // try {
  //   const [results] = await pool.query(sql, values);
  //   if (results.length === 0) {
  //     return { message: 'No data found', status: 404 };
  //   }

  //   const resultsTransfrom = results.map(item => {
  //     let retval = {
  //       ArtworkID: item.ArtworkID,
  //     };
  //     return retval;
  //   });
  const sql = `SELECT * 
            FROM artwork aw
            LEFT JOIN (SELECT id AS artists_id, first_name AS artist_first_name, last_name AS artist_last_name FROM users) u USING (artists_id)
            LEFT JOIN (SELECT id AS owner_id, first_name AS owner_first_name, last_name AS owner_last_name FROM users) u1 USING (owner_id)              
            LEFT JOIN market_listing m USING (artwork_id)
            WHERE deleted = False
              AND owner_id = $1
            LIMIT $2 OFFSET $3;`;
  const values = [sub, limit, offset]
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
    return { message: resultsTransform, status: 200 };
  }
  catch (error) {
    console.warn(error);
    return { message: error.sqlMessage ? error.sqlMessage : error.message, status: 406 };
  }
}

exports.putArtwork = async function (artworkID, body, image) {
  const response = await putArtworkDB(artworkID, body, image);

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
}

async function putArtworkDB(artworkID, body, image) {
  const {
    title,
    artMedium,
    dimensions,
    dateOfProduction,
    description,
    tags
  } = body;
  const parseTags = tags ? tags.replace('[', '{').replace(']', '}') : null;
  const newDateOfProduction = new Date(dateOfProduction);

  const pool = await getDBPool();
  var sql = '';
  var values = [];
  try {
    if (image) {
      const imageUuid = crypto.randomUUID();
      const imageKey = `images/${imageUuid}.jpg`;
      await uploadToS3(image, imageKey);
      // const url = getS3Url(imageKey);
      sql = `UPDATE artwork
             SET artwork_name=$2, dimensions=$3, art_medium=$4, description=$5, jpeg_reference=$6, date_of_production=$7, tags=$8
             WHERE artwork_id=$1;`;
      values = [artworkID, title, dimensions, artMedium, description, imageUuid, newDateOfProduction, parseTags];
    } else {
      sql = `UPDATE artwork
             SET artwork_name=$2, dimensions=$3, art_medium=$4, description=$5, date_of_production=$6, tags=$7
             WHERE artwork_id=$1;`;
      values = [artworkID, title, dimensions, artMedium, description, newDateOfProduction, parseTags];
    }
    const result = await pool.query(sql, values);
    if (result.rowCount === 0) {
      return { message: 'No data updated', status: 404 };
    }

    return { message: 'Artwork update successfully', status: 202 };
  }
  catch (error) {
    console.warn(error);
    return { message: error.message, status: 406 };
  }
}

exports.deleteArtwork = async function (artworkID, body) {
  const response = await deleteArtworkDB(artworkID, body);

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
}

async function deleteArtworkDB(artworkID, body) {
  const pool = await getDBPool();
  const sql = `UPDATE artwork a
               SET deleted = True
               WHERE a.artwork_id = $1
               RETURNING a.artwork_id`;
  const values = [artworkID];
  try {
    const result = await pool.query(sql, values);
    if (result.rowCount === 0) {
      return { message: 'No artwork deleted', status: 404 };
    }
    return { message: 'Artwork deleted successfully', status: 204 };
  } catch (error) {
    console.warn(error.message);
    return { message: error.sqlMessage ? error.sqlMessage : error.message, status: 406 };
  }
}

/**
 * Lists artworks in marketplace.
 * 
 * @param {Object} req - The express request object. 
 * @param {Object} res - The Express response object used to send back JSON.
 * @returns {void} Sends a JSON response with the operation result message and status code.
 */
exports.toggleArtwork = async function (artworkID, body) {
  const response = await toggleArtworkDB(artworkID, body);

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
 * Service for toggling the visibility of a specific artwork.
 * 
 * @param {number} artworkID - The unique identifier of the artwork to toggle.
 * @param {Object} body - Request body
 * @returns {Promise<Object>} A promise that resolves with `{ message: artworkList, status: 200 }` if successful,
 *                            or an error object `{ message, status }` if no data or an error occurs.
 */
async function toggleArtworkDB(artworkID, body) {
  const pool = await getDBPool();
  const sql = `UPDATE artwork
                SET toggle = NOT toggle
                WHERE artwork_id = $1`;
  try {
    const { rows, rowCount } = await pool.query(sql, [artworkID]);

    if (rowCount === 0) {
      return { message: "No data updated", status: 404 };
    }
    return { message: "Toggle successfully", status: 204 };
  }
  catch (error) {
    console.warn(error.message);
    return { message: error.sqlMessage ? error.sqlMessage : error.message, status: 406 };
  };

}

async function processArtworkImage(file) {
  if (!file) throw new Error('No artwork file provided');

  const timestamp = Date.now();
  const outputPath = `uploads/artwork/artwork-${timestamp}.jpg`;

  // Ensure upload directory exists
  const uploadDir = path.dirname(outputPath);
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  // Compress and optimize artwork
  await sharp(file.path)
    .jpeg({
      quality: 85, // Should be zoom-in-able
      progressive: true
    })
    .resize(2000, 2000, {
      fit: 'inside',
      withoutEnlargement: true
    })
    .toFile(outputPath);

  // Clean up temp file
  fs.unlinkSync(file.path);

  return {
    filename: `artwork-${timestamp}.jpg`,
    path: outputPath,
    originalName: file.originalname,
    size: file.size
  };
}

exports.compressImage = function compressImage(req, res) {
  return new Promise((resolve, reject) => {
    const file = req.request.files['file'][0];
    // DNG file is req.request.files['rawFilePhoto'][0]

    if (!file) {
      return reject({ message: 'No file uploaded', status: 400 });
    }

    // Compression function call
    console.log('Processing file:', file.originalname);
    // Process the uploaded file using the reusable function
    processArtworkImage(file)
      .then(processedArtwork => {
        console.log('Processed artwork details:', processedArtwork);
        // Save processedArtwork.path to database with 
        // a call to POST /v1/registry
        // and then resolve the outer promise
        resolve({
          message: 'File processed successfully',
          status: 200,
          filename: processedArtwork.filename
        });
      })
      .catch(error => {
        console.error('Processing failed:', error);
        reject({ message: 'Processing failed', status: 500 });
      });
  });
};
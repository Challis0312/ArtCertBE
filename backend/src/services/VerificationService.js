'use strict';
/**************************************************************************************************/

/**
 * @file        VerificationService.js
 * @description Service for verifying artwork by comparing uploaded DNG files 
 *              against reference images using computer vision API. Handles file upload to S3, 
 *              external verification request, and database status updates.
 * 
 * @enterprise  THE UNIVERSITY OF MELBOURNE
 * @author      [Jamila Tomines]
 * @created     16/09/2025
 * @license     --tbd
 */
const { getDBConnection, getDBPool } = require('../database/getDBPool')
const crypto = require('crypto');
const { uploadToS3, getS3Url } = require('../utils/s3Bucket.js');
const fetch = require('node-fetch');
const cfg = require('../auth/config');

exports.verifyArtwork = async function (artworkID, body, rawFile, sub) {
    // const controller = new AbortController();
    // const timeoutId = setTimeout(() => controller.abort(), 999999); // 5 minutes

    const pool = await getDBPool();
    try {
        if (cfg.verification.verifyKey == null || cfg.verification.verifyKey == 'change_me') {
            return {
                message: 'API key is not set',
                status: 500,
                verified: false
            };
        }
        if (!rawFile) {
            return {
                message: 'No file provided for verification',
                status: 400,
                verified: false
            };
        }
        // Get reference of the DNG file to for the database
        const sql = `SELECT dng_reference 
                    FROM public.artwork 
                    WHERE artwork_id = $1;`;
        const { rows, rowCount } = await pool.query(sql, [artworkID]);

        if (rowCount === 0) {
            return {
                message: 'Artwork not found',
                status: 404,
                verified: false
            };
        }

        const dngReference = rows[0].dng_reference;
        // Upload new file to S3 first (in future, create DB table that tracks verification and insert into it at this point)
        // Generate UUIDs for S3 keys using crypto for target (same as postArtwork)
        const dngUuid = crypto.randomUUID();
        // Construct S3 keys
        const refWithExtension = `${dngReference}.dng.gz`; // original reference DNG
        const tgtWithExtension = `${dngUuid}.dng.gz`; // newly uploaded DNG for verification
        const dngKey = `dng/${tgtWithExtension}`;
        // console.log('Uploading raw file to media storage');

        await uploadToS3(rawFile, dngKey);
        // upload to storage in Verification
        const response =
            await fetch(cfg.verification.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Art-API-Key': cfg.verification.verifyKey
                },
                body: JSON.stringify({
                    "ref": refWithExtension,
                    "tgt": tgtWithExtension
                }),
                // signal: controller.signal
            });
        // clearTimeout(timeoutId);

        // Parse JSON body
        const computerVisionResponse = await response.json();

        if (response.status !== 200) {
            return {
                message: 'YYYYYY' + computerVisionResponse.message || computerVisionResponse.detail || 'API error',
                status: response.status,
                verified: false
            };
        }
        // Check if message matches and determine verification status
        const shouldVerify = computerVisionResponse.message === "Same Painting!";
        // Update database
        const dbResponse = await verifyArtworkDB(pool, artworkID, shouldVerify);
        // Return different messages based on API response
        let userMessage;
        if (shouldVerify) {
            userMessage = "Artwork has been successfully verified"
            // affect another DB
        } else if (computerVisionResponse.message === "Different Painting!") {
            userMessage = "Artwork does not match and has not been verified";
        } else {
            userMessage = `Verification result: ${computerVisionResponse.message}`;
        }
        // Return consistent response structure
        return {
            message: userMessage,
            status: dbResponse.status,
            verified: shouldVerify,
            cvMessage: computerVisionResponse.message // Include original API message for debugging
        };

    } catch (error) {
        // clearTimeout(timeoutId);
        // if (error.name === 'AbortError') {
        //     console.error('Request timed out after 5 minutes');
        // }
        console.error('Error in verify artwork service:', error);
        console.error('Error stack:', error.stack);
        return {
            message: error.message || 'Verification failed',
            status: error.status || 500,
            verified: false
        };
    }
};

async function verifyArtworkDB(pool, artworkID, shouldVerify) {
    if (shouldVerify) {
        const sql = `UPDATE artwork
                    SET verified = true
                    WHERE artwork_id = $1;`;
        try {
            const { rows, rowCount } = await pool.query(sql, [artworkID]);

            if (rowCount === 0) {
                throw new Error('Failed to update artwork');
            }
            return { message: "Artwork has been successfully verified", status: 200 };
        } catch (error) {
            console.warn(error.message);
            return { message: error.sqlMessage ? error.sqlMessage : error.message, status: 406 };
        }
    } else {
        return { message: "Artwork does not match and has not been verified", status: 200 };

    }
}

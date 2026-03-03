'use strict';
/**************************************************************************************************/

/**
 * @file        Verification.js
 * @description --tbd
 * 
 * @enterprise  THE UNIVERSITY OF MELBOURNE
 * @author      [Jamila Tomines]
 * @created     16/09/2025
 * @license     --tbd
 */

const utils = require('../utils/writer.js');
const VerificationService = require('../services/VerificationService.js');

module.exports.verifyArtwork = function verifyArtwork(req, res) {
    const { body } = req.request;
    const { artworkID } = req.request.params;
    // Extract rawFile from uploaded files
    const rawFile = req.request.files && req.request.files['rawFile'] ? req.request.files['rawFile'][0] : null;
    const sub = req.user?.sub || null;
    VerificationService.verifyArtwork(artworkID, body, rawFile, sub)
        .then(function (response) {
            console.log("Here in normal response from Verification js");
            const { status, ...responseBody } = response;
            utils.writeJson(res, responseBody, status);
        })
        .catch(function (response) {
            console.log("Here in error response from Verification js");
            const { status, ...errorBody } = response;
            utils.writeJson(res, errorBody, status);
        });
};

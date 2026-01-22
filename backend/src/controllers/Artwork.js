'use strict';

const utils = require('../utils/writer.js');
const ArtworkService = require('../services/ArtworkService.js');


/**
 * Controller for toggling a specific artwork in registry.
 * 
 * @param {Object} req - The express request object. 
 * @param {Object} res - The Express response object used to send back JSON.
 * @returns {void} Sends a JSON response with the operation result message and status code.
 */
module.exports.toggleArtwork = function toggleArtwork(req, res) {
  const { body } = req.request;
  const { artworkID } = req.request.params;

  ArtworkService.toggleArtwork(artworkID, body)
    .then(function (response) {
      utils.writeJson(res, response.message, response.status);
    })
    .catch(function (response) {
      utils.writeJson(res, response.message, response.status);
    });
};

module.exports.compressImage = function compressImage(req, res) {
  ArtworkService.compressImage(req, res)
    .then(function (response) {
      utils.writeJson(res, response.message, response.status);
    })
    .catch(function (response) {
      console.log('Threw error. Now in controller catch after trying to access file');
      utils.writeJson(res, response.message, response.status);
    });
}
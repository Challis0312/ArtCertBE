'use strict';
/**************************************************************************************************/

/**
 * @file        Marketplace.js
 * @description --tbd
 * 
 * @enterprise  THE UNIVERSITY OF MELBOURNE
 * @author      [Xiangyu Zhang]
 * @created     23/08/2025
 * @license     --tbd
 */

const util = require('../utils/writer.js');
const marketplaceService = require('../services/MarketplaceService.js');

/**
 * Controller for listing artworks in marketplace.
 * 
 * @param {Object} req - The express request object. 
 * @param {Object} res - The Express response object used to send back JSON.
 * @returns {void} Sends a JSON response with the operation result message and status code.
 */
module.exports.listArtworksInMarket = function listArtworksInMarket(req, res) {
  const { body } = req.request.body;
  const { limit, offset } = req.request.query;

  marketplaceService.listArtworksInMarket(limit, offset)
    .then(function (response) {
      util.writeJson(res, response.message, response.status);
    })
    .catch(function (response) {
      util.writeJson(res, response.message, response.status);
    });

};


module.exports.getArtworkProfileInMarket = function getArtworkProfileInMarket(req, res) {
  const { body } = req.request.body;
  const { artworkID } = req.request.params;

  marketplaceService.getArtworkProfileInMarket(artworkID, body)
    .then(function (response) {
      util.writeJson(res, response.message, response.status);
    })
    .catch(function (response) {
      util.writeJson(res, response.message, response.status);
    });

};

module.exports.getArtistProfileInMarket = function getArtistProfileInMarket(req, res) {
  const { body } = req.request.body;
  const { limit, offset } = req.request.query;
  const { artistID } = req.request.params;

  marketplaceService.getArtistProfileInMarket(artistID, limit, offset, body)
    .then(function (response) {
      util.writeJson(res, response.message, response.status);
    })
    .catch(function (response) {
      util.writeJson(res, response.message, response.status);
    });

};

// module.exports.getArtworkInProfile = function getArtworkInProfile(req, res) {
//   const { body } = req.request.body;
//   const { artworkID } = req.request.params;

//   marketplaceService.getArtworkInProfile(artworkID, body)
//     .then(function (response) {
//       util.writeJson(res, response.message, response.status);
//     })
//     .catch(function (response) {
//       util.writeJson(res, response.message, response.status);
//     });
// };


module.exports.updateArtworkInMarket = function updateArtworkInMarket(req, res) {
  const user = req.user || req.request?.user 
  const { sub } = user;
  // const sub = '550e8400-e29b-41d4-a716-446655440000';
  const body = req.request.body;
  const { artworkID } = req.request.params;

  marketplaceService.updateArtworkInMarket(artworkID, body, sub)
    .then(function (response) {
      util.writeJson(res, response.message, response.status);
    })
    .catch(function (response) {
      util.writeJson(res, response.message, response.status);
    });

};

/**
 * Controller for deleting a specific artwork from the marketplace.
 * 
 * @param {Object} req - The express request object. 
 * @param {Object} res - The Express response object used to send back JSON.
 * @returns {void} Sends a JSON response with the operation result message and status code.
 */
module.exports.deleteArtworkInMarket = function deleteArtworkInMarket(req, res) {
  const user = req.user || req.request?.user 
  const { sub } = user;
  // const sub = '11111111-1111-1111-1111-111111111111';
  const { body } = req.request;
  const { artworkID } = req.request.params;

  marketplaceService.deleteArtworkInMarket(body, artworkID, sub)
    .then(function (response) {
      util.writeJson(res, response.message, response.status);
    })
    .catch(function (response) {
      util.writeJson(res, response.message, response.status);
    });
}

module.exports.getProfile = function getProfile(req, res) {
  const { body } = req.request;
  const { artistID } = req.request.params;

  marketplaceService.getProfile(body, artistID)
    .then(function (response) {
      util.writeJson(res, response.message, response.status);
    })
    .catch(function (response) {
      util.writeJson(res, response.message, response.status);
    });
}
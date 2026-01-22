'use strict';

const utils = require('../utils/writer.js');
const RegistryService = require('../services/ArtworkService.js');

module.exports.listRegistry = function listRegistry (req, res, next) {
  const {limit, offset} = req.request.query;
  // const {userID} = req.request.params;
  const user = req.user || req.request?.user 
  const { sub } = user;
  // const sub = 'b9be5468-e021-70ab-3267-2fb7cdd22801';
  RegistryService.listArtworks(sub, offset, limit)
    .then(function (response) {
      utils.writeJson(res, response.message, response.status);
    })
    .catch(function (response) {
      utils.writeJson(res, response.message, response.status);
    });
};

module.exports.getArtworkData = function  getArtworkData(req, res, next) {
  const {artworkID} = req.request.params;

  RegistryService.getArtworkData(artworkID)
    .then(function (response) {
      utils.writeJson(res, response.message, response.status);
    })
    .catch(function (response) {
      utils.writeJson(res, response.message, response.status);
    });
};

module.exports.postRegistry = function postRegistry (req, res,) {
  const body = req.request.body;
  const image = req.request.files?.image?.[0];
  const dng = req.request.files?.dng?.[0];
  const user = req.user || req.request?.user 
  const { sub } = user;
  // const sub = '29bec468-d0d1-7035-9c60-e90ca3366af8';
  RegistryService.postArtwork(body, image, dng, sub)
    .then(function (response) {
      utils.writeJson(res, response.message, response.status);
    })
    .catch(function (response) {
      utils.writeJson(res, response.message, response.status);
    });
};

module.exports.deleteRegistry = function deleteRegistry (req, res,) {
  const { artworkID } = req.request.params;
  const body = req.request.body;
  RegistryService.deleteArtwork(artworkID, body)
    .then(function (response) {
      utils.writeJson(res, response.message, response.status);
    })
    .catch(function (response) {
      utils.writeJson(res, response.message, response.status);
    });
};

module.exports.putArtwork = function putArtwork(req, res, next) {
  const { body } = req.request;
  const { artworkID } = req.request.params;
  const image = req.request.files?.image?.[0];
  RegistryService.putArtwork(artworkID, body, image)
    .then(function (response) {
      utils.writeJson(res, response.message, response.status);
    })
    .catch(function (response) {
      utils.writeJson(res, response.message, response.status);
    });
};


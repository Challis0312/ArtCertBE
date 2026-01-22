'use strict';

const utils = require('../utils/writer.js');
const OfferService = require('../services/OfferService.js');

module.exports.postOffer = function postOffer (req, res) {
  const user = req.user || req.request?.user 
  const { sub } = user;
  // const sub = '11111111-1111-1111-1111-111111111111';
  const body = req.request.body;
  const {artworkID} = req.request.params;

  OfferService.postOffer(artworkID, body, sub)
    .then(function (response) {
      utils.writeJson(res, response.message, response.status);
    })
    .catch(function (response) {
      utils.writeJson(res, response.message, response.status);
    });
};

module.exports.listSentOffers = function listOffers (req, res, next) {
  const { limit, offset} = req.request.query;
  const user = req.user || req.request?.user 
  const { sub } = user;
  // const sub = "59aed418-b001-7058-8ab8-5cd98f9b9e4e"; // Temporary hardcoded userID for testing
  OfferService.listSentOffers(sub, offset, limit)
    .then(function (response) {
      utils.writeJson(res, response.message, response.status);
    })
    .catch(function (response) {
      utils.writeJson(res, response.message, response.status);
    });
};



module.exports.listReceivedOffers = function listOffers (req, res, next) {
  const { limit, offset} = req.request.query;
  const user = req.user || req.request?.user 
  const { sub } = user;
  // const sub = "11111111-1111-1111-1111-111111111111"; // Temporary hardcoded userID for testing
  OfferService.listReceivedOffers(sub, offset, limit)
    .then(function (response) {
      utils.writeJson(res, response.message, response.status);
    })
    .catch(function (response) {
      utils.writeJson(res, response.message, response.status);
    });
};


module.exports.listArtworkOffers = function listOffers (req, res, next) {
  const { limit, offset} = req.request.query;
  const {artworkID} = req.request.params;
  // const {userID} = "12345678-1234-1234-1234-123456789012"; // Temporary hardcoded userID for testing
  OfferService.listOffers(artworkID, offset, limit)
    .then(function (response) {
      utils.writeJson(res, response.message, response.status);
    })
    .catch(function (response) {
      utils.writeJson(res, response.message, response.status);
    });
};

// module.exports.putOffer = function putOffer (req, res, next) {
//   const {body} = req.request;
//   const {offerID} = req.request.params;
  
//   OfferService.putOffer(offerID, body)
//     .then(function (response) {
//       utils.writeJson(res, response.message, response.status);
//     })
//     .catch(function (response) {
//       utils.writeJson(res, response.message, response.status);
//     });
// };

module.exports.acceptOffer = function putOffer (req, res, next) {
  const {offerID} = req.request.params;
  
  OfferService.putOffer(offerID, 'accepted')
    .then(function (response) {
      utils.writeJson(res, response.message, response.status);
    })
    .catch(function (response) {
      utils.writeJson(res, response.message, response.status);
    });
};


module.exports.rejectOffer = function putOffer (req, res, next) {
  const {offerID} = req.request.params;
  
  OfferService.putOffer(offerID, 'rejected')
    .then(function (response) {
      utils.writeJson(res, response.message, response.status);
    })
    .catch(function (response) {
      utils.writeJson(res, response.message, response.status);
    });
};

module.exports.cancelOffer = function putOffer (req, res, next) {
  const {offerID} = req.request.params;
  
  OfferService.putOffer(offerID, 'canceled')
    .then(function (response) {
      utils.writeJson(res, response.message, response.status);
    })
    .catch(function (response) {
      utils.writeJson(res, response.message, response.status);
    });
};




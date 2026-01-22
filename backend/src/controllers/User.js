'use strict';
/**************************************************************************************************/

/**
 * @file        UserRole.js
 * @description --tbd
 * 
 * @enterprise  THE UNIVERSITY OF MELBOURNE
 * @author      [Xiangyu Zhang]
 * @created     20/09/2025
 * @license     --tbd
 */

const util = require('../utils/writer.js');
const userService = require('../services/user.js');

module.exports.getUserRole = function getUserRole(req, res) {
  const user = req.user || req.request?.user;
  const { sub } = user;

  userService.getUserRole(sub)
    .then(function (response) {
      util.writeJson(res, response.message, response.status);
    })
    .catch(function (response) {
      util.writeJson(res, response.message, response.status);
    });

};

module.exports.getUserAction = function getUserAction(req, res) {
  const user = req.user || req.request?.user;
  const { sub } = user;
  const { artworkID } = req.request.params;

  userService.getUserAction(artworkID, sub)
    .then(function (response) {
      util.writeJson(res, response.message, response.status);
    })
    .catch(function (response) {
      util.writeJson(res, response.message, response.status);
    });
}
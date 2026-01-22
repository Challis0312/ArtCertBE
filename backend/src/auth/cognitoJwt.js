/**************************************************************************************************/

/**
 * @file        cognitoJwt.js
 * @description Verify access token derived from frontend
 * 
 * @enterprise  UNIVERSITY OF MELBOURNE
 * @author      [Xiangyu Zhang]
 * @created     05/09/2025
 * @license     -- tbd
 */
const { CognitoJwtVerifier } = require('aws-jwt-verify');
const { cognito } = require('./config');

const verifier = CognitoJwtVerifier.create({
  userPoolId: cognito.userPoolId,
  tokenUse: 'access',
  clientId: cognito.clientId,
});

exports.verifyAccess = async (token) => {
  const p = await verifier.verify(token);
  return {
    sub: p.sub,
    username: p.username || p['cognito:username'],
    groups: p['cognito:groups'] || [],
    raw: p,
  };
};
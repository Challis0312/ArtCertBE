/**************************************************************************************************/

/**
 * @file        oauth.js
 * @description Exchange the authorization code for a token and refresh token
 * 
 * @enterprise  UNIVERSITY OF MELBOURNE
 * @author      [Xiangyu Zhang]
 * @created     05/09/2025
 * @license     -- tbd
 */
const fetch = require('node-fetch');
const { cognito } = require('./config');

const basic = 'Basic ' + Buffer.from(`${cognito.clientId}:${cognito.clientSecret}`)
        .toString('base64');

// Exchange the authorization code for a token
exports.exchangeCode = async ({ code , codeVerifier }) => {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: cognito.redirectUri,
    client_id: cognito.clientId,
    code_verifier: codeVerifier
  });
      
  const r = await fetch(cognito.tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: basic },
    body
  });

  // for dubgging
// const text = await r.text();
// console.log('status:', r.status, r.statusText);
// console.log('headers:', Object.fromEntries(r.headers));
// console.log('body   :', text);

  if (!r.ok) throw new Error(`Token exchange failed: ${r.status}`);
  return r.json(); // { access_token, id_token, refresh_token, expires_in, ... }
};


exports.refreshTokens = async (refreshToken) => {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: cognito.clientId,
  });
  const r = await fetch(cognito.tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: basic },
    body
  });
  if (!r.ok) throw new Error(`Refresh failed: ${r.status}`);
  return r.json(); // { access_token, id_token, expires_in, ... }
};
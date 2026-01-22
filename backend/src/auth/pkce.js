/**************************************************************************************************/

/**
 * @file        pkce.js
 * @description Create pkce(include code_verifier and code_challenge)
 * 
 * @enterprise  UNIVERSITY OF MELBOURNE
 * @author      [Xiangyu Zhang]
 * @created     09/09/2025
 * @license     -- tbd
 */

const crypto = require('crypto');
const b64url = (buf) => buf.toString('base64')
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        
exports.createPkcePair = () => {
        const code_verifier = b64url(crypto.randomBytes(64));
        const code_challenge = b64url(crypto.createHash('sha256')
                .update(code_verifier).digest());
        return { code_verifier, code_challenge, method: 'S256' };
}
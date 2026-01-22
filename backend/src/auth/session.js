/**************************************************************************************************/

/**
 * @file        session.js
 * @description Exchange the authorization code for a token and refresh token
 * 
 * @enterprise  UNIVERSITY OF MELBOURNE
 * @author      [Xiangyu Zhang]
 * @created     05/09/2025
 * @license     -- tbd
 */
const session = require('express-session');
const { session: sCfg, env } = require('./config');

exports.sessionMw = session({
  name: sCfg.name,
  secret: sCfg.secret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: env === 'production',
    maxAge: 1000 * 60 * 60 * 24 * 7,
  },
});

exports.meHandler = (req, res) => {
  if (!req.session.user) return res.status(401).json({ message: 'unauthenticated' });
  res.json({ user: req.session.user });
};

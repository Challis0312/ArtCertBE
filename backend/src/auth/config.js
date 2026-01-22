require('dotenv').config({ path: '../.env' });

const cfg = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 6777),

  cognito: {
    domain: process.env.COGNITO_DOMAIN,
    userPoolId: process.env.COGNITO_USER_POOL_ID,
    clientId: process.env.COGNITO_APP_CLIENT_ID,
    clientSecret: process.env.COGNITO_APP_CLIENT_SECRET,
    redirectUri: process.env.COGNITO_REDIRECT_URI,
    scopes: process.env.COGNITO_SCOPES || 'openid email profile',
  },

  urls: {
    frontendOrigin: process.env.FRONTEND_ORIGIN,
    defaultReturnTo: process.env.DEFAULT_RETURN_TO,
  },

  session: {
    name: process.env.COOKIE_NAME || 'sid',
    secret: process.env.SESSION_SECRET || 'change_me',
  },

  verification: {
    apiUrl: process.env.VERIFY_API_URL,
    healthCheckUrl: process.env.VERIFY_HEALTH_API_URL,
    verifyKey: process.env.ART_API_KEY || 'change_me'
  }
};

cfg.cognito.tokenEndpoint = `${cfg.cognito.domain}/oauth2/token`;
cfg.cognito.authorizeEndpoint = `${cfg.cognito.domain}/oauth2/authorize`;

module.exports = cfg;

'use strict';

const path = require('path');
const http = require('http');
const cors = require('cors');
const express = require('express');
const fs = require('fs');
const { OpenAPIBackend } = require('openapi-backend');

const session = require('express-session');
const { target_env, POSTGRES_DB, endpoint } = require('./config');

const cfg = require('./auth/config');
const utils = require('./utils/writer.js');
const { getDBPool } = require("./database/getDBPool.js");
const { verifyAccess } = require('./auth/cognitoJwt');
// const { sessionMw, meHandler } = require('./auth/session');
const { exchangeCode, refreshTokens } = require('./auth/oauth');
const crypto = require('crypto');
const { ensureUser } = require('./services/user');
const signature = require('cookie-signature');
// Import AWS Cognito JWT verifier
const { CognitoJwtVerifier } = require("aws-jwt-verify");

// Configure JWT verifier
const verifier = CognitoJwtVerifier.create({
  userPoolId: cfg.cognito.userPoolId,        // your Cognito user pool ID
  tokenUse: "access",                             // verify access token (not ID token)
  clientId: cfg.cognito.clientId,        // replace with your app client ID
});

// Middleware to verify the token
async function verifyToken(req, res, next) {
  if (req.method === 'OPTIONS') return next(); // CORS Pre-Check Release
  // Certification-related items should be released.
  const openAuth = req.path === '/v1/login' || req.path === '/v1/auth/token' || req.path === '/v1/auth/refresh'
    || req.path === '/session/me' || req.path === '/session/check' || req.path === '/v1/auth/logout';
  // Marketplace GET should be released.
  const openGet = req.method === 'GET' &&
    (req.path.startsWith('/v1/marketplace') || req.path.startsWith('/v1/profile'))
  // const openGet = (req.method === 'POST'|| req.method === 'PUT' || req.method === 'GET') &&
  // (req.path.startsWith('/v1/registry') || req.path.startsWith('/v1/profile'))|| req.path.startsWith('/v1/verification')
  if (openAuth || openGet) return next();

  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: "Missing or invalid Authorization header" });
  }

  const token = authHeader.split(' ')[1];
  try {
    // const payload = await verifier.verify(token);
    // req.user = payload; // Make payload accessible to routes/controllers
    const p = await verifier.verify(token);
    // Authentication is based on the Access Token
    const user = {
      sub: p.sub,
      username: p.username || p['cognito:username'],
      groups: p['cognito:groups'] || [],
      raw: p,
      role: p.Role,
    };

    const sess = req.session?.user; // get email from session since access_token has no email
    if (sess && sess.sub === user.sub) {
      user.email = sess.email;
      user.name = sess.name;
      // Optional: If roles are not present and you wish to fall back to session authentication, you may release this line.
      // if (!user.roles.length && Array.isArray(sess.roles)) user.roles = sess.roles;
    }
    req.user = user;
    // req.user = {
    //   sub: p.sub,
    //   username: p.username || p['cognito:username'],
    //   groups: p['cognito:groups'] || [],
    //   role: payload.Role,
    //   email: (sess && sess.sub == payload.sub) ? sess.email : undefined,
    // };
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token", error: err.message });
  }
}

const corsOptions = {
  // origin: ["http://localhost:5173/", "https://artcert.com.au"], // frontend URL
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true, // if need to send cookies or auth headers
  origin: "*",
};

// const corsOptions = {
//   origin: "*", 
// };

const app = express();

app.use(express.json());
app.use(cors(corsOptions));

// Middleware to handle multipart/form-data to upload a file
const multer = require('multer');
// Configure multer
// const upload = multer({
//   dest: 'uploads/'
//   ,
//   limits: {
//     fileSize: 90 * 1024 * 1024,  // 90MB limit
//     fieldSize: 10 * 1024 * 1024  // 10MB for text fields
//   },
//   fileFilter: (req, file, cb) => {
//     if (file.mimetype.startsWith('image/')) {
//       cb(null, true);
//     } else {
//       cb(new Error('Only image files are allowed'), false);
//     }
//   }
// });
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 90 * 1024 * 1024,
    fieldSize: 10 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    console.log('File filter check:', {
      fieldname: file.fieldname,
      originalname: file.originalname,
      mimetype: file.mimetype
    });

    const okImage = file.mimetype?.startsWith('image/');
    const okDngGz =
      file.originalname?.toLowerCase().endsWith('.dng.gz') ||
      file.mimetype === 'application/gzip' ||
      file.mimetype === 'application/x-gzip' ||
      file.mimetype === 'application/octet-stream';

    if (okImage || okDngGz) {
      console.log('File accepted:', file.originalname);
      return cb(null, true);
    }

    console.log('File REJECTED:', file.originalname);
    return cb(new Error('Only image files or .dng.gz are allowed'), false);
  },
});

const uploadRegistryFields = upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'dng', maxCount: 1 },
]);
const updateRegistryFields = upload.fields([
  { name: 'image', maxCount: 1 }
]);
const uploadVerificationFields = upload.fields([
  { name: 'rawFile', maxCount: 1 }
]);
app.use('/v1/compression', upload.fields([
  { name: 'file', maxCount: 1 },
  { name: 'rawFilePhoto', maxCount: 1 }
]));

// legacy session support - unsure if needed
// use express-session middleware
app.use(session({
  name: "connect.sid",
  secret: cfg.session.secret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    // secure: true,   
    secure: false,
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24, // one day
  }
}));

// Previous implementation used backend-managed OAuth flow 
// instead of the current frontend-managed PKCE (Proof Key for Code Exchange) flow
// ---------------------------------------------------------------------------
// login from Frontend and jump to Cognito authorizeEndpoint
// app.get('/v1/login', (req, res) => {
//   const state = encodeURIComponent(JSON.stringify({
//     returnTo: req.query.returnTo || cfg.urls.defaultReturnTo
//   }));
//   const u = new URL(cfg.cognito.authorizeEndpoint);
//   u.search = new URLSearchParams({
//     response_type: 'code',
//     client_id: cfg.cognito.clientId,
//     redirect_uri: cfg.cognito.redirectUri,
//     scope: cfg.cognito.scopes,
//     state,
//   }).toString();
//   res.redirect(u.toString());
// });

// Cognito recall: Backend exchange for token and return to Frontend
// app.get('/auth/callback', async (req, res) => {
//   try {
//     const { code, state } = req.query;
//     const tokens = await exchangeCode({ code }); // { access_token, id_token, refresh_token, ... }

//     // return token to Frontend
//     res.status(200).json({
//       access_token: tokens.access_token,
//       id_token: tokens.id_token,
//       refresh_token: tokens.refresh_token,
//       expires_in: tokens.expires_in,
//       token_type: tokens.token_type,
//       state,
//     });
//   } catch (e) {
//     res.status(400).json({ message: 'Auth callback failed', error: e.message });
//   }
// });

app.get('/health', (req, res) => {
  res.status(200).send('ok');
});

/* To ensure the request originates from the party holding the shared secret 
 and request body hasn't been tampered with. */
function verifySharedSig(req) {
  const sig = req.headers['x-internal-signature'];
  const body = JSON.stringify(req.body || {});
  const expect = crypto.createHmac('sha256', process.env.INTERNAL_SHARED_SECRET)
    .update(body).digest('hex');
  return sig === expect;
}

app.post('/internal/cognito/post-confirm', express.json(), async (req, res) => {
  if (!verifySharedSig(req)) return res.status(403).json({ message: 'forbidden' });
  const { sub, email, username, firstname, lastname } = req.body || {};
  if (!sub) return res.status(400).json({ message: 'sub required' });
  await ensureUser({ sub, email, username, firstname, lastname });
  res.json({ ok: true });
});

// Frontend sends code + code_verifier, Backend use client_secret + PKCE to exchange token
app.post('/v1/auth/token', async (req, res) => {
  try {
    const { code, codeVerifier: code_verifier } = req.body || {};
    if (!code || !code_verifier) {
      return res.status(400).json({ message: 'missing code or code_verifier' });
    }

    const tokens = await exchangeCode({ code, codeVerifier: code_verifier });

    // write to server session(backend available)
    req.session.tokens = {
      access: tokens.access_token,
      id: tokens.id_token,
      refresh: tokens.refresh_token,
      expAt: Date.now() + (tokens.expires_in || 0) * 1000,
    };
    // get user info from id_token
    const idPayload = JSON.parse(Buffer.from(tokens.id_token.split('.')[1], 'base64').toString());
    req.session.user = {
      sub: idPayload.sub,
      email: idPayload.email,
      name: idPayload.name || idPayload['cognito:username'],
      groups: idPayload['cognito:groups'] || [],
    };
    const showUser = req.session.user

    res.json({
      access_token: tokens.access_token,
      id_token: tokens.id_token,
      refresh_token: tokens.refresh_token,
      expires_in: tokens.expires_in,
      token_type: tokens.token_type,
    });
  } catch (e) {
    res.status(400).json({ message: 'token exchange failed', error: e.message });
  }
});

// Frontend send refresh_token and Backend return new token
app.post('/v1/auth/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body || {};
    if (!refresh_token) return res.status(400).json({ message: 'missing refresh_token' });
    const out = await refreshTokens(refresh_token);
    res.json({
      access_token: out.access_token,
      id_token: out.id_token,
      expires_in: out.expires_in,
      token_type: out.token_type,
      // Cognito won't assign a new refresh_token each time
      ...(out.refresh_token ? { refresh_token: out.refresh_token } : {})
    });
  } catch (e) {
    res.status(401).json({ message: 'Refresh failed', error: e.message });
  }
});

// Frontend checks if the user is login
app.get('/session/me', (req, res) => {
  if (!req.session?.user) return res.status(401).json({ message: 'unauthenticated' });
  res.json({ user: req.session.user });
});
// Directly check the session store for existence
app.get('/session/check', (req, res) => {
  // get raw cookie
  const raw = (req.headers.cookie || '').match(/connect\.sid=([^;]+)/)?.[1];
  if (!raw) return res.status(400).json({ message: 'no connect.sid cookie' });

  // Decode + remove the s: prefix + verify the signature to obtain the "real sid"
  const decoded = decodeURIComponent(raw);             // "s:AG2dv...<sig>"
  const unsigned = decoded.startsWith('s:')
    ? signature.unsign(decoded.slice(2), cfg.session.secret) // ← real sid or false
    : decoded;

  if (!unsigned) return res.status(400).json({ message: 'bad cookie signature', decoded });
  const backend_sid = req.sessionID;
  // Look up the session store using the “real sid” (most authoritative method)
  req.sessionStore.get(unsigned, (err, sess) => {
    if (err) return res.status(500).json({ error: String(err) });
    res.json({
      cookieRaw: raw,
      decoded,                    // s:... format
      cookieSid: unsigned,        // real sid
      sessionID: req.sessionID,   // The sid identified for this request
      exists: !!sess,
      session: sess || null,
    });
  });
});

// logout
app.post('/v1/auth/logout', (req, res) => {
  const sess = req.session?.user;
  const cookieName = 'connect.sid'
  // destroy server Session
  req.session.destroy(() => {
    // clear browser Cookie
    res.clearCookie(cookieName, {
      // secure: true,   
      secure: false,
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24, // one day
    });
    res.json({ ok: true });
  });
});

app.use(verifyToken);  // This will reject requests without a valid Bearer token

// Define OpenAPI paths
const apiSpecPath = path.join(__dirname, './api/ArtCertAPI.yaml');
const controllersPath = path.join(__dirname, './controllers');

// Initialize OpenAPI backend
const api = new OpenAPIBackend({
  definition: apiSpecPath,
  strict: true,
  quick: true
});

// Register controllers
const controllers = {};
fs.readdirSync(controllersPath).forEach(file => {
  if (file.endsWith('.js')) {
    const controllerPath = path.join(controllersPath, file);
    console.log(`Loading controller: ${controllerPath}`);
    const controller = require(controllerPath);
    Object.assign(controllers, controller);
  }
});
api.register(controllers);

app.post(
  '/v1/registry',
  uploadRegistryFields,                   // Use multer to parse multipart
  (req, res, next) => api.handleRequest(req, res, next) // Pass it openapi-backend
);
app.put(
  '/v1/registry/artwork/:artwork',
  updateRegistryFields,                   // Use multer to parse multipart
  (req, res, next) => api.handleRequest(req, res, next) // Pass it openapi-backend
);
app.post(
  '/v1/verification/:artwork',
  uploadVerificationFields,                   // Use multer to parse multipart
  (req, res, next) => api.handleRequest(req, res, next) // Pass it openapi-backend
);
// Add default handlers
api.register({
  notFound: async (req, res) => utils.writeJson(res, 'Page Not Found', 404),
  validationFail: async (req, res) => {
    const validationErrors = req.validation.errors || [];
    const errorDetails = validationErrors.map(err => ({
      message: err.message,
      path: err.path,
      location: err.location,
    }));
    utils.writeJson(res, { message: 'Communication error', errors: errorDetails }, 400);
  },
});

console.log('(API):\n', api);

// Route requests through OpenAPI handler after auth check
app.use((req, res, next) => api.handleRequest(req, res, next));

// Initialize after registering everything
api.init();

// Start the server
async function startServer() {
  try {
    const test = await getDBPool();
    console.log('we have a pool');
  } catch (error) {
    console.error('Error connecting to DB ' + error);
    process.exit(1);
  }

  const server = http.createServer(app);

  server.requestTimeout = 10 * 60 * 1000;  // 10 minutes
  server.headersTimeout = 11 * 60 * 1000;  // must be greater than requestTimeout
  server.keepAliveTimeout = 10 * 1000;     // 10 minutes
  server.timeout = 0;                     // disabling legacy timeout

  server.listen(endpoint, "0.0.0.0", () => {
    console.log('Your server is listening on port %d (http://0.0.0.0:%d)', endpoint, endpoint);
    console.log(`Environment env is "${target_env}"`);
  });

  // http.createServer(app).listen(endpoint, "0.0.0.0", () => {
  //   console.log('Your server is listening on port %d (http://0.0.0.0:%d)', endpoint, endpoint);
  //   console.log(`Environment env is "${target_env}"`);
  //   // console.log(`DB schema is ${POSTGRES_DB}`);
  // });

}

startServer();
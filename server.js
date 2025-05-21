const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const passport = require('passport');
const session = require('express-session');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
require('dotenv').config();

const positionRoutes = require('./src/routes/positionRoutes');
const deviceRoutes = require('./src/routes/deviceRoutes');
const { findOrCreateUser } = require('./src/services/userService');

const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const app = express();

// session setup
app.use(session({
  secret: process.env.SESSION_SECRET || 'default_session_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: (process.env.SESSION_MAX_AGE_DAYS || 7) * 24 * 60 * 60 * 1000,
    secure: false,
    sameSite: 'none',
  },
}));

// passport config
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_REDIRECT_URI,
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const user = await findOrCreateUser(profile);
    return done(null, user);
  } catch (error) {
    return done(error, null);
  }
}));

// middleware
app.use(cors({
  origin: ['http://localhost:5173', 'https://locateme.synclab.dev'],
  credentials: true,
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());

// auth middleware
function isLoggedIn(req, res, next) {
  if (req.user) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// auth routes
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => res.redirect('/dashboard')
);

app.get('/logout', (req, res) => {
  req.logout(() => res.redirect('/'));
});

app.get('/auth/me', isLoggedIn, (req, res) => {
  res.json(req.user);
});

// API routes
app.use('/locateme/position', positionRoutes);
app.use('/locateme/devices', deviceRoutes);

// google login route
app.post('/auth/google/login', async (req, res) => {
  const { token } = req.body;

  console.log('GOOGLE_CLIENT_ID usado en backend:', process.env.GOOGLE_CLIENT_ID)
  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    console.log('✅ Payload recibido:', payload);

    // Asegura que al menos haya un email o ID
    if (!payload || !payload.sub || !payload.email) {
      return res.status(400).json({ error: 'Incomplete Google profile' });
    }

    const user = await findOrCreateUser(payload);

    if (!user.active) {
      console.warn('[AUTH] Usuario inactivo:', user.email)
      return res.status(403).json({ error: 'Inactive user, please contact your administrator' });
    }

    req.login(user, (err) => {
      if (err) return res.status(500).json({ error: 'Login failed' });
      return res.json(user);
    });
  } catch (error) {
    console.error('Error verifying token:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

// server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
});

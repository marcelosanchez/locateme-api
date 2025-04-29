const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const passport = require('passport');
const cookieSession = require('cookie-session');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
require('dotenv').config();

const positionRoutes = require('./src/routes/positionRoutes');
const { findOrCreateUser } = require('./src/services/userService');

const app = express();

// session setup
app.use(cookieSession({
  name: 'session',
  keys: [process.env.SESSION_SECRET || 'default_session_secret'],
  maxAge: (process.env.SESSION_MAX_AGE_DAYS || 7) * 24 * 60 * 60 * 1000,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
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
app.use(passport.initialize());
app.use(passport.session());
app.use(helmet());
app.use(cors());
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

app.get('/protected', isLoggedIn, (req, res) => {
  res.json({ message: 'Authenticated', user: req.user });
});

// API routes
app.use('/locateme/position', positionRoutes);

// server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
});

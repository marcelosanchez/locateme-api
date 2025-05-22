const { Strategy: GoogleStrategy } = require('passport-google-oauth20')
const { findOrCreateUser } = require('../services/userService')

function configurePassport(passport) {
  passport.serializeUser((user, done) => done(null, user))
  passport.deserializeUser((user, done) => done(null, user))

  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_REDIRECT_URI,
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      const user = await findOrCreateUser(profile)
      done(null, user)
    } catch (err) {
      done(err, null)
    }
  }))
}

module.exports = { configurePassport }

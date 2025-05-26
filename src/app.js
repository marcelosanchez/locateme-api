require('dotenv').config() // important
const allowedOrigins = process.env.CORS_ORIGINS?.split(',') || []

const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')
const session = require('express-session')
const passport = require('passport')
const pgSession = require('connect-pg-simple')(session)
const { pool } = require('./config/db.js')
const { configurePassport } = require('./config/passport')
const authRoutes = require('./routes/authRoutes')
const overviewRoutes = require('./routes/overviewRoutes')
const deviceRoutes = require('./routes/deviceRoutes')
const positionRoutes = require('./routes/positionRoutes')
const { isAuthenticated } = require('./middlewares/authMiddleware')

const app = express()

// global middlewares
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true)
    }
    return callback(new Error('Not allowed by CORS'))
  },
  credentials: true,
}))
app.use(helmet())
app.use(morgan('dev'))
app.use(express.json())

// session middleware
app.use(session({
  store: new pgSession({ pool, tableName: 'user_sessions' }),
  secret: process.env.SESSION_SECRET || 'default_session_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: (process.env.SESSION_MAX_AGE_DAYS || 7) * 24 * 60 * 60 * 1000,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  },
}))

// passport
configurePassport(passport)
app.use(passport.initialize())
app.use(passport.session())

// routes
app.use('/auth', authRoutes)

// protected
app.use('/locateme/overview', isAuthenticated, overviewRoutes)
app.use('/locateme/devices', isAuthenticated, deviceRoutes)

// public
app.use('/locateme/position', positionRoutes)

module.exports = app

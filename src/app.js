require('dotenv').config() // important
const allowedOrigins = process.env.CORS_ORIGINS?.split(',') || []

const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')

const authRoutes = require('./routes/authRoutes')
const deviceRoutes = require('./routes/deviceRoutes')
const positionRoutes = require('./routes/positionRoutes')
const mapRoutes = require('./routes/mapRoutes')
const sidebarRoutes = require('./routes/sidebarRoutes')
const { authenticateToken, isStaff } = require('./middlewares/authMiddleware')

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

// routes
app.use('/auth', authRoutes)

// protected
app.use('/locateme/devices', authenticateToken, deviceRoutes)
app.use('/locateme/map', authenticateToken, mapRoutes)
app.use('/locateme/sidebar', authenticateToken, sidebarRoutes)

// public
app.use('/locateme/position', positionRoutes)

module.exports = app

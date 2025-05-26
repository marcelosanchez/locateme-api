const express = require('express')
const path = require('path')
const app = express()
const PORT = process.env.PORT || 3000

// static assets
app.use(express.static(path.join(__dirname, 'dist')))

// catch-all route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'))
})

app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`)
})

const express = require('express')
const bodyParser = require('body-parser')
const handlebars = require('express-handlebars')
const mongoose = require('mongoose')
const cookieParser = require('cookie-parser')
const session = require('express-session')
const passport = require('./app/auth')
const router = require('./app/routes')

const app = express()

const server = router.initSocket(app)

// Connect to database
mongoose.Promise = global.Promise

let url
if (process.env.NODE_ENV === 'production') {
    url = `mongodb://ricardon:${process.env.mongopassword}@ds029745.mlab.com:29745/hometurf`
} else {
    url = 'mongodb://localhost/hometurf'
}
mongoose.connect(url)

/**
 * View Template Engine - Handlebars
 */

app.use(express.static('public'))

app.engine('handlebars', handlebars({
    defaultLayout: 'main'
}))
app.set('view engine', 'handlebars')

// Middlewares
app.use(cookieParser())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended: false}))
app.use(session({secret: 'fishing cats'}))
app.use(passport.initialize())
app.use(passport.session())

app.use('/', router)

server.listen(3000, function(req, res) {
  console.log('Server listening on port 3000')
})

module.exports = app
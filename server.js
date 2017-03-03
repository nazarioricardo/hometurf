const bodyParser = require('body-parser')
const mongoose = require('mongoose')
const passport = require('passport')

const Strategy = require('passport-local').Strategy
const User = require('./models/user')

const app = require('express')()

// Declare auth strategy
passport.use(new LocalStrategy(
    function(username, password, done) {
        User.findOne({username: username}, function(err, user) {
            if (err) return done(err)
            if (!user) return done(null, false)
            if (!user.verifyPassword(password)) return done(null, false)
            return done(null, user)
        })
    }
))

passport.serializeUser(function(user, cb) {
  cb(null, user.id);
});

passport.deserializeUser(function(id, cb) {
  User.findById(id, function (err, user) {
    if (err) { return cb(err); }
    cb(null, user);
  });
});

// Connect to database
mongoose.Promise = global.Promise;
mongoose.connect('mongodb://localhost/hometurf') // Create database 

// Route Handlers
app.get('/', getHomePage)
app.get('/login', getLogInPage)
app.post('/login', passport.authenticate('local', {failureRedirect: '/login'}), logInUser)
app.post('/signup', createNewUser)

// Route Handler Callbacks
function getHomePage(req, res) {

}

function getLogInPage(req, res) {

}

function logInUser(req, res) {
    res.redirect('/')
}

function createNewUser(req, res) {
    User.create(req.body, function(err, human) {
        if (err) return next(err)

        user = user.toJson()
        delete user.password
        return res.status(201).json(user)
    })
}

app.listen(3000, function(req, res) {
    console.log('Server listening on port 3000')
})
const bodyParser = require('body-parser')
const mongoose = require('mongoose')
const passport = require('passport')

const LocalStrategy = require('passport-local').Strategy
const User = require('./models/user')
const Community = require('./models/community')

const app = require('express')()

// Connect to database
mongoose.Promise = global.Promise;
mongoose.connect('mongodb://localhost/hometurf')

// Declare auth strategy
passport.use('local-signup', new LocalStrategy({
    usernameField: 'username',
    passwordField: 'password',
    passReqToCallback: true
},
    function(req, username, password, done) {
        process.nextTick(function() {
            User.findOne({username:'username'}, function(err, user) {
                if (user) {
                    return done(null, false, req.flash('signupMessage', 'That username is already taken'))
                }
            })
        })
    }
))

passport.use('local', new LocalStrategy(
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
    cb(null, user.id)
})

passport.deserializeUser(function(id, cb) {
    User.findById(id, function (err, user) {
        if (err) { return cb(err) }
        cb(null, user)
    })
})

app.use(function(err, req, res, next) {
    if (err.name === 'ValidationError') {
        return res.status(400).json(err.errors);
    }
    console.log(err);
    return res.status(500).send();
})

// Route Handlers
app.get('/:userId', getHomePage)

app.get('/login', getLogInPage)
app.post('/login', passport.authenticate('local'), bodyParser.json(), logInUser)
app.post('/signup', bodyParser.json(), createNewUser)

app.get('/communities', bodyParser.json(), getAllCommunities)
app.post('/communities', createCommunity)

// Route Handler Callbacks
function getHomePage(req, res) {
    
}

function getLogInPage(req, res) {

}

function logInUser(req, res) {
    return res.status(201).json(req.user.username)
}

function createNewUser(req, res) {
    User.create(req.body, function(err, user) {
        if (err) return next(err)

        user = user.toJSON()
        delete user.password
        // res.redirect('/login')
        return res.status(201).json(user)
    })
}

function getAllCommunities(req, res) {

    Community.find(function(err, results) {
        return res.status(404).json(results)
    })
}

function createCommunity(req, res) {
    console.log(req.params.id)
    Community.create(req.body, function(err, comm) {
        if (err) return next(err)

        comm = comm.toJSON()
        return res.status(201).json(comm)
    })
}

app.listen(3000, function(req, res) {
    console.log('Server listening on port 3000')
})
const bodyParser = require('body-parser')
const mongoose = require('mongoose')
const passport = require('passport')
const cookieParser = require('cookie-parser')

const LocalStrategy = require('passport-local').Strategy
const Session = require('express-session')
const User = require('./models/user')
const Community = require('./models/community')
const Unit = require('./models/unit')

const app = require('express')()

// Connect to database
mongoose.Promise = global.Promise
mongoose.connect('mongodb://localhost/hometurf')

// Declare auth strategy
passport.use('local', new LocalStrategy(
    function(username, password, next) {
        User.findOne({username: username}, function(err, user) {
            // console.log(user)
            if (err) return next(err)
            if (!user) return next(null, false) // No user found with username
            user.verifyPassword(password, function (err, passwordMatch) {
                if (err) console.log(err)
                if (passwordMatch) {
                    return next(null, user) // Success
                }
                return next(null, false) // Password did not match
            })
        })
    }
))

passport.serializeUser(function(user, callback) {
    callback(null, user.id)
})

passport.deserializeUser(function(id, callback) {
    User.findById(id, function (err, user) {
        if (err) return callback(err) 
        if (!user) return callback(err, false)
        return callback(null, user)
    })
})

app.use(cookieParser())
app.use(bodyParser.json())
app.use(Session({secret: 'fishing cats'}))
app.use(passport.initialize())
app.use(passport.session())

// Route Handlers
app.get('/login', getLogInPage)
app.get('/dashboard/:userId', bodyParser.json(), getHomePage)

app.post('/login', passport.authenticate('local', {failureRedirect: '/login'}), logInUser)
app.post('/signup', createNewUser)

app.get('/communities/:city', isLoggedIn, getCommunitiesByCity)
app.post('/community', isLoggedIn, bodyParser.json(), createCommunity)
app.post('/community/:cId', isLoggedIn, bodyParser.json(), addUnitsToCommunity)

// Route Handler Callbacks
function getHomePage(req, res) {
    User.findOne({'_id': req.params.id}, function(err, user) {
        if (err) return res.status(404).json(err)
        if (!user) return res.status(404).json({message: "No user with id"}) // No user found with id
        return res.status(201).json(user)
    })
}

function getLogInPage(req, res) {
    return res.status(200).json({message: "Please log in"})
}

function logInUser(req, res) {
    return res.status(200).json({user:req.user.username, message:"success"})
}

function createNewUser(req, res) {

    let user = new User(req.body)
    
    user.save(function(err, user) {
        if (err) return next(err)
        if (!user) return done(null, false)
        return res.status(201).json(user)
    })
}

function getCommunitiesByCity(req, res) {

    let city = req.params.city
    console.log("Current user: " + req.user.username)

    Community.findOne({city: city}, function(err, community) {
        if (err) return res.status(404).json(err)
        if (!community) return res.status(404).json({message: "No comm in city"})
        return res.status(200).json(community)
    })
}

function createCommunity(req, res) {

    let userId = req.user._id
    req.body.adminId = userId

    User.findOneAndUpdate({_id: userId}, {$set: {access:"community-admin"}}, function(err, user) {
        if (err) return next(err)
    })

    Community.create(req.body, function(err, community) {
        if (err) return res.status(404)
        community = community.toJSON()
        return res.status(201).json(community)
    })
}

function addUnitsToCommunity(req, res) {
    
    let listOfUnits = req.body
    let resList = new Array()
    for (var i = 0; i < listOfUnits.length; i++) {

        let newUnit = new Unit(listOfUnits[i])
        newUnit.communityId = req.params.cId                
        // console.log(newUnit)

        // Tried newUnit.save() but kept getting "save is not a function"
        Unit.create(newUnit, function(err, unit) {
            if (err) return res.status(404)
            if (!unit) return res.status(404)
            resList.push(unit)
        })
    }  
    // Keeps loading without .json()
    return res.status(201).json(resList)
}

function isLoggedIn(req, res, next) {
    // console.log("Current user: " + req.user.username)
    if (req.isAuthenticated()) return next()
    return res.redirect('/login')
}

app.listen(3000, function(req, res) {
    console.log('Server listening on port 3000')
})
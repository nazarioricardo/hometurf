const bodyParser = require('body-parser')
const mongoose = require('mongoose')
const passport = require('passport')
const cookieParser = require('cookie-parser')

const LocalStrategy = require('passport-local').Strategy
const Session = require('express-session')
const User = require('./models/user')
const Community = require('./models/community')
const Unit = require('./models/unit')
const Guest = require('./models/guest')

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

/**
 * Route Handlers
 */

// Login/Signup
app.get('/login', getLogInPage)
app.post('/login', passport.authenticate('local', {failureRedirect: '/login'}), logInUser)
app.post('/signup', createNewUser)

//Dashboard
app.get('/dashboard', isLoggedIn, getDashboard)
app.post('/addGuest/:unitId', isLoggedIn, addGuest)

// Onboarding
app.get('/findCommunity', getCommunities)
app.get('/findCommunity/:city', isLoggedIn, getCommunitiesByCity)
app.get('/findSuperUnit/:communityId', isLoggedIn, getSuperUnits)
app.get('/findUnit/:communityId/:superUnit', isLoggedIn, getUnits)
app.post('/addUnit/:unitId', isLoggedIn, addUserToUnit)


app.post('/community/:communityId', isLoggedIn, addUnitsToCommunity)
app.post('/community', isLoggedIn,createCommunity)

/**
 * Callbacks
 */

function getDashboard(req, res) {
    let access = req.user.access
    let userId = req.user._id

    Unit.find({residents: userId}, function(err, units) {
        if (err) return res.status(404)
        if (!units) return res.redirect('/communities')
        return res.json(units)
    })
}

function addGuest(req, res) {
    
    let guest = new Guest(req.body)
    guest.unit = req.params.unitId
    guest.approvedBy = req.user._id

    guest.save(function(err, guest) {
        if (err) return res.json(err)
        return res.json(guest)
    })
}

function getLogInPage(req, res) {
    return res.json({message: "Please log in"})
}

function logInUser(req, res) {
    return res.redirect('/dashboard')
}

function createNewUser(req, res) {

    let user = new User(req.body)
    
    user.save(function(err, user) {
        if (err) return res.json(err)
        return res.json(user)
    })
}

function getCommunities(req, res) {
    return res.json({message: "To begin your search, type the city in which you live."})
}

function getCommunitiesByCity(req, res) {

    let city = req.params.city

    Community.find({city: city}, function(err, communities) {
        if (err) return res.json(err)
        if (!communities) return res.json({message: "No community in city"})
        console.log(communities)
        return res.json(communities)
    })
}


function getSuperUnits(req, res) {
    Unit.find({communityId: req.params.communityId}).distinct('superUnit', function(err, superUnits) {
        console.log(superUnits)
        if (err) return res.json(err)
        if (!superUnits) return res.json({message: "No super units found"})
        return res.json(superUnits)
    })
}

function getUnits(req, res) {
    Unit.find({communityId: req.params.communityId, superUnit: req.params.superUnit}, function(err, units) {
        if (err) return res.json(err)
        if (!units) return res.json({message: "No units found"})
        return res.json(units)
    })
}

function addUserToUnit(req, res) {

    let unitId = req.params.unitId

    Unit.findOneAndUpdate({_id: unitId}, {$push: {residents:req.user._id}}, function(err, unit) {
        if (err) return next(err)
        return res.json(unit)
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
        return res.json(community)
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
    return res.json(resList)
}

function isLoggedIn(req, res, next) {
    // console.log("Current user: " + req.user.username)
    if (req.isAuthenticated()) return next()
    return res.redirect('/login')
}

app.listen(3000, function(req, res) {
    console.log('Server listening on port 3000')
})
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

// Community Admin
app.post('/community/:communityId', isLoggedIn, addUnitsToCommunity)
app.post('/community', isLoggedIn, createCommunity)

// Security Guard
app.get('/security/guests/:communityId', isLoggedIn, getGuests)
app.post('/updateGuest/:guestId', isLoggedIn, updateGuest)

/**
 * Callbacks
 */

// Login/Signup

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

// Dashboard

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
    
    if (req.user.access != 'security') {

        guest.unit = req.params.unitId
        guest.approvedBy = req.user._id

        Unit.findOne({_id: guest.unit}, function(err, unit) {
            if (err) return res.json(err)
            if (!unit) return res.json({message: "No unit found"})
            guest.community = unit.communityId
            guest.save(function(err, guest) {
                if (err) return res.json(err)
                return res.json(guest)
            })
        })
    }
}

// Onboarding

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

// Community Admin

function createCommunity(req, res) {

    let userId = req.user._id
    let userAccess = req.user.access
    req.body.adminId = userId

    if (userAccess == "community-admin") {

        let community = new Community()

        community.save(function(err, community) {
            if (err) return res.json(err)
            return res.json(community)
        })  
    }
}

function addUnitsToCommunity(req, res) {
    
    if (req.user.access == 'community-admin') {
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
        return res.json(resList)
    }
}

// Security

function getGuests(req, res) {

    if (req.user.access !== "security") {
        return res.status(403)
    }

    let communityId

    Community.findOne({securityId: req.user._id}, function(err, community) {
        if (err) return res.json(err)
        if (!community) return res.json({message: "No community found"})
        
        communityId = community._id

            Guest.find({community: communityId}, function(err, guests) {
            if (err) return res.json(err)
            if (!guests) return res.json({message: "No guests found"})
            return res.json(guests)
        })
    })

    
}

function updateGuest(req, res) {
    
    let guestId = req.params.guestId
    let issuerAccess = req.user.access

    Guest.findById(guestId, function(err, guest) {
        let status = ''
        if (issuerAccess == "security") {
            if (guest.status == 'In Transit') {
                guest.update({status: 'Passed Gate'}, function(err, guest) {
                    if (err) return res.json(err)
                    return res.json(guest)
                })
            } else if (guest.status == 'Confirmed') {
                guest.update({status: 'Left Community'}, function(err, guest) {
                    if (err) return res.json(err)
                    return res.json(guest)
                })
            } 
        } else {
            if (guest.status == "Passed Gate") {
                guest.update({status: 'Confirmed'}, function(err, guest) {
                    if (err) return res.json(err)
                    return res.json(guest)
                })
            }
        }
    })
}

// Middleware

function isLoggedIn(req, res, next) {
    // console.log("Current user: " + req.user.username)
    if (req.isAuthenticated()) return next()
    return res.redirect('/login')
}

app.listen(3000, function(req, res) {
    console.log('Server listening on port 3000')
})
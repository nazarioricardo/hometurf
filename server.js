const express = require('express')
const bodyParser = require('body-parser')
const handlebars = require('express-handlebars')
const mongoose = require('mongoose')
const passport = require('passport')
const cookieParser = require('cookie-parser')

const LocalStrategy = require('passport-local').Strategy
const Session = require('express-session')

const User = require('./models/user')
const Community = require('./models/community')
const Unit = require('./models/unit')
const Guest = require('./models/guest')
const Request = require('./models/request')

const app = express()

// Connect to database
mongoose.Promise = global.Promise
mongoose.connect('mongodb://localhost/hometurf')

/**
 * Handlebars
 */

// Configure static files
app.use(express.static('public'))

// Configure template engine for Server
app.engine('handlebars', handlebars({
    defaultLayout: 'main'
}))
app.set('view engine', 'handlebars')

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
app.use(bodyParser.urlencoded({extended: false}))
app.use(Session({secret: 'fishing cats'}))
app.use(passport.initialize())
app.use(passport.session())

/**
 * Route Handlers
 */

// Landing
app.get('/', function (req, res) {

    if (req.user) {
        return res.redirect('/dashboard')
    } else {
        return res.redirect('/login')
    }
})

// Login/Signup
app.get('/login', getLogInPage)
app.post('/login', passport.authenticate('local', {failureRedirect: '/login'}), logInUser)
app.get('/signup', getSignUpPage)
app.post('/signup', createNewUser)

//Dashboard
app.get('/dashboard', isLoggedIn, getDashboard)
app.get('/guests', isLoggedIn, residentGetGuests)
app.get('/requests', isLoggedIn, getRequests)
app.post('/addguest/:unitId', isLoggedIn, addGuest)
app.post('/request/:requestId', isLoggedIn, handleRequest)

// Onboarding
app.get('/findCommunity', getCities)
app.get('/findCommunity/:city', isLoggedIn, getCommunitiesByCity)
app.get('/findSuperUnit/:communityId', isLoggedIn, getSuperUnits)
app.get('/findUnit/:communityId/:superUnit', isLoggedIn, getUnits)
app.post('/sendRequest/:unitId', isLoggedIn, sendNewResidentRequest)

// Community Admin
app.post('/community/:communityId', isLoggedIn, addUnitsToCommunity)
app.post('/community', isLoggedIn, createCommunity)

// Security Guard
app.get('/security/guests/:communityId', isLoggedIn, securityGetGuests)
app.put('/updateGuest/:guestId', isLoggedIn, updateGuest)
app.post('/guestRequest/:unitId', isLoggedIn, sendNewGuestRequest)

/**
 * Callbacks
 */

// Login/Signup

function getLogInPage(req, res) {
    return res.render('login')
}

function logInUser(req, res) {
    return res.redirect('/dashboard')
}

function getSignUpPage(req, res) {
    return res.render('signup')
}

function createNewUser(req, res) {

    let user = new User(req.body)
    
    user.save(function(err, user) {
        if (err) return res.json(err).status(400)
        return res.json(user)
    })
}

// Dashboard

function getDashboard(req, res) {
    let access = req.user.access
    let userId = req.user._id

    Unit.find({residents: userId}, function(err, units) {
        if (err) return res.status(400)
        if (units.length === 0 && req.user.access === 'resident') return res.redirect('/findCommunity')

        let unitIds = units.map(unit => unit._id)

        Request.find({to: userId}, function(err, requests) {
            if (err) return res.status(400)
            
            Guest.find({unitId: {$in: unitIds}}, function(err, guests) {
                if (err) return res.status(400)
                if(!guests) return res.render('dashboard', {units: units, guests: [{name:'No Guests'}]})
                return res.render('dashboard', {units: units, guests: guests, requests: requests})
            })
        })
    })
}

function residentGetGuests(req, res) {

    Unit.find({residents: req.user._id}, function(err, units) {
        if (err) return res.json(err)
        if (!units) return res.json({message: 'No Units found'})

        console.log(units)
        let unitIds = units.map(unit => unit._id)

        Guest.find({unitId: {$in: unitIds}}, function(err, guests) {
            if (err) return res.json(err)
            if(!guests) return res.json({message: 'No Guests'})
            return res.json(guests)
        })
    })
}

function getRequests(req, res) {

    Request.find({to: req.user._id}, function(err, requests) {
        if (err) return res.json(err)
        if (!requests) return res.json({message: "You have no requests"})
        return res.json(requests)
    })
}

function addGuest(req, res) {
    
    let guest = new Guest()
    guest.name = req.body.name
    
    if (req.user.access != 'security') {

        guest.unitId = req.params.unitId
        guest.approvedBy = req.user._id

        Unit.findOne({_id: guest.unitId}, function(err, unit) {
            if (err) return res.json(err)
            if (!unit) return res.json({message: "No unit found"})
            guest.communityId = unit.communityId
            guest.save(function(err, guest) {
                if (err) return res.json(err)
                return res.status(201)
            })
        })
    }
}

function handleRequest(req, res) {
    
    let requestId = req.params.requestId
    let userToApprove = ''
    let unitId = ''

    Request.findById(requestId, function(err, request) {
        
        userToApprove = request.from
        unitId = request.unit
        if (request.requestType == 'New Resident Request') {
            if (req.body.approved == 'yes') {
                Unit.findOneAndUpdate({_id: unitId}, {$push: {residents:userToApprove}}, function(err, unit) {
                    if (err) return next(err)
                    request.remove(function(err, request) {
                        return res.json(unit)
                    })
                })
            } else {
                request.remove(function(err, request) {
                    return res.json(request)
                })
            }
        } else {

            let guest = new Guest()

            if (req.body.approved == 'yes') {

                if (req.user.access != 'security') {

                    guest.unit = req.params.unitId
                    guest.approvedBy = req.user._id

                    Unit.findOne({_id: guest.unit}, function(err, unit) {
                        if (err) return res.json(err)
                        if (!unit) return res.json({message: "No unit found"})
                        guest.community = unit.communityId
                        guest.status = "Passed Gate"
                        guest.save(function(err, guest) {
                            if (err) return res.json(err)
                            request.remove(function(err, request) {
                                return res.json(guest)
                            })
                        })
                    })
                }
            } else {
                    request.remove(function(err, request) {
                    return res.json({message: "Request removed"})
                })
            }
        }
    })
}

// Onboarding

function getCities(req, res) {

    Community.find({}).distinct('city', function(err, cities) {
        if (err) return res.status(400)
        cities.sort()
        return res.render('cities', {cities: cities})
    })
}

function getCommunitiesByCity(req, res) {

    let city = req.params.city

    Community.find({city: city}, function(err, communities) {
        if (err) return res.json(err)
        if (!communities) return res.json({message: "No community in city"})
        communities.sort()
        return res.render('communities', {communities: communities})
    })
}

function getSuperUnits(req, res) {
    let communityId = req.params.communityId
    Unit.find({communityId: communityId}).distinct('superUnit', function(err, superUnits) {
        if (err) return res.status(400)
        superUnits.sort()
        return res.render('superUnits', {superUnits: superUnits, communityId: communityId})
    })
}

function getUnits(req, res) {
    let communityId = req.params.communityId
    let superUnit = req.params.superUnit
    Unit.find({communityId: communityId, superUnit: superUnit}, function(err, units) {
        if (err) return res.status(400)
        units.sort()
        return res.render('units', {units: units})
    })
}

function sendNewResidentRequest(req, res) {

    let unitId = req.params.unitId
    let unitName = ''

    let request = new Request()
    request.from = req.user._id
    request.unit = unitId  
    request.requestType = 'New Resident Request' 

    Unit.findById(unitId, function(err, unit) {
        if (err) return res.json(err)
        if (!unit) return res.json({message: 'No unit found'})
        unitName = unit.name + " " + unit.superUnit
        request.message = req.user.username + " would like to be approved as a resident for " + unitName

        if (unit.residents.length === 0) {

            let adminId = ''
            let communityId = unit.communityId

            Community.findById(communityId, function(err, community) {
                adminId = community.adminId
                request.to.push(adminId)

                request.save(function(err, request) {
                    if (err) return res.json(err)
                    return res.json(request)
                })
            })
        } else {
            request.to = unit.residents
            request.save(function(err, request) {
                if (err) return res.json(err)
                return res.json(request)
            })
        }
    })
}

// Community Admin

function createCommunity(req, res) {

    let userId = req.user._id
    let userAccess = req.user.access

    if (userAccess == "community-admin") {

        let community = new Community(req.body)
        community.adminId = userId

        community.save(function(err, community) {
            if (err) return res.json(err)
            return res.json(community)
        })  
    }
}

function addUnitsToCommunity(req, res) {
    
    if (req.user.access == 'community-admin') {
        let listOfUnits = req.body

        listOfUnits.map(function(newUnit) {

            newUnit.communityId = req.params.communityId
            let unit = new Unit(newUnit)

            console.log(unit)
            unit.save(function(err, unit) {
                if (err) return res.json(err)
            })
        })
        return res.json(listOfUnits)
    }
}

// Security

function securityGetGuests(req, res) {

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

function sendNewGuestRequest(req, res) {

    let request = new Request()
    let superUnit = req.body.superUnit
    let unitId = req.params.unitId
    request.unit = unitId
    request.from = req.user._id
    request.requestType = "Guest Request"

    Unit.findOne({_id: unitId}, function(err, unit) {
        
        if (err) return res.json(err)
        if (!unit) return res.json({message: "No unit found"})
        request.to = unit.residents

        let unitName = unit.name + " " + unit.superUnit

        request.message = req.body.guestName + " is at the gate to visit " + unitName

        request.save(function(err, request) {
            if (err) return res.json(err)
            return res.json(request)
        })
    })
}

function isLoggedIn(req, res, next) {
    // console.log("Current user: " + req.user.username)
    if (req.isAuthenticated()) return next()
    return res.redirect('/login')
}

app.listen(3000, function(req, res) {
  console.log('Server listening on port 3000')
})

module.exports = app
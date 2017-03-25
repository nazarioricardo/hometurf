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

// Login/Signup
app.get('/', getLandingPage)
app.post('/login', passport.authenticate('local', {failureRedirect: '/login'}), logInUser)
app.get('/signup', getSignUpPage)
app.post('/signup', createNewUser)
app.get('/logout', logOut)

//Dashboard
app.get('/dashboard', isLoggedIn, getDashboard)
app.post('/addguest/:unitId', isLoggedIn, addGuest)
app.post('/request/:requestId', isLoggedIn, handleRequest)

// Onboarding
app.get('/findCommunity', getCities)
app.get('/findCommunity/:city', getCommunitiesByCity)
app.get('/findSuperUnit/:communityId', isLoggedIn, getSuperUnits)
app.get('/findUnit/:communityId/:superUnit', isLoggedIn, getUnits)
app.post('/sendRequest/:unitId', isLoggedIn, sendNewResidentRequest)
app.get('/standby', isLoggedIn, standby)

// Community Admin
app.post('/community/:communityId', isLoggedIn, addUnitsToCommunity)
app.post('/community', isLoggedIn, createCommunity)

// Security Guard
app.get('/securityDashboard', isLoggedIn, getSecurityDashbaoard)
app.post('/updateGuest/:guestId', isLoggedIn, updateGuest)
app.post('/guestRequest', isLoggedIn, sendNewGuestRequest)

/**
 * Callbacks
 */

// Login/Signup

function getLandingPage(req, res) {

    if (req.user) {
        if (req.user.access === 'security') {  
            return res.redirect('/securityDashboard')
        } else {
            return res.redirect('/dashboard')
        }
    } 
    return res.render('landing', {title: 'Hometurf'})
}

function logInUser(req, res) {
    if (req.user.access === 'security') return res.redirect('/securityDashboard')
    return res.redirect('/dashboard')
}

function getSignUpPage(req, res) {
    return res.render('signup')
}

function createNewUser(req, res) {

    let user = new User(req.body)
    
    user.save(function(err, user) {
        if (err) return res.json(err).status(400)
        return res.redirect('/login')
    })
}

// Dashboard

function getDashboard(req, res) {
    let access = req.user.access
    let userId = req.user._id
    let userUnits = []
    let userReqs = []
    let userGuests = []

    if (access === 'security') return res.status(403)

    getDataForDashboard(userId, function(err, units, requests, guests) {
        if (err) return res.status(400)
        
        if(units.length === 0 && req.user.access === 'resident') {
            Request.findOne({from: userId}, function(err, request) {
                if (err) return res.status(400)
                if (request != null) return res.redirect('/standby')
                return res.redirect('/findCommunity')
            })
        } else {
            return res.render('dashboard', {
                title: req.user.username, 
                units: units, 
                guests: guests,
                requests: requests,
                navRight: "logout",
                navRightText: "Log Out"
            })
        }
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
                return res.status(201).redirect('/dashboard')
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
            if (req.body.approved.includes('yes')) {
                Unit.findOneAndUpdate({_id: unitId}, {$push: {residents:userToApprove}}, function(err, unit) {
                    if (err) return next(err)
                    request.remove(function(err, request) {
                        return res.redirect('/dashboard')
                    })
                })
            } else {
                request.remove(function(err, request) {
                    return res.redirect('/dashboard')
                })
            }
        } else {

            let guest = new Guest()

            if (req.body.approved.includes('yes')) {

                if (req.user.access != 'security') {

                    guest.name = request.message.split(" is")[0]
                    guest.unitId = request.unit
                    guest.approvedBy = req.user._id

                    Unit.findOne({_id: guest.unitId}, function(err, unit) {
                        if (err) return res.json(err)
                        if (!unit) return res.json({message: "No unit found"})
                        guest.communityId = unit.communityId
                        guest.status = "Passed Gate"
                        guest.save(function(err, guest) {
                            if (err) return res.json(err)
                            request.remove(function(err, request) {
                                return res.redirect('/dashboard')
                            })
                        })
                    })
                }
            } else {
                    request.remove(function(err, request) {
                    return res.redirect('/dashboard')
                })
            }
        }
    })
}

function logOut(req, res) {
    req.session.destroy(function (err) {
        res.redirect('/')
  })
}

// Onboarding

function getCities(req, res) {

    Community.find({}).distinct('city', function(err, cities) {
        if (err) return res.status(400)
        cities.sort()
        return res.render('cities', {
            cities: cities,
            navRight: "logout",
            navRightText: "Log Out"
        })
    })
}

function getCommunitiesByCity(req, res) {

    let city = req.params.city

    Community.find({city: city}, function(err, communities) {
        if (err) return res.json(err)
        if (!communities) return res.json({message: "No community in city"})
        communities.sort()
        return res.render('communities', {
            communities: communities,
            navRight: "logout",
            navRightText: "Log Out"
        })
    })
}

function getSuperUnits(req, res) {
    let communityId = req.params.communityId
    Unit.find({communityId: communityId}).distinct('superUnit', function(err, superUnits) {
        if (err) return res.status(400)
        superUnits.sort()

        Community.find({_id: communityId}, function(err, community) {
            if (err) return res.status(400)

            return res.render('superUnits', {
                superUnits: superUnits, 
                communityId: communityId,
                superUnitType: community.superUnitType,
                navRight: "logout",
                navRightText: "Log Out"
            })
        }) 
    })
}

function getUnits(req, res) {
    let communityId = req.params.communityId
    let superUnit = req.params.superUnit
    
    Unit.find({communityId: communityId, superUnit: superUnit}, function(err, units) {
        if (err) return res.status(400)
        units.sort()
        return res.render('units', {
            units: units,
            navRight: "logout",
            navRightText: "Log Out" 
        })
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
                    return res.redirect('/standby')
                })
            })
        } else {
            request.to = unit.residents
            request.save(function(err, request) {
                if (err) return res.json(err)
                return res.redirect('/standby')
            })
        }
    })
}

function standby(req, res) {
    return res.render('standby', {
        navRight: "logout",
        navRightText: "Log Out" 
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

function getSecurityDashbaoard(req, res) {

    if (req.user.access !== "security") {
        return res.status(403)
    }

    getDataForSecDashboard(req.user._id, function(err, community, guests) {
        if (err) return res.status(400)
        return res.render('securityDashboard', {
            title: 'Security ' + req.user.username,
            community: community,
            guests: guests,
            navRight: "logout",
            navRightText: "Log Out"
        })
    }) 
}

function updateGuest(req, res) {
    
    let guestId = req.params.guestId
    let issuerAccess = req.user.access

    Guest.findById(guestId, function(err, guest) {
        let status = ''

        if (issuerAccess === "resident") {

            guest.remove(function(err) {
                if (err) return res.status(400)
                return res.redirect('/dashboard')
            })
        } else {

            Community.findOne({securityId: req.user._id}, function(err, community) {
                    if (guest.status === 'In Transit') {
                    guest.update({status: 'Passed Gate'}, function(err, guest) {
                        if (err) return res.json(err)
                        return res.redirect('/securityDashboard') 
                    }) 
                }  
            }) 
        }
    })
}

function sendNewGuestRequest(req, res) {

    console.log(req.body)

    let request = new Request()
    let guestName = req.body.guestName
    let superUnit = req.body.superUnit
    let unitName = req.body.unitName
    let unitId = ''
    let communityId = ''
    request.from = req.user._id
    request.requestType = "Guest Request"

    Community.findOne({securityId: req.user._id}, function(err, community) {
        if (err) return res.json(err)
        if (!community) return res.json({message: "No community found"})
        communityId = community._id
        console.log(communityId)
        Unit.findOne({name: unitName, superUnit: superUnit, communityId: communityId}, function(err, unit) {
            if (err) return res.json(err)
            if (!unit) return res.json({message: "No unit found"})
            request.to = unit.residents
            request.unit = unit._id

            unitName = unit.name
            superUnit = unit.superUnit
            unitAddress = unitName + " " + superUnit

            request.message = guestName + " is at the gate to visit " + unitAddress

            request.save(function(err, request) {
                if (err) return res.json(err)
                return res.redirect('/securityDashboard')
            })
        })
    })
}

function isLoggedIn(req, res, next) {
    // console.log("Current user: " + req.user.username)
    if (req.isAuthenticated()) return next()
    return res.redirect('/')
}

app.listen(3000, function(req, res) {
  console.log('Server listening on port 3000')
})

/**
 * Query Functions
 */

// Dashboard

function getUserUnits(userId, callback) {
    Unit.find({residents: userId}, function (err, units) {
        if (err) return callback(err)
        if (units) return callback(null, units)
    })
}

function getUserRequests(userId, callback) {
    Request.find({to: userId}, function (err, requests) {
        if (err) return callback(err)
        if (requests) return callback(null, requests)
    })
}

function getUserGuests(unitIds, callback) {
    Guest.find({unitId: {$in: unitIds}}, function(err, guests) {
        if (err) return callback(err)
        if (guests) return callback(null, guests)
    })
}

function getDataForDashboard(userId, callback) {
    
    getUserUnits(userId, function(err, units) {
        if (err) return callback(err)
        getUserRequests(userId, function (err, requests) {
            if (err) return callback(err)
            getUserGuests(units.map(unit => unit._id), function(err, guests) {
                if (err) return callback(err)
                return callback(null, units, requests, guests)
            })
        })
    })
}

// Security Dashboard

function getSecurityCommunity(userId, callback) {
    Community.findOne({securityId: userId}, function(err, community) {
        if (err) return callback(err)
        return callback(null, community)
    })
}

function getCommunityGuests(communityId, callback) {
    Guest.find({communityId: communityId}, function(err, guest) {
        if (err) return callback(err)
        return callback(null, guest)
    })
}

function getDataForSecDashboard(userId, callback) {

    getSecurityCommunity(userId, function(err, community) {
        if (err) return callback(err)
        getCommunityGuests(community._id, function(err, guests) {
            if (err) return callback(err)
            return callback(null, community, guests)
        })
    })
}

module.exports = app
const db = require('./database')

/**
 * Callbacks
 */

// Login/Signup

function getLandingPage(req, res) {

    if (req.user) {
        res.redirect(redirectToDashboard(req.user.access))
    } 
    return res.render('landing', {title: 'Hometurf'})
}

function logInUser(req, res) {
    res.redirect(redirectToDashboard(req.user.access))
}

function getSignUpPage(req, res) {
    return res.render('signup')
}

function createNewUser(req, res) {

    let user = new User(req.body)
    
    user.save(function(err, user) {
        if (err) return res.json(err).status(400)
        return res.redirect('/')
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
            io.on('connection', function(socket) {
                for (let i = 0; i < units.length; i++) {
                    socket.join(units[i]._id)
                }
            })
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
    
    let guest = new Guest(req.body)
    
    if (req.user.access != 'security') {

        guest.unitId = req.params.unitId
        guest.approvedBy = req.user._id

        Unit.findOne({_id: guest.unitId}, function(err, unit) {
            if (err) return res.json(err)
            if (!unit) return res.json({message: "No unit found"})
            guest.communityId = unit.communityId
            guest.save(function(err, guest) {
                if (err) return res.json(err)
                io.to("sec" + guest.communityId).emit('new guest', guest)
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
                        res.redirect(redirectToDashboard(req.user.access))
                    })
                })
            } else {
                request.remove(function(err, request) {
                    res.redirect(redirectToDashboard(req.user.access))
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
                            io.to("sec" + unit.communityId).emit('new guest', guest)
                            request.remove(function(err, request) {
                                res.redirect(redirectToDashboard(req.user.access))
                            })
                        })
                    })
                }
            } else {
                    request.remove(function(err, request) {
                        res.redirect(redirectToDashboard(req.user.access))
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

function findCities(req, res) {

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

function findCommunitiesByCity(req, res) {

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

function findSuperUnits(req, res) {
    let communityId = req.params.communityId
    
    Unit.find({communityId: communityId}).distinct('superUnit', function(err, superUnits) {
        if (err) return res.status(400)
        if (superUnits.length === 0) return res.json({msg: 'No superunits found'})
        superUnits.sort()

        Community.findById(communityId, function(err, community) {
            if (err) return res.status(400)
            if (!community) return res.json({msg: 'No community found'})
            return res.render('superunits', {
                superUnits: superUnits, 
                communityId: communityId,
                superUnitType: community.superUnitType,
                navRight: "logout",
                navRightText: "Log Out"
            })
        }) 
    })
}

function findUnits(req, res) {
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
                    io.to("admin" + communityId).emit('new request', request)
                    return res.redirect('/standby')
                })
            })
        } else {
            request.to = unit.residents
            request.save(function(err, request) {
                if (err) return res.json(err)
                io.to(unitId).emit('new request', request)
                return res.redirect('/standby')
            })
        }
    })
}

function standby(req, res) {

    Unit.find({residents:req.user._d}, function(err, units) {
        if (err) return res.status(400)
        if (units.length === 0) return res.render('standby', {
            navRight: "logout",
            navRightText: "Log Out" 
        })
        return res.redirect('/dashboard')
    })
    
}

// Community Admin

function getCommunityDashboard(req, res) {
    getDataForCommunityDashboard(req.user._id, function(err, community, requests, superUnits, units, guards) {
        if (err) return res.status(400)
        if (!community) return res.redirect('/createCommunity')
        io.on('connection', function(socket) {
            socket.join("admin" + community._id)
        })
        return res.render('communityDashboard', {
            title: "Community Admin " + req.user.username,
            community: community,
            requests: requests,
            superUnits: superUnits,
            units: units,
            guards: guards,
            navRight: "logout",
            navRightText: "Log Out"
        })
    })
}

function createUnits(req, res) {
    
    if (req.user.access !== 'community-admin') return res.status(400)
    
    let superUnit = req.body.superUnit
    let communityId = req.params.communityId
    let unitPrefix = req.body.unitPrefix
    let lowestNumber = Number(req.body.lowestNumber)
    let highestNumber = Number(req.body.highestNumber)
    let listOfUnits = []

    for (let i = lowestNumber; i <= highestNumber; i++) {
        let unit = new Unit({
            superUnit: superUnit,
            name: unitPrefix + i,
            communityId: communityId
        })
        listOfUnits.push(unit)
    }

    Unit.insertMany(listOfUnits, function(err, units) {
        if (err) return res.status(400)
        return res.redirect('/communityDashboard')
    })
}

function getCreateCommunity(req, res) {
    return res.render('createCommunity', {
        navRight: "logout",
        navRightText: "Log Out"
    })
}

function grantSecurityStatus(req, res) {
    User.findOneAndUpdate({username: req.body.username}, {$set: {access: "security"}}, function(err, user) {
        if (err) return res.status(400)
        Community.findOneAndUpdate({adminId: req.user._id}, {$push: {securityId: user._id}}, function(err, community) {
            if (err) return res.status(400)
            return res.redirect('/communityDashboard')
        })
    })
}

function createCommunity(req, res) {

    if (req.user.access === 'community-admin') {

        let newCommunity = new Community({
            name: req.body.name,
            city: req.body.city,
            adminId: req.user._id,
            administrationEmail: req.body.administrationEmail,
            administration: req.body.administration
        })
    
        if (req.body.superUnitType.includes('Street')) {
            newCommunity.superUnitType = 'Street'
        } else {
            newCommunity.superUnitType = 'Floor'
        }

        newCommunity.save(function(err, community) {
            if (err) return res.json(err)
            return res.redirect('/communityDashboard')
        }) 
    }
}

// Security

function getSecurityDashbaoard(req, res) {

    if (req.user.access !== "security") {
        return res.status(403)
    }

    getDataForSecDashboard(req.user._id, function(err, community, guests) {
        if (err) return res.status(400)

        io.on('connection', function(socket) {
            socket.join("sec" + community._id)
        })
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
        if (err) return res.status(404)
        
        let status = ''

        if (issuerAccess === "resident") {

            guest.remove(function(err) {
                if (err) return res.status(400)
                io.to("sec" + guest.communityId).emit('guest confirmed', guest)
                return res.redirect('/dashboard')
            })
        } else {

            Community.findOne({securityId: req.user._id}, function(err, community) {
                    if (guest.status === 'In Transit') {
                    guest.update({status: 'Passed Gate'}, function(err, updatedGuest) {
                        if (err) return res.status(400)
                        console.log(io.sockets.adapter.rooms)
                        console.log(guest.unitId)
                        io.to(guest.unitId).emit('guest confirmed', guest)
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
                io.to(unit._id).emit('new request', request)
                return res.redirect('/securityDashboard')
            })
        })
    })
}

// Hometurf Admin

function getAdminDashboard(req, res) {
    if (req.user.access !== 'hometurf-admin') {
        return res.status(403)
    }
    return res.render('adminDashboard', {
        title: 'Master Admin',
        navRight: 'logout',
        navRightText: 'Log Out'
    })
}

function grantCommunityAdmin(req, res) {

    User.findOneAndUpdate({username: req.body.username}, {$set: {access: 'community-admin'}}, function(err, user) {
        if (err) return res.status(400)
        return res.redirect('/adminDashboard')
    })
}

function isLoggedIn(req, res, next) {
    // console.log("Current user: " + req.user.username)
    if (req.isAuthenticated()) return next()
    return res.redirect('/')
}
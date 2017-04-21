const User = require('../models/user')
const Community = require('../models/community')
const Unit = require('../models/unit')
const Guest = require('../models/guest')
const Request = require('../models/request')

/**
 * Query Functions
 */

// Resident Dashboard

let getUserUnits = function(userId, callback) {
    Unit.find({residents: userId}, function (err, units) {
        if (err) return callback(err)
        if (units) return callback(null, units)
    })
}

let getUserRequests = function(userId, callback) {
    Request.find({to: userId}, function (err, requests) {
        if (err) return callback(err)
        if (requests) return callback(null, requests)
    })
}

let getUserGuests = function(unitIds, callback) {
    Guest.find({unitId: {$in: unitIds}}, function(err, guests) {
        if (err) return callback(err)
        if (guests) return callback(null, guests)
    })
}

exports.getDataForDashboard = function(userId, callback) {
    
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

exports.unexpectedGuestHandler = function(approved, request, resident, callback) {

    let guest = new Guest()

    console.log("Approved? " + approved)

    if (approved.includes('yes')) {
        if (resident.access === 'resident') {
            guest.name = request.message.split(" is")[0]
            guest.unitId = request.unit
            guest.approvedBy = resident._id

            Unit.findById(guest.unitId, function(err, unit) {
                if (err) return callback(err)
                if (!unit) return callback(null, null)
                guest.communityId = unit.communityId
                guest.status = 'Passed Gate'
                guest.save(function(err, guest) {
                    if (err) return callback(err)
                    request.remove(function(err, request) {
                        return callback(null, unit, guest)
                    })
                })
            })
        }
    } else {
        request.remove(function(err, request) {
            callback(null, false)
        })
    }
}

// Community Dashboard

let getCommunity = function(userId, callback) {
    Community.findOne({adminId: userId}, function(err, community) {
        if (err) return callback(err)
        return callback(null, community)
    })
}

let getCommunityRequests = function(userId, callback) {
    Request.find({to: userId}, function(err, requests) {
        if (err) return callback(err)
        return callback(null, requests)
    })
}

let getSuperUnits = function(communityId, callback) {
    Unit.find({communityId: communityId}).distinct('superUnit', function(err, superUnits) {
        if (err) return callback(err)
        return callback(null, superUnits)
    })
}

let getUnits = function(communityId, callback) {
    Unit.find({communityId: communityId}, function(err, units) {
        if (err) return callback(err)
        return callback(null, units)
    })
}

let getSecurityGuards = function(communityId, callback) {
    
    Community.findOne({_id: communityId}, function(err, community) {
        if (err) return callback(err)
        User.find({_id: community.securityId}, function(err, securityUser) {
            if (err) return callback(err)
            return callback(null, securityUser)
        })
    })
}

exports.getDataForCommunityDashboard = function(userId, callback) {
    getCommunity(userId, function(err, community) {
        if (err) return callback(err)
        if (!community) return callback(null, null)
        getCommunityRequests(userId, function(err, requests) {
            if (err) return callback(err)
            getSuperUnits(community._id, function(err, superUnits) {
                if (err) return callback(err)
                getUnits(community._id, function(err, units) {
                    if (err) return callback(err)
                    getSecurityGuards(community._id, function(err, securityUser) {
                        if (err) return callback(err)
                        superUnits.sort()
                        units.sort()
                        securityUser.sort()
                        return callback(null, community, requests, superUnits, units, securityUser)
                    })
                })
            })
        })
    })
}

exports.newResidentHandler = function(approved, request, fromId, callback) {

    if (request.requestType === 'New Resident Request') {
        if (approved.includes('yes')) {
            Unit.findOneAndUpdate({ _id: request.unit }, { $push: { residents: fromId } }, function (err, unit) {
                if (err) return callback(err)
                request.remove(function (err, request) {
                    return callback(null, true)
                })
            })
        } else {
            request.remove(function (err, request) {
                return callback(null, false)
            })
        }
    }
}

// Security Dashboard

let getSecurityCommunity = function(userId, callback) {
    Community.findOne({securityId: userId}, function(err, community) {
        if (err) return callback(err)
        return callback(null, community)
    })
}

let getCommunityGuests = function(communityId, callback) {
    Guest.find({communityId: communityId}, function(err, guest) {
        if (err) return callback(err)
        return callback(null, guest)
    })
}

exports.getDataForSecDashboard = function(userId, callback) {

    getSecurityCommunity(userId, function(err, community) {
        if (err) return callback(err)
            getCommunityGuests(community._id, function(err, guests) {
                if (err) return callback(err)
                return callback(null, community, guests)
            })
    })
}
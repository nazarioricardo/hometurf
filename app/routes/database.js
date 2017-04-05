/**
 * Query Functions
 */

// Resident Dashboard

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

// Community Dashboard

function getCommunity(userId, callback) {
    Community.findOne({adminId: userId}, function(err, community) {
        if (err) return callback(err)
        return callback(null, community)
    })
}

function getCommunityRequests(userId, callback) {
    Request.find({to: userId}, function(err, requests) {
        if (err) return callback(err)
        return callback(null, requests)
    })
}

function getSuperUnits(communityId, callback) {
    Unit.find({communityId: communityId}).distinct('superUnit', function(err, superUnits) {
        if (err) return callback(err)
        return callback(null, superUnits)
    })
}

function getUnits(communityId, callback) {
    Unit.find({communityId: communityId}, function(err, units) {
        if (err) return callback(err)
        return callback(null, units)
    })
}

function getSecurityGuards(communityId, callback) {
    
    Community.findOne({_id: communityId}, function(err, community) {
        if (err) return callback(err)
        User.find({_id: community.securityId}, function(err, securityUser) {
            if (err) return callback(err)
            return callback(null, securityUser)
        })
    })
}

function getDataForCommunityDashboard(userId, callback) {
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
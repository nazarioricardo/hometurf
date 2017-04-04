const passport = require('passport')
const LocalStrategy = require('passport-local').Strategy

const User = require('../models/user')

let init = function() {
    passport.use('local', new LocalStrategy(
        function(username, password, next) {
            User.findOne({username: username}, function(err, user) {
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
        }))
        
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
    return passport
}

module.exports = init()
const mongoose = require('mongoose')
const bcrypt = require('bcrypt')

const userSchema = mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true
    },

    password: {
        type: String,
        required: true,
    },
    
    access: {
        type: String,
        required: true,
        enum: ['community-admin', 'security', 'resident', 'hometurf-admin'],
        default: "resident"
    },
    
    created: {
        type: Date,
        required: true,
        default: Date.now
    }
})

userSchema.pre('save', function(next) {
    let user = this
    // Save password if modified or new
    if (!user.isModified('password')) return next()

    // Generate a salt
    bcrypt.genSalt(10, function(err, salt) {
        if (err) return next(err)

        bcrypt.hash(user.password, salt, function(err, hash) {
            if (err) return next(err)

            // Override clear text password with the hashed password
            user.password = hash
            return next()
        })
    })
})

userSchema.methods.verifyPassword = function(candidatePassword, callback) {
    bcrypt.compare(candidatePassword, this.password, callback)
}

module.exports = mongoose.model("user", userSchema)
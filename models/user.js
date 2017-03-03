const mongoose = require('mongoose')
const bcrypt = require('bcrypt'
)
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
        enum: ['community-admin', 'security', 'resident']
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

        bcrypt.hash(human.password, salt, function(err, hash) {
            if (err) return next(err)

            // Overried clear text password with the hashed password
            human.password = hash
            return next()
        })
    })
})

userSchema.methods.comparePassword = function(candidatePassword, cb) {
    bcrypt.compare(candidatePassword, this.password, cb)
}

module.exports = mongoose.model("user", userSchema)
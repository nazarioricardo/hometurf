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
    }
})
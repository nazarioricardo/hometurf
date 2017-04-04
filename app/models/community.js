const mongoose = require('mongoose')

const communitySchema = mongoose.Schema({
    name: {
        type: String,
        required: true
    },

    administration: {
        type: String,
        required: true
    },

    administrationEmail: {
        type: String,
        required: true
    },

    adminId: {  
        // User
        type: String,
        required: true,
        unique: true
    },

    securityId: {
        type: [String],
    },

    superUnitType: {
        type: String,
        required: true,
        enum: ['Street', 'Floor']
    },

    city: {
        type: String,
        required: true
    },

    created: {
        type: Date,
        required: true,
        default: Date.now
    }
})

module.exports = mongoose.model("community", communitySchema)
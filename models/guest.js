const mongoose = require('mongoose')

const guestSchema = mongoose.Schema({
    name: {
        type: String,
        required: true
    },

    community: {
        type: String,
        required: true
    },

    unit: {
        type: String,
        required: true
    },

    approvedBy: {
        type: String,
    },

    status: {
        type: String,
        required: true,
        enum: ["In Transit", "Passed Gate", "Confirmed", "Left Community"],
        default: "In Transit"
    },

    created: {
        type: Date,
        required: true,
        default: Date.now,
        expires: 1800
    }
})

module.exports = mongoose.model("guest", guestSchema)
const mongoose = require('mongoose')

const guestSchema = mongoose.Schema({
    name: {
        type: String,
        required: true
    },

    unit: {
        type: String,
        required: true
    },

    approvedBy: {
        type: String,
        required: true
    },

    status: {
        type: String,
        required: true,
        enum: ["In Transit", "Passed Gate", "Confirmed", "Left"],
        default: "In Transit"
    },

    created: {
        type: Date,
        required: true,
        default: Date.now
    }
})

module.exports = mongoose.model("guest", guestSchema)
const mongoose = require('mongoose')

const requestSchema = mongoose.Schema({
    from: {
        type: String,
        required: true
    },

    to: {
        type: [String],
        required: true
    },

    unit: {
        type: String,
        required: true
    },

    requestType: {
        type: String,
        required: true,
        enum: ['New Resident Request', 'Guest Request']
    },

    message: {
        type: String,
    },

    created: {
        type: Date,
        required: true,
        default: Date.now,
        expires: 3600
    }
})

module.exports = mongoose.model("request", requestSchema)
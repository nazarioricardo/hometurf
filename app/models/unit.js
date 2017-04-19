const mongoose = require('mongoose')

const unitSchema = mongoose.Schema({
    name: {
        type: String,
        required: true
    },

    superUnit: {
        type: String,
        required: true
    },

    communityId: {
        type: String,
        required: true
    },

    residents: {
        type: [String],   
    }

})

module.exports = mongoose.model("unit", unitSchema)
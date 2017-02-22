const mongoose = require('mongoose')

const superUnitSchema = mongoose.Schema({
    name: {
        type: String,
        required: true
    },

    community: {
        type: String,
        required: true
    }
})

module.exports = mongoose.model("super-unit", superUnitSchema)

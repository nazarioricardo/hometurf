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

    admin: {  
        // User
        type: String,
        required: true
    }
})

module.exports = mongoose.model("community", communitySchema)
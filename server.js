const express = require('express')
const handlebars = require('express-handlebars')
const bodyParser = require('body-parser')
const mongoose = require('mongoose')

const app = express()

// Connect to database
mongoose.Promise = global.Promise;
mongoose.connect('mongodb://localhost/blog')




app.listen(3000, function(req, res) {
    console.log('Server listening on port 3000')
})
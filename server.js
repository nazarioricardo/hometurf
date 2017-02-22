const express = require('express')
const handlebars = require('express-handlebars')
const bodyParser = require('body-parser')
const mongoose = require('mongoose')
const Community = require('./models/community')

const app = express()

// Connect to database
mongoose.Promise = global.Promise;
mongoose.connect('mongodb://localhost/hometurf') // Create database 

// Configure static files (for handlebars)
app.use(express.static('public')) // TODO: Public folder doesn't exist right now

// Configure template engine for the server
app.engine('handlebars', handlebars({
    defaultLayout: 'main'
}))

app.set('view engine', 'handlebars')

app.get('/community/:id/admin', function (req, res) {

    // Community admin homepage
    Community.findById(req.params.id, function (err, community) {
        if (err) {
            console.log('GOT AN ERROR')
            return res.send(err)
        }
        return res.render('community-admin', community)
    })
})

app.get('/communities', function (req, res) {
    
    // Get list of communities
    community.find(function (err, communities) {
        if (err) {
            return res.json({error: err, status: 500})
        }
        return res.json(communities)
    })
})

app.listen(3000, function(req, res) {
    console.log('Server listening on port 3000')
})
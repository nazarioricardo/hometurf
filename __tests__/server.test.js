const app = require('../server')
const request = require('supertest')

test('Signups', function(done) {
    request(app)
        .post('/signup')
        .send('{"username": "ricky", "password": "12345"}')
        .set('Content-Type', 'application-json')
        .end(function(err, res) {
            expect(res.status).toBe(200) 
            done()
        })
})
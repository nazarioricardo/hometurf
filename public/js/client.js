const socket = io()

socket.on('new guest', function(guest) {
    console.log('Guest received '+ guest)
    location.reload()
})

socket.on('guest confirmed', function(guest) {
    console.log('Guest confirmation received')
    location.reload()
})

socket.on('new request', function(request) {
    console.log('Request received')
    location.reload()
})
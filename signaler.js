var fs = require('fs');

var _static = require('node-static');
var file = new _static.Server('./static', {
    cache: false
});


var app = require('http').createServer(serverCallback);

function serverCallback(request, response) {
    request.addListener('end', function () {
        response.setHeader('Access-Control-Allow-Origin', '*');
        response.setHeader('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
        response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        file.serve(request, response);
    }).resume();
}

var io = require('socket.io').listen(app, {
    log: true,
    origins: '*:*'
});

io.set('log level', 0);

io.set('transports', [
    // 'websocket',
    'xhr-polling',
    'jsonp-polling'
]);

var channels = {};

var initiatorSocket;


io.sockets.on('connection', function (socket) {

    var initiatorChannel = '';
    if (!io.isConnected) {
        io.isConnected = true;
    }

    socket.on('new-channel', function(data) {
        if (!channels[data.channel]) {
            initiatorChannel = data.channel;
        }
        channels[data.channel] = data.channel;
        onNewNamespace(data.channel, data.sender);
    });

    socket.on('presence', function (channel) {
        var isChannelPresent = !! channels[channel];
        socket.emit('presence', isChannelPresent);
    });

    socket.on('disconnect', function (channel) {
        if (initiatorChannel) {
            delete channels[initiatorChannel];
        }
    });
});

function onNewNamespace(channel, sender) {
    io.of('/' + channel).on('connection', function (socket) {
        if(!initiatorSocket) {
            initiatorSocket = socket;
            console.log('initiatorSocket id: ' + initiatorSocket.id);
        }
        // send new student data to the initiator, ie, the teacher
        socket.on('new-student', function(data) {
            if(initiatorSocket && socket.id != initiatorSocket.id) {
                initiatorSocket.emit('new-student', data);
            }
        });

        socket.on('join-share-screen', function(data) {
            if(initiatorSocket && socket.id != initiatorSocket.id) {
                initiatorSocket.emit('join-share-screen', data);
            }
        });

        socket.on('leave-share-screen', function(data) {
            if(initiatorSocket && socket.id != initiatorSocket.id) {
                initiatorSocket.emit('leave-share-screen', data);
            }
        });

        socket.on('teacher-share-screen-again', function(data) {
            console.log('teacher share screen again');
            socket.broadcast.emit('reenable-join-screen-share', data);
        });

        var username;
        if (io.isConnected) {
            io.isConnected = false;
            socket.emit('connect', true);
        }
        socket.on('message', function (data) {
            if (data.sender == sender) {
                if(!username) {
                    username = data.data.sender;
                }
                socket.broadcast.emit('message', data.data);
            }
        });
        socket.on('disconnect', function() {
            if(username) {
                socket.broadcast.emit('user-left', username);
                username = null;
            }
        });
    });
}

app.listen(9559);

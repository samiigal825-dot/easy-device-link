const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// Generate a random 4-digit code
function generateRoomCode() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

const activeRooms = new Set();

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Create a room (PC usually does this)
    socket.on('create-room', () => {
        let roomCode = generateRoomCode();
        while (activeRooms.has(roomCode)) {
            roomCode = generateRoomCode();
        }
        activeRooms.add(roomCode);
        socket.join(roomCode);
        socket.emit('room-created', { roomCode });
        console.log(`Room created: ${roomCode}`);
    });

    // Join a room (Mobile usually does this)
    socket.on('join-room', (roomCode) => {
        if (activeRooms.has(roomCode)) {
            socket.join(roomCode);
            socket.emit('joined-room', { success: true, roomCode });
            // Notify others in the room
            socket.to(roomCode).emit('peer-joined');
            console.log(`User ${socket.id} joined room ${roomCode}`);
        } else {
            socket.emit('joined-room', { success: false, message: 'Invalid room code' });
        }
    });

    // Handle messages
    socket.on('send-message', (data) => {
        // Broadcast to everyone else in the room
        socket.to(data.roomCode).emit('receive-message', {
            text: data.text,
            senderId: socket.id,
            timestamp: new Date().toISOString()
        });
    });

    socket.on('disconnecting', () => {
        for (const room of socket.rooms) {
            if (room !== socket.id) {
                socket.to(room).emit('peer-left');
                // Could clean up rooms here if empty, but simple enough for MVP
            }
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
    console.log(`Access locally: http://localhost:${PORT}`);
});

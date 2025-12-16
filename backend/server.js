require('dotenv').config();
const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const Message = require('./models/Message');
const User = require('./models/User.js'); // Used for socket auth verification
const authMiddleware = require('./middleware/auth');

const app = express();
const server = http.createServer(app);
const io = socketio(server, {
  cors: {
    origin: "http://localhost:3000", // Frontend port
    methods: ["GET", "POST"]
  }
});

// --- MongoDB Connection ---
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected...');
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
};
connectDB();

// --- Express Middleware ---
app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json({ extended: false }));

// --- REST API Routes ---
app.use('/api/auth', require('./routes/auth'));

// GET /api/messages/:room - Fetch chat history (Protected Route)
app.get('/api/messages/:room', authMiddleware, async (req, res) => {
    try {
        // Fetch up to 100 messages for the room, sorted by timestamp
        const messages = await Message.find({ room: req.params.room })
            .sort({ timestamp: 1 }) 
            .limit(100);
        res.json(messages);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// --- Socket.IO JWT Authentication Middleware ---
// Validates the JWT token passed in the socket handshake query
io.use(async (socket, next) => {
  const token = socket.handshake.query.token;

  if (!token) {
    return next(new Error('Authentication error: Token missing'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Attach user info to the socket object for use in event handlers
    socket.user = decoded.user; 
    
    next();
  } catch (err) {
    console.error('Socket Auth Error:', err.message);
    return next(new Error('Authentication error: Invalid token'));
  }
});

// --- Socket.IO Connection Logic ---
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.user.username} (${socket.id})`); 

  // Client joins a specific chat room
  socket.on('joinRoom', (roomName) => {
    socket.join(roomName);
    console.log(`User ${socket.user.username} joined room: ${roomName}`);
  });

  // Client sends a message
  socket.on('sendMessage', async ({ room, text }) => {
    try {
      // Use the authenticated username from the socket
      const user = socket.user.username; 
      
      const newMessage = new Message({ room, user, text });
      await newMessage.save();

      // Broadcast the message to all clients in the room
      io.to(room).emit('message', newMessage);
    } catch (err) {
      console.error('Error saving message:', err.message);
    }
  });

  // Typing indicator
  socket.on('typing', ({ room, isTyping }) => {
    // Broadcast to others in the room
    socket.to(room).emit('typing', { user: socket.user.username, isTyping });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.user.username);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server started on port ${PORT}`));
require('dotenv').config();
const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const Message = require('./models/Message');
const User = require('./models/User.js');
const authMiddleware = require('./middleware/auth');

const app = express();
const server = http.createServer(app);

/* ================================
   ALLOWED ORIGINS (LOCAL + PROD)
================================ */
const allowedOrigins = [
  'http://localhost:3000',
  'https://chat-application-rl43.onrender.com'
];

/* ================================
   SOCKET.IO CONFIG
================================ */
const io = socketio(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

/* ================================
   MONGODB CONNECTION
================================ */
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

/* ================================
   MIDDLEWARES
================================ */
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json());

/* ================================
   AUTH ROUTES
================================ */
app.use('/api/auth', require('./routes/auth'));

/* ================================
   PROTECTED MESSAGES ROUTE
================================ */
app.get('/api/messages/:room', authMiddleware, async (req, res) => {
  try {
    const messages = await Message.find({ room: req.params.room })
      .sort({ timestamp: 1 })
      .limit(100);
    res.json(messages);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

/* ================================
   SOCKET AUTH MIDDLEWARE
================================ */
io.use((socket, next) => {
  const token = socket.handshake.query.token;

  if (!token) {
    return next(new Error('Authentication error: Token missing'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded.user;
    next();
  } catch (err) {
    return next(new Error('Authentication error: Invalid token'));
  }
});

/* ================================
   SOCKET EVENTS
================================ */
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.user.username}`);

  socket.on('joinRoom', (room) => {
    socket.join(room);
  });

  socket.on('sendMessage', async ({ room, text }) => {
    try {
      const message = new Message({
        room,
        user: socket.user.username,
        text
      });

      await message.save();
      io.to(room).emit('message', message);
    } catch (err) {
      console.error('Message save error:', err.message);
    }
  });

  socket.on('typing', ({ room, isTyping }) => {
    socket.to(room).emit('typing', {
      user: socket.user.username,
      isTyping
    });
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.user.username}`);
  });
});

/* ================================
   SERVER START
================================ */
const PORT = process.env.PORT || 5000;
server.listen(PORT, () =>
  console.log(`Server started on port ${PORT}`)
);

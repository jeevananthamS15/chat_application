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
const io = socketio(server, {
  cors: {
    origin: "https://chat-application-rl43.onrender.com",
    methods: ["GET", "POST"]
  }
});


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


app.use(cors({ origin: 'https://chat-application-rl43.onrender.com' }));
app.use(express.json({ extended: false }));


app.use('/api/auth', require('./routes/auth'));

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

io.use(async (socket, next) => {
  const token = socket.handshake.query.token;

  if (!token) {
    return next(new Error('Authentication error: Token missing'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    socket.user = decoded.user; 
    
    next();
  } catch (err) {
    console.error('Socket Auth Error:', err.message);
    return next(new Error('Authentication error: Invalid token'));
  }
});

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.user.username} (${socket.id})`); 

  socket.on('joinRoom', (roomName) => {
    socket.join(roomName);
    console.log(`User ${socket.user.username} joined room: ${roomName}`);
  });

  socket.on('sendMessage', async ({ room, text }) => {
    try {
      const user = socket.user.username; 
      
      const newMessage = new Message({ room, user, text });
      await newMessage.save();

      io.to(room).emit('message', newMessage);
    } catch (err) {
      console.error('Error saving message:', err.message);
    }
  });

  
  socket.on('typing', ({ room, isTyping }) => {
    
    socket.to(room).emit('typing', { user: socket.user.username, isTyping });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.user.username);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server started on port ${PORT}`));
const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  room: {
    type: String,
    required: true,
  },
  user: {
    type: String, // Storing username
    required: true,
  },
  text: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

// Optimization: Create a compound index for efficient fetching and sorting by room
MessageSchema.index({ room: 1, timestamp: 1 }); 

module.exports = mongoose.model('Message', MessageSchema);
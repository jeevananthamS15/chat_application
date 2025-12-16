const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  room: {
    type: String,
    required: true,
  },
  user: {
    type: String, 
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

MessageSchema.index({ room: 1, timestamp: 1 }); 

module.exports = mongoose.model('Message', MessageSchema);
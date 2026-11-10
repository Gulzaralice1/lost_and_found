const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['lost', 'found'],
    required: [true, 'Please specify if item is lost or found']
  },
  title: {
    type: String,
    required: [true, 'Please provide a title'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Please provide a description']
  },
  category: {
    type: String,
    required: [true, 'Please select a category'],
    enum: ['mobile', 'wallet', 'documents', 'keys', 'bag', 'electronics', 'jewelry', 'clothing', 'other']
  },
  location: {
    type: String,
    required: [true, 'Please provide a location']
  },
  date: {
    type: Date,
    required: [true, 'Please provide the date']
  },
  image: {
    type: String,
    default: null
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'matched', 'resolved'],
    default: 'active'
  },
  matchedWith: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
    default: null
  },
  contactInfo: {
    name: String,
    email: String,
    phone: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for faster searches
itemSchema.index({ category: 1, location: 1, type: 1 });
itemSchema.index({ title: 'text', description: 'text' });

module.exports = mongoose.model('Item', itemSchema);

// Import required modules
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const http = require('http');
const socketIO = require('socket.io');

// Load environment variables
dotenv.config();

// Import routes
const authRoutes  = require('./routes/auth');
const itemRoutes  = require('./routes/items');
const adminRoutes = require('./routes/admin');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const frontendDist = path.join(__dirname, '../frontend/dist');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(frontendDist));

// Make io accessible to routes
app.set('io', io);

// Database connection
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

if (!MONGO_URI) {
  console.error('❌ No MongoDB URI found in environment variables!');
  process.exit(1);
}

console.log('🔌 Connecting to MongoDB...');

mongoose.connect(MONGO_URI, {
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
})
.then(() => console.log('✅ MongoDB Connected Successfully'))
.catch(err => {
  console.error('❌ MongoDB Connection Error:', err.message);
  process.exit(1);
});

// Auto-reconnect on disconnect
mongoose.connection.on('disconnected', () => {
  console.warn('⚠️  MongoDB disconnected — retrying in 5s...');
  setTimeout(() => mongoose.connect(MONGO_URI), 5000);
});

mongoose.connection.on('error', err => {
  console.error('❌ MongoDB error:', err.message);
});

// Routes
app.use('/api/auth',  authRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/admin', adminRoutes);

// DB health check — visit /api/health to diagnose connection
app.get('/api/health', (req, res) => {
  const state = mongoose.connection.readyState;
  const states = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
  res.json({
    status: state === 1 ? 'ok' : 'error',
    database: states[state] || 'unknown',
    mongo_uri_set: !!(process.env.MONGO_URI || process.env.MONGODB_URI),
    jwt_secret_set: !!process.env.JWT_SECRET,
    environment: process.env.NODE_ENV || 'development'
  });
});

// Admin panel page
app.get('/admin', (req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});
app.get('/', (req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});
app.get(/^\/(?!api(?:\/|$)|uploads(?:\/|$)).*/, (req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Something went wrong!',
    error: err.message
  });
});

// Socket.IO connection
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Access the app at http://localhost:${PORT}`);
});

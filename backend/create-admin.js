// ============================================
// ADMIN SEEDER SCRIPT
// Run: node create-admin.js
// ============================================

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Admin credentials — change these if you want
const ADMIN = {
  name:     'Admin',
  email:    'admin@lostandfound.com',
  password: 'Admin@1234',
  phone:    '9999999999',
  role:     'admin'
};

// Inline User schema (avoids importing the model separately)
const userSchema = new mongoose.Schema({
  name:      String,
  email:     { type: String, unique: true },
  password:  String,
  phone:     String,
  role:      { type: String, default: 'user' },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

async function createAdmin() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Check if admin already exists
    const existing = await User.findOne({ email: ADMIN.email });
    if (existing) {
      console.log('⚠️  Admin already exists with email:', ADMIN.email);
      console.log('\n📋 Use these credentials to login:');
      console.log('   Email   :', ADMIN.email);
      console.log('   Password: Admin@1234');
      process.exit(0);
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(ADMIN.password, salt);

    // Create admin user
    const admin = await User.create({
      name:     ADMIN.name,
      email:    ADMIN.email,
      password: hashedPassword,
      phone:    ADMIN.phone,
      role:     ADMIN.role
    });

    console.log('\n🎉 Admin user created successfully!\n');
    console.log('┌─────────────────────────────────────┐');
    console.log('│         ADMIN CREDENTIALS            │');
    console.log('├─────────────────────────────────────┤');
    console.log('│  Email   : admin@lostandfound.com   │');
    console.log('│  Password: Admin@1234               │');
    console.log('│  Role    : admin                    │');
    console.log('└─────────────────────────────────────┘');
    console.log('\n🔗 Login at: http://localhost:5000/#login');
    console.log('⚠️  Change the password after first login!\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin:', error.message);
    process.exit(1);
  }
}

createAdmin();

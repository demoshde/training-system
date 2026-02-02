require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();

// Validate required environment variables
const requiredEnvVars = ['JWT_SECRET', 'ADMIN_JWT_SECRET', 'MONGODB_URI'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingEnvVars.join(', '));
  console.error('Please set them in your .env file');
  process.exit(1);
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin/auth', require('./routes/adminAuth'));
app.use('/api/admin/companies', require('./routes/companies'));
app.use('/api/admin/departments', require('./routes/departments'));
app.use('/api/admin/workers', require('./routes/workers'));
app.use('/api/admin/trainings', require('./routes/trainings'));
app.use('/api/admin/enrollments', require('./routes/enrollments'));
app.use('/api/admin/admins', require('./routes/admins'));
app.use('/api/admin/dashboard', require('./routes/dashboard'));
app.use('/api/admin/upload', require('./routes/upload'));
app.use('/api/admin/news', require('./routes/news'));
app.use('/api/admin/polls', require('./routes/polls'));
app.use('/api/admin/regulations', require('./routes/regulations'));
app.use('/api/news', require('./routes/news')); // Public access for workers
app.use('/api/regulations', require('./routes/regulations')); // For workers
app.use('/api/worker', require('./routes/worker'));
app.use('/api/supervisor', require('./routes/supervisor'));

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`🚀 Server running on ${HOST}:${PORT}`);
});

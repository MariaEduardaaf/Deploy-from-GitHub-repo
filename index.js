// Main server file for BabyBlur backend
// Handles HTTP requests and routes for AI image generation

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const generateRoute = require('./routes/generate');

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware configuration
app.use(cors({
    origin: '*', // Allow all origins for Flutter development
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Parse JSON requests
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'BabyBlur Backend API is running!',
        version: '1.0.0',
        endpoints: {
            generate: 'POST /generate-image'
        }
    });
});

// Health endpoint for API service
app.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'BabyBlur Backend is healthy!',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        status: 'running'
    });
});

// Routes
app.use('/', generateRoute);

// Global error handler
app.use((error, req, res, next) => {
    console.error('Global Error:', error);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
    });
});

// Handle 404 routes
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Route not found',
        message: `Route ${req.method} ${req.originalUrl} not found`
    });
});

// Start server 
app.listen(PORT, () => {
    console.log(`🚀 AI Photo Magic Backend running on port ${PORT}`);
    console.log(`📱 Health check: http://localhost:${PORT}`);
    console.log(`🎨 Generate endpoint: http://localhost:${PORT}/generate-image`);
    console.log(`🌐 Production ready for deployment`);
});

module.exports = app;
// Simple test server for BabyBlur
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3002;

// Enable CORS for all origins
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'BabyBlur test server is running!',
        timestamp: new Date().toISOString()
    });
});

// Mock image generation endpoint
app.post('/generate-image', (req, res) => {
    console.log('📸 Mock image generation request received');
    
    // Simulate processing time
    setTimeout(() => {
        res.json({
            success: true,
            message: 'Mock baby selfie generated successfully!',
            data: {
                imageUrl: 'https://picsum.photos/400/711?random=' + Date.now(),
                prompt: 'Mock generated baby selfie',
                timestamp: new Date().toISOString()
            }
        });
    }, 2000); // 2 second delay to simulate AI processing
});

app.listen(PORT, () => {
    console.log(`🚀 BabyBlur Test Server running on port ${PORT}`);
    console.log(`📱 Health check: http://localhost:${PORT}/health`);
    console.log(`🎨 Generate endpoint: http://localhost:${PORT}/generate-image`);
});
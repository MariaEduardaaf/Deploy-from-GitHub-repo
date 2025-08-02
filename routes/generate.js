// Route handler for image generation endpoint
// Configures multer for file uploads and handles the /generate-image route

const express = require('express');
const multer = require('multer');
const path = require('path');
const { generateBabyImage, getTransformations } = require('../controllers/generateController');

const router = express.Router();

// Configure multer for handling image uploads
const storage = multer.diskStorage({
    // Set destination folder for uploaded files
    destination: (req, file, cb) => {
        cb(null, './uploads/');
    },
    
    // Generate unique filename for each upload
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const extension = path.extname(file.originalname);
        cb(null, 'babyblur-' + uniqueSuffix + extension);
    }
});

// File filter to only allow image uploads
const fileFilter = (req, file, cb) => {
    console.log('🔍 File validation details:', {
        originalname: file.originalname,
        mimetype: file.mimetype,
        fieldname: file.fieldname,
        encoding: file.encoding
    });

    // More flexible validation - check if it's any image type
    const isImageMimeType = file.mimetype && file.mimetype.startsWith('image/');
    const hasImageExtension = file.originalname && /\.(jpeg|jpg|png|gif|webp|bmp|tiff|svg)$/i.test(file.originalname);
    
    // Accept if it has image MIME type OR image extension, or if no originalname (common in mobile uploads)
    if (isImageMimeType || hasImageExtension || !file.originalname) {
        console.log('✅ File accepted');
        return cb(null, true);
    } else {
        console.error('❌ File rejected:', {
            originalname: file.originalname,
            mimetype: file.mimetype,
            reason: 'Not recognized as image file'
        });
        cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
    }
};

// Configure multer with file size limits and validation
const upload = multer({
    storage: storage,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB default
        files: parseInt(process.env.MAX_FILES) || 2 // Max 2 files
    },
    fileFilter: fileFilter
});

/**
 * POST /generate-image
 * Main endpoint for generating baby selfies
 * Accepts 1-2 image files via multipart/form-data
 */
router.post('/generate-image', (req, res, next) => {
    // Use multer middleware to handle file uploads
    upload.array('images', 2)(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            // Handle multer-specific errors
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(413).json({
                    success: false,
                    error: 'File too large',
                    message: 'Each image must be smaller than 10MB'
                });
            }
            
            if (err.code === 'LIMIT_FILE_COUNT') {
                return res.status(400).json({
                    success: false,
                    error: 'Too many files',
                    message: 'Maximum 2 images allowed'
                });
            }
            
            if (err.code === 'LIMIT_UNEXPECTED_FILE') {
                return res.status(400).json({
                    success: false,
                    error: 'Unexpected field',
                    message: 'Use field name "images" for file uploads'
                });
            }

            return res.status(400).json({
                success: false,
                error: 'Upload error',
                message: err.message
            });
        } else if (err) {
            // Handle other errors (e.g., file type validation)
            return res.status(400).json({
                success: false,
                error: 'Invalid file',
                message: err.message
            });
        }
        
        // If no errors, proceed to the controller
        next();
    });
}, generateBabyImage);

/**
 * GET /transformations
 * Get all available transformation types
 */
router.get('/transformations', getTransformations);

module.exports = router;
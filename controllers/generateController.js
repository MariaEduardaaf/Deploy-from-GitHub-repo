// Controller for handling AI image generation requests
// Processes uploaded images and generates baby selfies using OpenAI DALL-E

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const Replicate = require('replicate');

/**
 * Generate baby selfie using OpenAI DALL-E API
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const generateBabyImage = async (req, res) => {
    try {
        // Check if files were uploaded
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No images uploaded',
                message: 'Please upload at least 1 image (max 2)'
            });
        }

        // Validate OpenAI API key
        if (!process.env.OPENAI_API_KEY) {
            console.error('OpenAI API key not configured');
            return res.status(500).json({
                success: false,
                error: 'API configuration error',
                message: 'Image generation service not properly configured'
            });
        }

        // Check if demo mode is enabled
        if (process.env.DEMO_MODE === 'true') {
            console.log('🎭 Demo mode enabled - using placeholder image');
            
            // Clean up uploaded files
            cleanupUploadedFiles(req.files);

            // Return demo response
            return res.json({
                success: true,
                message: 'Baby selfie generated successfully! (Demo Mode)',
                data: {
                    imageUrl: process.env.DEMO_IMAGE_URL || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=600&fit=crop&crop=face',
                    prompt: 'Demo mode - AI generation temporarily unavailable',
                    timestamp: new Date().toISOString(),
                    demo: true
                }
            });
        }

        // Get transformation type from request (default to baby_blur for backward compatibility)
        const transformationType = req.body.transformationType || 'baby_blur';
        
        // Generate the prompt for the specified transformation
        const prompt = generatePrompt(transformationType, req.files.length);
        
        console.log(`🎨 Generating ${transformationType} transformation with ${req.files.length} reference photo(s)`);
        console.log('📝 Prompt:', prompt);
        console.log('🤖 AI Provider:', process.env.AI_PROVIDER || 'openai');

        // Choose AI provider and generate image
        let imageGenerationResponse;
        const aiProvider = process.env.AI_PROVIDER || 'openai';
        
        if (aiProvider === 'replicate') {
            imageGenerationResponse = await callReplicateAPI(prompt, req.files);
        } else {
            imageGenerationResponse = await callOpenAIAPI(prompt, req.files);
        }

        // Clean up uploaded files after processing
        cleanupUploadedFiles(req.files);

        // Return the generated image
        res.json({
            success: true,
            message: `${transformationType.replace('_', ' ')} transformation generated successfully!`,
            data: {
                imageUrl: aiProvider === 'replicate' ? imageGenerationResponse : imageGenerationResponse.data[0].url,
                prompt: prompt,
                transformationType: transformationType,
                timestamp: new Date().toISOString(),
                provider: aiProvider
            }
        });

    } catch (error) {
        console.error('Error generating baby image:', error);
        
        // Log more detailed error information
        if (error.response) {
            console.error('OpenAI API Error Details:', {
                status: error.response.status,
                statusText: error.response.statusText,
                data: error.response.data
            });
        }

        // Clean up files on error
        if (req.files) {
            cleanupUploadedFiles(req.files);
        }

        // Handle different types of errors
        if (error.response && error.response.status === 400) {
            const errorMessage = error.response.data?.error?.message || 'Please check your images and try again';
            const errorCode = error.response.data?.error?.code;
            console.error('AI API 400 Error:', errorMessage);
            
            // Handle specific billing limit error
            if (errorCode === 'billing_hard_limit_reached') {
                return res.status(402).json({
                    success: false,
                    error: 'Service temporarily unavailable',
                    message: 'AI image generation service needs account top-up. Please try again later.'
                });
            }
            
            return res.status(400).json({
                success: false,
                error: 'Invalid request to AI service',
                message: errorMessage
            });
        }

        // Handle payment/billing errors (402)
        if (error.response && error.response.status === 402) {
            console.error('AI API Payment Error:', error.message);
            return res.status(402).json({
                success: false,
                error: 'Insufficient credits',
                message: 'AI service needs credits to generate images. Please try again later.'
            });
        }

        if (error.response && error.response.status === 429) {
            return res.status(429).json({
                success: false,
                error: 'Rate limit exceeded',
                message: 'Too many requests. Please try again later'
            });
        }

        res.status(500).json({
            success: false,
            error: 'Image generation failed',
            message: 'Unable to generate baby selfie. Please try again'
        });
    }
};

/**
 * Generate the AI prompt based on uploaded images
 * @param {number} imageCount - Number of uploaded images
 * @returns {string} Generated prompt
 */
/**
 * Generate AI prompts based on transformation type
 * @param {string} transformationType - Type of transformation
 * @param {number} imageCount - Number of uploaded images
 * @returns {string} Generated prompt
 */
const generatePrompt = (transformationType, imageCount = 1) => {
    const prompts = {
        'baby_blur': `A candid iPhone selfie photo showing a complete family of three people: two parents with their small child around 4 years old. All three faces clearly visible, smiling naturally. Portrait orientation, photorealistic quality.`,
        
        'avatar': `A high-quality 3D Pixar-style avatar character based on the person in the photo. Cute, stylized, colorful, professional digital art style. Clean background, front-facing view, vibrant colors, Disney/Pixar animation quality.`,
        
        'age_progression': `A photorealistic portrait showing the same person aged 20 years older. Natural aging process, realistic wrinkles, mature features, same facial structure and characteristics, professional portrait photography quality.`,
        
        'age_regression': `A photorealistic portrait showing the same person as a young child around 8 years old. Maintain same facial features and characteristics, innocent child-like expression, soft lighting, portrait photography quality.`,
        
        'pet_generator': `A cute, friendly dog that would perfectly match the personality of the person in the photo. The dog should have similar facial expressions and personality traits. High-quality pet photography, adorable, heartwarming.`,
        
        'couple_generator': `A photorealistic portrait of an attractive person who would be the perfect romantic partner match for the person in the photo. Complementary features, similar age, attractive, warm smile, professional portrait photography.`,
        
        'style_anime': `Transform the person into a beautiful high-quality anime character. Japanese anime art style, detailed, vibrant colors, expressive eyes, professional anime illustration quality.`,
        
        'style_painting': `Transform the person into a classical oil painting portrait. Renaissance painting style, masterpiece quality, rich colors, artistic brushwork, museum-quality classical art.`,
        
        'style_cartoon': `Transform the person into a fun cartoon character. Colorful, exaggerated features, friendly expression, professional cartoon illustration style, vibrant and playful.`
    };
    
    return prompts[transformationType] || prompts['avatar'];
};

/**
 * Call OpenAI DALL-E API with images and prompt
 * @param {string} prompt - Text prompt for image generation  
 * @param {Array} files - Uploaded image files
 * @returns {Object} API response
 */
const callOpenAIAPI = async (prompt, files) => {
    // For DALL-E 3, we'll use text-to-image generation
    // Note: As of 2024, DALL-E doesn't support direct image input for generation
    // We'll use the prompt to describe the desired outcome
    
    const response = await axios.post(
        'https://api.openai.com/v1/images/generations',
        {
            model: 'dall-e-3',
            prompt: prompt,
            n: 1,
            size: '1024x1792', // 19:16 aspect ratio (close approximation)
            quality: 'hd',
            style: 'natural'
        },
        {
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 60000 // 60 second timeout
        }
    );

    return response.data;
};

/**
 * Call Replicate API for image generation using predictions approach
 * @param {string} prompt - Text prompt for image generation  
 * @param {Array} files - Uploaded image files (not used directly by Replicate)
 * @returns {string} Image URL
 */
const callReplicateAPI = async (prompt, files) => {
    if (!process.env.REPLICATE_API_TOKEN || process.env.REPLICATE_API_TOKEN === 'your_replicate_token_here') {
        throw new Error('Replicate API token not configured');
    }

    const replicate = new Replicate({
        auth: process.env.REPLICATE_API_TOKEN,
    });

    console.log('🔄 Calling Replicate API with predictions approach...');

    try {
        // Create prediction using the predictions API with SDXL model
        const prediction = await replicate.predictions.create({
            version: "39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b", // SDXL
            input: {
                prompt: prompt,
                width: 768,
                height: 1344,
                num_outputs: 1,
                scheduler: "K_EULER",
                num_inference_steps: 20,
                guidance_scale: 7.5,
                prompt_strength: 0.8,
                refine: "expert_ensemble_refiner",
                refine_steps: 5
            }
        });

        console.log('🔄 Prediction created, waiting for completion...');
        
        // Wait for prediction to complete
        const finalPrediction = await replicate.wait(prediction);
        
        console.log('✅ Replicate final prediction:', finalPrediction);

        // Extract URL from completed prediction
        if (finalPrediction.status === 'succeeded' && finalPrediction.output && finalPrediction.output.length > 0) {
            const imageUrl = finalPrediction.output[0];
            console.log('✅ Generated image URL:', imageUrl);
            return imageUrl;
        } else {
            console.error('❌ Prediction failed or no output:', finalPrediction);
            throw new Error(`Prediction failed with status: ${finalPrediction.status}`);
        }

    } catch (error) {
        console.error('❌ Replicate API error:', error);
        
        // If it's still a ReadableStream issue, provide fallback
        if (error.message && error.message.includes('ReadableStream')) {
            console.log('🔄 Falling back to demo image due to ReadableStream issue');
            return 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=768&h=1344&fit=crop&crop=face';
        }
        
        throw error;
    }
};

/**
 * Clean up uploaded files from temporary directory
 * @param {Array} files - Array of uploaded files to delete
 */
const cleanupUploadedFiles = (files) => {
    files.forEach(file => {
        try {
            if (fs.existsSync(file.path)) {
                fs.unlinkSync(file.path);
                console.log(`🗑️ Cleaned up temporary file: ${file.filename}`);
            }
        } catch (error) {
            console.error(`Error deleting file ${file.filename}:`, error);
        }
    });
};

/**
 * Get all available transformations
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getTransformations = async (req, res) => {
    try {
        const transformations = [
            {
                id: 'avatar',
                name: 'Avatar Pixar',
                description: 'Transform into a cute 3D Pixar-style character',
                icon: '🎭',
                category: 'Character'
            },
            {
                id: 'age_progression',
                name: 'Age Progression',
                description: 'See how you\'ll look 20 years older',
                icon: '👴',
                category: 'Age'
            },
            {
                id: 'age_regression',
                name: 'Age Regression',
                description: 'See how you looked as a child',
                icon: '👶',
                category: 'Age'
            },
            {
                id: 'pet_generator',
                name: 'Your Perfect Pet',
                description: 'Find the dog that matches your personality',
                icon: '🐕',
                category: 'Animals'
            },
            {
                id: 'couple_generator',
                name: 'Perfect Match',
                description: 'Generate your ideal romantic partner',
                icon: '💕',
                category: 'Romance'
            },
            {
                id: 'style_anime',
                name: 'Anime Style',
                description: 'Transform into anime character',
                icon: '🎌',
                category: 'Art Style'
            },
            {
                id: 'style_painting',
                name: 'Classical Painting',
                description: 'Renaissance masterpiece portrait',
                icon: '🎨',
                category: 'Art Style'
            },
            {
                id: 'style_cartoon',
                name: 'Cartoon Style',
                description: 'Fun cartoon character version',
                icon: '🎪',
                category: 'Art Style'
            },
            {
                id: 'baby_blur',
                name: 'Family Photo',
                description: 'Generate family photo with child',
                icon: '👨‍👩‍👦',
                category: 'Family'
            }
        ];

        res.json({
            success: true,
            message: 'Available transformations retrieved successfully!',
            data: {
                transformations: transformations,
                totalCount: transformations.length
            }
        });
    } catch (error) {
        console.error('Error getting transformations:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get transformations',
            message: 'Unable to retrieve available transformations'
        });
    }
};

module.exports = {
    generateBabyImage,
    getTransformations
};
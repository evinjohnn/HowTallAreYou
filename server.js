require('dotenv').config();
const express = require('express');
const Groq = require('groq-sdk');
const cors = require('cors');

const app = express();
const port = 3000;

const groqApiKey = process.env.GROQ_API_KEY;

if (!groqApiKey) {
    console.error('FATAL ERROR: GROQ_API_KEY is not defined in your .env file.');
    process.exit(1);
}

const groq = new Groq({
    apiKey: groqApiKey,
});

// Middleware
app.use(cors());
app.use(express.static('.')); 
app.use(express.json({ limit: '10mb' }));

// API Endpoint
app.post('/api/analyze', async (req, res) => {
    const { image } = req.body;
    
    if (!image) {
        return res.status(400).json({ error: 'No image data provided.' });
    }

    try {
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: "Analyze the person in this image. Estimate their height in centimeters. Respond with ONLY the numerical value (e.g., '175'). Do not add units or text. If you cannot determine height, respond with '0'." },
                        { type: 'image_url', image_url: { url: image } }
                    ]
                }
            ],
            // --- THIS IS THE FINAL, CORRECTED MODEL ---
            model: 'llama3-llava-next-8b', 
            max_tokens: 10,
        });

        const result = chatCompletion.choices[0]?.message?.content || '0';
        res.json({ result });

    } catch (error) {
        console.error('Error calling Groq API:', error);
        res.status(500).json({ error: 'Failed to analyze image with the AI service.' });
    }
});

// Start Server
app.listen(port, () => {
    console.log(`✅ Server is up and running at http://localhost:${port}`);
});
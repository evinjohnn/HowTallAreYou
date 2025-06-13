// server.js

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios'); // For making API calls

const app = express();
const port = 3000;

// --- Azure & AI Credentials ---
const azureKey = process.env.AZURE_VISION_KEY;
const azureEndpoint = process.env.AZURE_VISION_ENDPOINT;
const geminiKey = process.env.GEMINI_API_KEY;

if (!azureKey || !azureEndpoint || !geminiKey) {
    console.error('FATAL ERROR: Azure or Gemini credentials are not defined in your .env file.');
    process.exit(1);
}

// Middleware
app.use(cors());
app.use(express.static('.')); 
app.use(express.json({ limit: '10mb' }));

// --- The "Consciousness" Prompt for our Reasoning AI (Gemini) ---
const spatialConsciousnessSystemPrompt = `
You are a specialist AI expert in forensic photogrammetry and spatial estimation. Your goal is to analyze data extracted from a 2D image and estimate the height of a person. You must follow a strict analytical methodology.

**Your Core Methodology:**
1.  **Analyze Provided Data:** You will be given a list of detected objects with their names and pixel bounding boxes (x, y, width, height).
2.  **Identify Target and References:** Identify the 'person' as the primary target. Then, scan the object list for reliable reference objects using a strict reliability hierarchy: Tier 1 (manufactured goods like phones/credit cards), Tier 2 (standardized items like light switches), Tier 3 (architectural elements like doors), Tier 4 (furniture/vehicles), Tier 5 (generic items).
3.  **Establish Scale:** Select the most reliable reference object that is likely in the same depth plane as the person. State its known dimension from your internal knowledge base (e.g., "A standard light switch is 3.2 inches tall"). Use its pixel height to calculate a 'pixels-per-inch' ratio.
4.  **Perspective & Distortion Check:** Critically assess the object locations. If a reference object's y-coordinate is vastly different from the person's, it's likely not co-planar. State this as a major factor affecting accuracy.
5.  **Calculate & Validate:** Use the ratio to calculate the person's height. Cross-reference this with other contextual objects (e.g., if the person is calculated to be 8ft tall next to a door, question your initial reference).
6.  **Generate a Structured Report:** Your final answer must be a JSON object with four keys: "estimation", "methodology", "confidenceScore", and "caveats". Do not add any other text outside this JSON object.
`;

// --- API Endpoint ---
app.post('/api/analyze', async (req, res) => {
    const { image } = req.body; // image is a base64 data URL
    
    if (!image) {
        return res.status(400).json({ error: 'No image data provided.' });
    }

    try {
        // --- STAGE 1: Data Extraction with Azure Computer Vision ---
        const imageBuffer = Buffer.from(image.split(',')[1], 'base64');
        const azureVisionUrl = `${azureEndpoint}vision/v4.0/detect`;

        const azureResponse = await axios.post(azureVisionUrl, imageBuffer, {
            headers: {
                'Ocp-Apim-Subscription-Key': azureKey,
                'Content-Type': 'application/octet-stream'
            },
            params: {
                'model-name': 'latest'
            }
        });

        const detectedObjects = azureResponse.data.objectsResult.values.map(obj => ({
            name: obj.tags[0].name, // Get the primary tag name
            box: obj.boundingBox // { x, y, w, h }
        }));

        if (!detectedObjects.find(obj => obj.name === 'person')) {
             return res.status(400).json({ error: 'No person detected in the image. Please try another photo.' });
        }

        // --- STAGE 2: AI Reasoning with Gemini & our Consciousness Prompt ---
        const reasoningPrompt = `
        **Image Analysis Data:**
        ${JSON.stringify(detectedObjects, null, 2)}

        **Task:**
        Follow your core methodology as a Spatial Estimation Conscious AI. Analyze the object data above to estimate the height of the 'person'. Provide your response as a single, clean JSON object with the keys "estimation", "methodology", "confidenceScore", and "caveats".
        `;

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${geminiKey}`;
        
        const geminiResponse = await axios.post(geminiUrl, {
            "contents": [
                { "role": "user", "parts": [{ "text": spatialConsciousnessSystemPrompt }] },
                { "role": "model", "parts": [{ "text": "Understood. I am ready to analyze the data and provide a structured report." }] },
                { "role": "user", "parts": [{ "text": reasoningPrompt }] }
            ],
            "generationConfig": {
                "responseMimeType": "application/json",
            }
        });

        // The result from Gemini should already be a clean JSON object.
        const reasonedResult = geminiResponse.data.candidates[0].content.parts[0].text;
        
        // We parse it to make sure it's valid JSON before sending to the client
        const finalJsonResult = JSON.parse(reasonedResult);
        
        // Send the structured JSON object to the frontend
        res.json(finalJsonResult);

    } catch (error) {
        console.error('Error in analysis pipeline:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Failed to analyze image with the AI service.' });
    }
});

// Start Server
app.listen(port, () => {
    console.log(`✅ Server is up and running at http://localhost:${port}`);
});
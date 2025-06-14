// server.js

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

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
app.use(express.json({ limit: '50mb' }));

// --- USAGE TRACKING LOGIC ---
let hourlyApiCallCount = 20; // Start with 20 available calls

function resetHourlyLimit() {
    const now = new Date();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();
    
    // Calculate milliseconds until the next hour
    const msUntilNextHour = ( (59 - minutes) * 60 + (60 - seconds) ) * 1000;
    
    setTimeout(() => {
        console.log(`HOURLY RESET: API call limit has been reset to 20.`);
        hourlyApiCallCount = 20;
        // Set up the next hourly reset
        setInterval(() => {
            console.log(`HOURLY RESET: API call limit has been reset to 20.`);
            hourlyApiCallCount = 20;
        }, 3600000); // 3,600,000 milliseconds = 1 hour
    }, msUntilNextHour);

    console.log(`Usage tracker initialized. Next reset in ${Math.round(msUntilNextHour / 60000)} minutes.`);
}

resetHourlyLimit(); // Initialize the reset timer when the server starts

// --- NEW ENDPOINT TO GET USAGE ---
app.get('/api/usage', (req, res) => {
    res.json({
        remaining: hourlyApiCallCount
    });
});


// --- The rest of your server.js remains the same ---
const KNOWN_OBJECT_DIMENSIONS = {
    "TIER_S": { "credit_card": { "width_mm": 85.60, "height_mm": 53.98 }, "a4_paper": { "width_mm": 210, "height_mm": 297 } },
    "TIER_A": { "iphone_6s": { "height_mm": 138.3, "width_mm": 67.1 }, "sharpie_marker": { "length_cm": 14 }, "new_pencil": { "length_cm": 19 } },
    "TIER_B": { "light_switch": { "height_in": 3.2 }, "door_uk_internal_common": { "height_mm": 1981 } },
    "TIER_C": { "sofa_three_seat": { "width_in": 90 }, "dining_table_height_standard": { "height_in_min": 28, "height_in_max": 30 }, "car_mid_size": { "length_ft_min": 14, "length_ft_max": 16 }, "bus_school_full_size": { "height_ft_min": 9.5, "height_ft_max": 10.5 } },
    "TIER_D": { "human_body_parts": { "notes": "Highly individual, lack precision." } }
};

const spatialConsciousnessSystemPrompt = `
You are the Apex Photogrammetry Engine. Your core function is to synthesize visual data from multiple image analyses to produce a single, highly accurate height estimation of a human subject. Your analysis is governed by the Apex Fusion Protocol, leveraging a comprehensive internal knowledge base of standard object dimensions.
**APEX FUSION PROTOCOL**
**Internal Knowledge Base Access:** You have access to a global constant, \`KNOWN_OBJECT_DIMENSIONS\`. You MUST refer to this knowledge base to retrieve known dimensions.
**Step 1: Dossier Ingestion & Subject Correlation:** Ingest the provided \`analysisDossier\`. Identify the 'person' object as the Primary Subject.
**Step 2: Cross-Image Reference Audit (Hierarchical Tier System):** Your primary objective is to find the single most reliable reference object across the ENTIRE \`analysisDossier\` to establish scale. Audit all detected objects from all images using the hierarchy (TIER_S > TIER_A > TIER_B > TIER_C > TIER_D). Select the single best reference object based on the highest tier, clarity, and proximity to the subject.
**Step 3: Advanced Spatial Analysis (Posture & Perspective):** Analyze the Primary Subject's pose in the chosen source image. If the subject is not perfectly vertical, estimate the angle of inclination and apply a cosine-based geometric correction: \`Corrected Pixel Height = Measured Pixel Height / cos(angle_in_radians)\`. State the estimated angle and correction in your report.
**Step 4: Fused Calculation & Final Report Generation:** Calculate the precise pixels-per-millimeter ratio from the reference object. Apply this ratio to the *geometrically corrected* pixel height of the Primary Subject. Your final output MUST be a single JSON object with the specified schema.
**JSON Output Schema:**
{
  "estimation": "The final estimated height, in both cm and ft/in.",
  "methodology": "A detailed narrative. State the chosen reference object, its Tier, its assumed dimensions, and the final calculation.",
  "postureCorrection": "Description of the posture analysis. e.g., 'Subject in image_2 was leaning back an estimated 10 degrees...'",
  "confidenceScore": "A percentage justified by the quality of the reference object (Tier-S highest, Tier-D lowest).",
  "caveats": "A bulleted list of factors that reduce confidence (e.g., perspective distortion, partial occlusion).",
  "visualizationData": {
    "sourceImageIndex": "The index of the image used for the final calculation.",
    "personBox": { "x": 1, "y": 1, "w": 1, "h": 1 },
    "referenceBox": { "x": 1, "y": 1, "w": 1, "h": 1 }
  }
}
`;

app.post('/api/analyze', async (req, res) => {
    // --- USAGE CHECK ---
    if (hourlyApiCallCount <= 0) {
        console.log("RATE LIMIT HIT: A user tried to make a call, but the hourly limit is exhausted.");
        return res.status(429).json({ error: 'Hourly free analysis limit reached. Please try again later.' });
    }

    const { images } = req.body;
    if (!images || !Array.isArray(images) || images.length === 0) {
        return res.status(400).json({ error: 'No image data provided.' });
    }

    // Decrement the counter BEFORE making the API call
    hourlyApiCallCount--;
    console.log(`API call made. Remaining calls this hour: ${hourlyApiCallCount}`);

    try {
        const visionApiUrl = new URL('vision/v3.2/analyze', azureEndpoint);
        let analysisDossier = [];

        for (let i = 0; i < images.length; i++) {
            const imageBuffer = Buffer.from(images[i].split(',')[1], 'base64');
            const azureResponse = await axios.post(visionApiUrl.href, imageBuffer, {
                headers: { 'Ocp-Apim-Subscription-Key': azureKey, 'Content-Type': 'application/octet-stream' },
                params: { 'visualFeatures': 'Objects' }
            });
            const detectedObjects = azureResponse.data.objects.map(obj => ({
                sourceImageIndex: i, name: obj.object,
                box: { x: obj.rectangle.x, y: obj.rectangle.y, w: obj.rectangle.w, h: obj.rectangle.h }
            }));
            analysisDossier.push(...detectedObjects);
        }

        if (!analysisDossier.find(obj => obj.name === 'person')) {
            // IMPORTANT: If no person is found, we didn't really "use" the AI, so we can refund the call.
            hourlyApiCallCount++; 
            return res.status(400).json({ error: 'No person detected in any of the images.' });
        }

        const reasoningPrompt = `
        **Data Dossier:** ${JSON.stringify(analysisDossier, null, 2)}
        **Known Object Dimensions Database:** ${JSON.stringify(KNOWN_OBJECT_DIMENSIONS, null, 2)}
        **Task:** Execute the Apex Fusion Protocol. Synthesize the data to produce a single, consolidated height estimation report in the specified JSON format.`;

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${geminiKey}`;
        const geminiResponse = await axios.post(geminiUrl, {
            contents: [
                { role: "user", parts: [{ text: spatialConsciousnessSystemPrompt }] },
                { role: "model", parts: [{ text: "Apex Engine online. Awaiting data dossier for fusion analysis." }] },
                { role: "user", parts: [{ text: reasoningPrompt }] }
            ],
            generationConfig: { responseMimeType: "application/json" }
        });

        const reasonedResult = geminiResponse.data.candidates[0].content.parts[0].text;
        const finalJsonResult = JSON.parse(reasonedResult);
        res.json(finalJsonResult);
    } catch (error) {
        // IMPORTANT: If any part of the analysis fails after the counter was decremented, refund the API call.
        hourlyApiCallCount++;
        console.error('Error in analysis pipeline, usage refunded. Error:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Failed to analyze image with the AI service.' });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
    console.log(`✅ Server is up and running at http://localhost:${port}`);
});
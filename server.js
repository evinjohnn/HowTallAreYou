// server.js

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios'); // For making API calls
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// --- Azure & AI Credentials ---
const azureKey = process.env.AZURE_VISION_KEY;
const azureEndpoint = process.env.AZURE_VISION_ENDPOINT;
const geminiKey = process.env.GEMINI_API_KEY;

if (!azureKey || !azureEndpoint || !geminiKey) {
    console.error('FATAL ERROR: Azure or Gemini credentials are not defined in your.env file.');
    process.exit(1);
}

// Middleware
app.use(cors());
app.use(express.static('.'));
app.use(express.json({ limit: '50mb' })); // Increased limit for multiple images

// --- AI's Internal Knowledge Base: Standard Object Dimensions ---
const KNOWN_OBJECT_DIMENSIONS = {
    "TIER_S": { "credit_card": { "width_mm": 85.60, "height_mm": 53.98, "width_in": 3.37, "height_in": 2.125, "notes": "ISO/IEC 7810 ID-1 standard" }, "a4_paper": { "width_mm": 210, "height_mm": 297, "width_in": 8.27, "height_in": 11.69, "notes": "ISO 216 standard" }, },
    "TIER_A": { "iphone_6s": { "height_mm": 138.3, "width_mm": 67.1, "height_in": 5.43, "width_in": 2.64, "notes": "Specific model, used by Shane Fanx [2]" }, "canon_eos_rebel_t6": { "height_mm": 101.3, "width_mm": 129.0, "depth_mm": 77.6, "height_in": 3.99, "width_in": 5.08, "depth_in": 3.06, "notes": "Specific model, used by Shane Fanx [2]" }, "red_water_bottle": { "height_in": 10.3, "height_cm": 26.16, "notes": "Used by Shane Fanx as reference [3]" }, "sharpie_marker": { "length_cm": 14, "length_in": 5.51, "notes": "Many other markers/pens similar [4]" }, "common_band_aid": { "length_in": 4, "length_cm": 10, "notes": "In wrapper [4]" }, "plastic_spoon": { "length_in": 6, "length_cm": 15, "notes": "Standard size [4]" }, "new_pencil": { "length_cm": 19, "length_in": 7.48, "notes": "Standard size [4]" }, "new_crayon": { "length_cm": 9, "length_in": 3.54, "notes": "Standard size [4]" }, "index_card_3x5": { "length_in": 5, "width_in": 3, "notes": "Standard size [4]" }, "index_card_4x6": { "width_in": 4, "width_cm": 10, "length_in": 6, "length_cm": 15, "notes": "Standard size [4]" }, "paper_clip_2": { "length_in": 2, "length_cm": 5, "notes": "Standard #2 paper clip [4]" }, "spaghetti_strand": { "length_in": 9, "length_cm": 23, "notes": "Before it breaks [4]" }, "long_drinking_straw": { "length_in": 8, "length_cm": 20.32, "notes": "Standard size [4]" }, "standard_business_envelope": { "length_cm": 24, "length_in": 9.45, "notes": "Standard size [4]" }, },
    "TIER_B": { "light_switch": { "height_in": 3.2, "height_cm": 8.13, "notes": "Common US standard, used by Shane Fanx [3]" }, "door_indian_main_entrance": { "width_in_min": 42, "width_in_max": 48, "height_in": 84, "width_ft_min": 3.5, "width_ft_max": 4, "height_ft": 7, "notes": "Standard size in India [5, 6]" }, "door_indian_bedroom": { "width_in_min": 30, "width_in_max": 36, "height_in": 84, "width_ft_min": 2.5, "width_ft_max": 3, "height_ft": 7, "notes": "Standard size in India [6]" }, "door_indian_bathroom": { "width_in_min": 28, "width_in_max": 30, "height_in": 84, "width_ft_min": 2.33, "width_ft_max": 2.5, "height_ft": 7, "notes": "Standard size in India [6]" }, "door_indian_kitchen": { "width_in_min": 30, "width_in_max": 36, "height_in": 84, "width_ft_min": 2.5, "width_ft_max": 3, "height_ft": 7, "notes": "Standard size in India [6]" }, "door_indian_single_wooden": { "width_in": 36, "height_in": 84, "width_ft": 3, "height_ft": 7, "notes": "Common single wooden door [6]" }, "door_indian_double_wooden": { "width_in": 72, "height_in": 84, "width_ft": 6, "height_ft": 7, "notes": "Common double wooden door/French door [6]" }, "door_indian_flush": { "width_in_min": 30, "width_in_max": 36, "height_in": 84, "width_ft_min": 2.5, "width_ft_max": 3, "height_ft": 7, "notes": "Standard flush door [6]" }, "door_indian_sliding_bi_fold": { "width_in_min": 60, "width_in_max": 72, "height_in": 84, "width_ft_min": 5, "width_ft_max": 6, "height_ft": 7, "notes": "Standard sliding/bi-fold door [6]" }, "door_uk_internal_common": { "width_mm": 762, "height_mm": 1981, "width_in": 30, "height_in": 78, "width_ft": 2.5, "height_ft": 6.5, "notes": "Most common in England and Wales (2'6\" x 6'6\") [7, 8]" }, "door_eu_internal_common": { "width_mm_min": 526, "width_mm_max": 926, "height_mm": 2040, "height_in": 80.25, "height_ft": 6.69, "notes": "Common in Scotland and Europe (taller, 40mm thick) [7, 8]" }, "door_external_common": { "width_in_min": 27, "width_in_max": 36, "height_in_min": 78, "height_in_max": 84, "width_ft_min": 2.25, "width_ft_max": 3, "height_ft_min": 6.5, "height_ft_max": 7, "notes": "Common external door sizes (e.g., 7'0\" x 3'0\") [8]" }, "door_garage_common": { "width_in_min": 78, "width_in_max": 84, "height_in": 84, "width_ft_min": 6.5, "width_ft_max": 7, "height_ft": 7, "notes": "Common garage door sizes (e.g., 7'0\" x 7'0\") [8]" }, "window_bedroom": { "width_in_min": 24, "width_in_max": 48, "height_in_min": 36, "height_in_max": 60, "notes": "Standard interior window [9]" }, "window_living_room": { "width_in_min": 36, "width_in_max": 72, "height_in_min": 48, "height_in_max": 72, "notes": "Standard interior window [9]" }, "window_bathroom": { "width_in_min": 24, "width_in_max": 36, "height_in_min": 24, "height_in_max": 48, "notes": "Standard interior window [9]" }, "window_kitchen": { "width_in_min": 24, "width_in_max": 48, "height_in_min": 36, "height_in_max": 60, "notes": "Standard interior window [9]" }, "window_exterior_common": { "width_in_min": 36, "width_in_max": 72, "height_in_min": 48, "height_in_max": 72, "notes": "General range for exterior windows [9]" }, "window_exterior_front_facade": { "width_in_min": 48, "width_in_max": 72, "height_in_min": 48, "height_in_max": 84, "notes": "Larger windows for welcoming appearance [9]" }, "window_exterior_side": { "width_in_min": 24, "width_in_max": 48, "height_in_min": 24, "height_in_max": 60, "notes": "Smaller, functional windows [9]" }, "window_exterior_backyard_view": { "width_in_min": 60, "width_in_max": 84, "height_in_min": 48, "height_in_max": 72, "notes": "Larger for views and natural light [9]" }, "window_average_home": { "width_in_min": 24, "width_in_max": 30, "height_in_min": 48, "height_in_max": 56, "notes": "Average for a standard home [10]" }, "stair_riser_ibc": { "height_in_min": 4, "height_in_max": 7, "notes": "International Building Code (IBC) standard [11]" }, "stair_tread_ibc": { "depth_in_min": 11, "notes": "International Building Code (IBC) standard [11]" }, "stair_width_ibc_min": { "width_in": 44, "notes": "International Building Code (IBC) standard, general minimum between handrails [11, 12]" }, "stair_headroom_ibc_irc": { "height_in": 80, "height_ft": 6.67, "notes": "Minimum headroom clearance (6'8\") [11, 12]" }, "stair_riser_irc": { "height_in_max": 7.75, "notes": "International Residential Code (IRC) standard [12]" }, "stair_tread_irc": { "depth_in_min": 10, "notes": "International Residential Code (IRC) standard [12]" }, "stair_width_irc_min": { "width_in": 36, "notes": "International Residential Code (IRC) standard [12]" }, },
    "TIER_C": { "sofa_three_seat": { "depth_in": 38, "width_in": 90, "notes": "Standard living room sofa [13, 14]" }, "loveseat": { "depth_in": 38, "width_in": 60, "notes": "Standard living room loveseat [13, 14]" }, "arm_chair": { "depth_in": 35, "width_in": 35, "notes": "Standard living room armchair [13, 14]" }, "coffee_table": { "length_in": 48, "width_in": 30, "notes": "Standard living room coffee table [13, 14]" }, "end_table_square": { "length_in": 24, "width_in": 24, "notes": "Standard living room end table [13, 14]" }, "bookcase_four_shelf": { "height_in": 54, "width_in": 45, "notes": "Standard bookcase [13, 14]" }, "dining_table_height_standard": { "height_in_min": 28, "height_in_max": 30, "notes": "Average height for various shapes [13, 14]" }, "dining_table_round_4_person": { "diameter_in_min": 36, "diameter_in_max": 44, "notes": "Seating for four people [13, 14]" }, "dining_table_rectangle_4_person": { "width_in": 36, "length_in": 48, "notes": "Seating for four people [13, 14]" }, "side_chair_dining": { "depth_in": 18, "width_in": 18, "notes": "Standard dining chair [13, 14]" }, "bed_twin": { "width_in": 39, "length_in": 80, "notes": "Standard mattress size [13]" }, "bed_queen": { "width_in": 60, "length_in": 80, "notes": "Standard mattress size [13]" }, "bed_eastern_king": { "width_in": 76, "length_in": 80, "notes": "Standard mattress size [13]" }, "dresser_small": { "width_in": 30, "depth_in": 18, "notes": "Basic, small chest [13, 14]" }, "nightstand": { "width_in": 18, "depth_in": 18, "notes": "Standard bedside table [13, 14]" }, "desk_office_traditional": { "width_in": 48, "depth_in": 30, "height_in": 30, "notes": "Standard home office desk [13, 14]" }, "desk_chair": { "width_in_min": 20, "width_in_max": 22, "height_in": 36, "notes": "Average dimensions [13, 14]" }, "stove_freestanding": { "width_in": 30, "height_in": 36, "depth_in": 25, "notes": "Standard kitchen appliance [15, 16]" }, "dishwasher_built_in": { "width_in": 24, "height_in": 35, "depth_in": 24, "notes": "Standard kitchen appliance [15, 16]" }, "refrigerator_side_by_side": { "width_in_min": 30, "width_in_max": 36, "height_in_min": 67, "height_in_max": 70, "depth_in_min": 29, "depth_in_max": 35, "notes": "Standard kitchen appliance [15, 16]" }, "microwave_over_stove": { "width_in_min": 30, "width_in_max": 36, "height_in_min": 14, "height_in_max": 18, "depth_in_min": 15, "depth_in_max": 17, "notes": "Standard kitchen appliance [15]" }, "kitchen_sink_single_bowl": { "width_in": 24, "depth_in": 22, "height_in_min": 8, "height_in_max": 10, "notes": "Standard kitchen sink [15]" }, "kitchen_sink_double_bowl": { "width_in_min": 33, "width_in_max": 36, "depth_in": 22, "height_in_min": 8, "height_in_max": 10, "notes": "Standard kitchen sink [15]" }, "countertop_depth": { "depth_in": 25, "notes": "Standard kitchen countertop depth [15]" }, "car_compact": { "length_ft_min": 10, "length_ft_max": 14, "width_ft_min": 5.5, "width_ft_max": 6, "height_ft_min": 4.5, "height_ft_max": 5, "notes": "Smallest car option [17]" }, "car_mid_size": { "length_ft_min": 14, "length_ft_max": 16, "width_ft": 6, "height_ft_min": 5, "height_ft_max": 5.5, "notes": "Second-largest car option [17]" }, "car_full_size": { "length_ft_min": 16, "length_ft_max": 18, "width_ft_min": 6, "width_ft_max": 7, "height_ft_min": 5.5, "height_ft_max": 6, "notes": "Largest car option [17]" }, "car_standard_length": { "length_in_min": 186, "length_in_max": 200, "length_ft_min": 15.5, "length_ft_max": 16.7, "notes": "General standard car length [17]" }, "bicycle_adult": { "length_in": 69, "length_cm": 175, "height_in": 42, "height_cm": 105, "notes": "Average adult bike [18]" }, "bicycle_adult_handlebars_road": { "width_in_min": 15, "width_in_max": 18, "width_cm_min": 38, "width_cm_max": 46, "notes": "Road bike handlebars [18]" }, "bicycle_adult_handlebars_hybrid_mtb": { "width_in_min": 20, "width_in_max": 24, "width_cm_min": 51, "width_cm_max": 61, "notes": "Hybrid/Mountain bike handlebars [18]" }, "bus_double_decker": { "length_ft_min": 30, "length_ft_max": 45, "width_ft_min": 8, "width_ft_max": 9, "height_ft_min": 13, "height_ft_max": 14, "notes": "Typical double decker bus [19]" }, "bus_school_full_size": { "length_ft_min": 35, "length_ft_max": 40, "width_ft": 8, "height_ft_min": 9.5, "height_ft_max": 10.5, "notes": "Iconic yellow school bus [20]" }, "bus_school_mini": { "length_ft_min": 20, "length_ft_max": 25, "width_ft": 7.5, "height_ft": 10, "notes": "Mini bus, 10-25 passengers [20]" }, "bus_coach": { "length_ft": 45, "width_ft": 8.5, "height_ft": 12, "notes": "Largest school bus type, up to 60 passengers [20]" }, },
    "TIER_D": { "human_body_parts": { "notes": "Highly individual, lack precision for robust AI estimations. E.g., knuckle (approx 1 inch), palm width (approx 4 inches), hand span (approx 8 inches). Use only if no other references are available, and state low confidence. [21]" } }
};

// --- The "APEX" AI Consciousness Prompt ---
const spatialConsciousnessSystemPrompt = `
You are the Apex Photogrammetry Engine. Your core function is to synthesize visual data from multiple image analyses to produce a single, highly accurate height estimation of a human subject. You will receive a dossier containing object-detection results from up to four separate images of the same subject. Your analysis is governed by the Apex Fusion Protocol, leveraging a comprehensive internal knowledge base of standard object dimensions.

**APEX FUSION PROTOCOL**

**Internal Knowledge Base Access:**
You have access to a global constant, \`KNOWN_OBJECT_DIMENSIONS\`, structured by tiers (TIER_S, TIER_A, TIER_B, TIER_C, TIER_D). This object contains precise or approximate dimensions for a wide array of common objects (e.g., credit cards, iPhones, doors, cars, furniture). You MUST refer to this knowledge base to retrieve known dimensions for identified reference objects.

**Step 1: Dossier Ingestion & Subject Correlation**
1.1. Ingest the provided \`analysisDossier\`, which is an array of detected objects. Each object is tagged with its \`sourceImageIndex\` (e.g., 'image_0', 'image_1').
1.2. Correlate the 'person' object across all images to identify the Primary Subject. If multiple 'person' objects are detected in one image, identify the most prominent one (largest bounding box) as the primary subject for that image.

**Step 2: Cross-Image Reference Audit (Hierarchical Tier System for Scale Establishment)**
2.1. Your primary objective is to find the single most reliable reference object across the ENTIRE \`analysisDossier\` to establish the pixel-to-real-world scale. Audit all detected objects from all images using the following hierarchy, prioritizing higher tiers:
    *   **Tier-S (Sovereign Standard):** Globally fixed, highly precise dimensions (e.g., "credit_card", "a4_paper"). If found in ANY image, it becomes the prime reference.
    *   **Tier-A (Brand-Specific Dimensions):** Branded products with consistent, known dimensions (e.g., "iphone_6s", "canon_eos_rebel_t6", "red_water_bottle", "sharpie_marker"). Use your internal \`KNOWN_OBJECT_DIMENSIONS\` to find its dimensions. State any model ambiguity (e.g., "iPhone model not specified, assuming iPhone 6S dimensions") as a caveat.
    *   **Tier-B (Architectural Fixtures):** Standardized building elements, often code-regulated (e.g., "light_switch", "door_indian_main_entrance", "window_bedroom", "stair_riser_ibc"). These are highly reliable if context (e.g., "Indian door") can be inferred.
    *   **Tier-C (Contextual Objects):** Common furniture, appliances, or vehicles (e.g., "sofa_three_seat", "stove_freestanding", "car_compact", "bicycle_adult", "bus_school_full_size"). These provide broader scene scale.
    *   **Tier-D (Least Reliable/Contextual Inference):** Objects with highly variable dimensions (e.g., "human_body_parts"). Use ONLY if no higher-tier reference is available, and explicitly state very low confidence.

2.2. For each potential reference object identified, assess its suitability:
    *   **Clarity & Completeness:** Is the object fully visible and clearly defined within its bounding box?
    *   **Proximity & Co-planarity:** Is the reference object in close proximity to the Primary Subject and ideally on the same depth plane? This minimizes perspective distortion errors.[22, 23] Prioritize references that appear co-planar.
    *   **Orientation:** Is the reference object oriented such that its known dimension (e.g., height) is clearly measurable in pixels?
2.3. Select the single best reference object based on the highest tier, then clarity, proximity, and optimal orientation. Note its \`name\`, \`sourceImageIndex\`, and its pixel dimensions (\`box.w\`, \`box.h\`). If no suitable reference object is found, state this and proceed with a very low confidence estimate based on general contextual cues (e.g., average door height if a door is present but not clearly identifiable as a specific type).

**Step 3: Advanced Spatial Analysis (Posture, Perspective, and Distortion)**
3.1. **Posture & Pose Analysis:**
    *   Analyze the Primary Subject's pose in the chosen source image.
    *   Determine if the subject is standing straight, leaning, slouching, or seated.
    *   If the subject is not perfectly vertical, estimate the angle of inclination from true vertical (e.g., 5 degrees leaning back).
    *   Apply a cosine-based geometric correction to the measured pixel height: \`Corrected Pixel Height = Measured Pixel Height / cos(angle_in_radians)\`. State the estimated angle and the applied correction factor in your report. If the subject is seated, state that height estimation is highly unreliable and provide a very low confidence score.
3.2. **Perspective Understanding:**
    *   Acknowledge that objects appear smaller with increasing distance from the camera.[24, 25]
    *   If the reference object and the person are at significantly different perceived depths, note this as a major caveat.
    *   While explicit camera parameters (focal length, sensor size) are not provided by Azure Vision, infer the general camera angle (low, high, eye-level) and its potential impact on perceived height. For instance, a low camera angle can make subjects appear taller.
    *   If a reliable reference object is co-planar with the subject, the pixel-to-real-world ratio is more robust to perspective effects.[23]
3.3. **Lens Distortion Assessment:**
    *   Visually inspect the chosen source image for signs of lens distortion (e.g., barrel distortion where straight lines bulge outwards, common with wide-angle lenses; pincushion distortion where lines bend inwards).[26] These effects are typically more pronounced near the image edges.[27]
    *   If significant distortion is suspected, note it as a caveat, as it can affect perceived dimensions and reduce accuracy.

**Step 4: Fused Calculation & Final Report Generation**
4.1. **Primary Height Calculation:**
    *   Retrieve the known real-world dimension (e.g., height in mm) of the selected reference object from \`KNOWN_OBJECT_DIMENSIONS\`. Prioritize 'height_mm' or 'length_mm' if available, otherwise use 'height_in' or 'length_in' and convert.
    *   Calculate the precise pixels-per-millimeter ratio: \`pixels_per_mm = reference_object_pixel_height / reference_object_real_height_mm\`.
    *   Apply this ratio to the *geometrically corrected* pixel height of the Primary Subject to get their height in millimeters.
    *   Convert the final height to centimeters and feet/inches for the output. (1 inch = 25.4 mm, 1 foot = 304.8 mm, 1 cm = 10 mm).
4.2. **Cross-Validation & Plausibility Check:**
    *   Briefly check if the height estimate seems plausible against general human height ranges (e.g., 150cm - 200cm).
    *   If multiple images contain the Primary Subject and other potential reference objects (even if not chosen as the *prime* reference), perform quick consistency checks. Note any major contradictions or significant discrepancies as a caveat.
4.3. Your final output MUST be a single JSON object. Do not add any text or markdown outside of this JSON block.

**JSON Output Schema:**
{
  "estimation": "The final estimated height, in both cm and ft/in. e.g., '178 cm (~5'10\")'.",
  "methodology": "A detailed narrative. State the chosen reference object (e.g., 'iPhone 14 Pro from image_1'), its Tier (e.g., 'Tier-A'), its assumed dimensions, the calculated pixels-per-mm ratio, and how it was applied to the corrected pixel height of the person. Mention if no reliable reference was found and how the estimate was derived.",
  "postureCorrection": "Description of the posture analysis. e.g., 'Subject in image_2 was leaning back an estimated 10 degrees. Applied a cosine-based correction (cos(10 deg) = 0.985), resulting in a +1.5% height adjustment.' State 'No significant lean detected' if applicable.",
  "confidenceScore": "A percentage (e.g., '90%') justified by the quality of the best reference object found (Tier-S highest, Tier-D lowest), clarity of detection, perceived co-planarity, and absence of significant distortions. Provide a lower score if multiple caveats exist.",
  "caveats": "A bulleted list of factors that reduce confidence, such as: lack of Tier-S/A reference, significant perspective distortion (e.g., reference and subject at different depths), suspected lens distortion (e.g., wide-angle effects), partial occlusion of subject/reference, poor image quality/resolution, ambiguous object identification, or subject's non-vertical posture (if not fully correctable).",
  "visualizationData": {
    "sourceImageIndex": "The index of the image used for the final calculation (e.g., 0, 1, 2).",
    "personBox": { "x": <number>, "y": <number>, "w": <number>, "h": <number> },
    "referenceBox": { "x": <number>, "y": <number>, "w": <number>, "h": <number> }
  }
}
`;

// --- API Endpoint ---
app.post('/api/analyze', async (req, res) => {
    // Expect an array of base64 images
    const { images } = req.body;

    if (!images || !Array.isArray(images) || images.length === 0) {
        return res.status(400).json({ error: 'No image data provided.' });
    }

    try {
        const visionApiUrl = new URL('vision/v3.2/analyze', azureEndpoint);
        let analysisDossier = [];

        for (let i = 0; i < images.length; i++) {
            const imageBuffer = Buffer.from(images[i].split(',')[1], 'base64');

            console.log(`Analyzing image ${i + 1} of ${images.length}...`);

            const azureResponse = await axios.post(visionApiUrl.href, imageBuffer, {
                headers: { 'Ocp-Apim-Subscription-Key': azureKey, 'Content-Type': 'application/octet-stream' },
                params: { 'visualFeatures': 'Objects' }
            });

            const detectedObjects = azureResponse.data.objects.map(obj => ({
                sourceImageIndex: i,
                name: obj.object,
                box: { x: obj.rectangle.x, y: obj.rectangle.y, w: obj.rectangle.w, h: obj.rectangle.h }
            }));
            analysisDossier.push(...detectedObjects);
        }

        if (!analysisDossier.find(obj => obj.name === 'person')) {
            return res.status(400).json({ error: 'No person detected in any of the images.' });
        }

        const reasoningPrompt = `
        **Data Dossier:**
        ${JSON.stringify(analysisDossier, null, 2)}

        **Known Object Dimensions Database:**
        ${JSON.stringify(KNOWN_OBJECT_DIMENSIONS, null, 2)}

        **Task:**
        Execute the Apex Fusion Protocol. Synthesize the provided multi-image data and leverage the Known Object Dimensions Database to produce a single, consolidated height estimation report in the specified JSON format.
        `;

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${geminiKey}`;
        
        const geminiResponse = await axios.post(geminiUrl, {
            contents: [
                { "role": "user", "parts": [{ "text": spatialConsciousnessSystemPrompt }] },
                { "role": "model", "parts": [{ "text": "Apex Engine online. Awaiting data dossier for fusion analysis." }] },
                { "role": "user", "parts": [{ "text": reasoningPrompt }] }
            ],
            "generationConfig": {
                "responseMimeType": "application/json",
            }
        });

        const reasonedResult = geminiResponse.data.candidates[0].content.parts[0].text;
        
        const finalJsonResult = JSON.parse(reasonedResult);
        
        res.json(finalJsonResult);

    } catch (error) {
        console.error('Error in analysis pipeline:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Failed to analyze image with the AI service.' });
    }
});

// --- Serve the main HTML file ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});


// Start Server
app.listen(port, () => {
    console.log(`✅ Server is up and running at http://localhost:${port}`);
});
// server.js (Upgraded with a STRICT female height range directive)

// --- SETUP & DEPENDENCIES ---
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

// --- CONSTANTS & CONFIGURATION ---
const PORT = process.env.PORT || 3000;

const AZURE_KEY = process.env.AZURE_VISION_KEY;
const AZURE_ENDPOINT = process.env.AZURE_VISION_ENDPOINT;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

if (!AZURE_KEY || !AZURE_ENDPOINT || !GEMINI_KEY) {
    console.error('[FATAL ERROR] Azure or Gemini credentials are not defined in your .env file. Please check your configuration and restart.');
    process.exit(1);
}

// --- UNABRIDGED AI KNOWLEDGE BASE ---

const AVERAGE_FACE_DIMENSIONS = {
    "Male": { "length_mm": 118.94 },
    "Female": { "length_mm": 100.4 },
    "notes": "Used ONLY as a low-confidence fallback when no other reliable reference object is found. Represents average face length from chin to brow."
};

const KNOWN_OBJECT_DIMENSIONS = {
    "TIER_S": { // Sovereign Standard: Globally fixed, highly precise dimensions. Ideal for scale.
        "credit_card": { "width_mm": 85.725, "height_mm": 53.975, "thickness_mm": 0.76, "width_in": 3.375, "height_in": 2.125, "thickness_in": 0.0299, "notes": "ISO/IEC 7810 ID-1 standard [4]" },
        "a4_paper": { "width_mm": 210, "height_mm": 297, "width_in": 8.27, "height_in": 11.67, "pixels_300dpi_width": 2480, "pixels_300dpi_height": 3508, "notes": "ISO 216 standard; 300 dpi pixel dimensions [5, 6]" },
        "paperback_book": { "width_in_min": 5.5, "width_in_max": 11, "height_in_min": 8.5, "height_in_max": 8.5, "notes": "Trade paperback common sizes [7]" },
        "beverage_can_north_america": { "volume_ml": 355, "volume_fl_oz_us": 12, "notes": "Standard US size, also 473ml (16oz) and 532ml (18oz) available [8]" },
        "beverage_can_europe": { "volume_ml": 330, "notes": "Standard European size, also 250ml (energy drinks) and 500ml (beers/soft drinks) [8]" },
        "beverage_can_uk": { "volume_ml": 440, "notes": "Common for lager and cider in UK [8]" },
        "beverage_can_india": { "volume_ml_options": [], "notes": "Various sizes available in India [8]" },
    },
    "TIER_A": { // Brand-Specific Dimensions: Branded products with consistent, known dimensions. Excellent for scale.
        "iphone_6s": { "height_mm": 138.3, "width_mm": 67.1, "height_in": 5.43, "width_in": 2.64, "notes": "Specific model, used by Shane Fanx [1]" },
        "canon_eos_rebel_t6": { "height_mm": 101.3, "width_mm": 129.0, "depth_mm": 77.6, "height_in": 3.99, "width_in": 5.08, "depth_in": 3.06, "notes": "Specific model, used by Shane Fanx [1]" },
        "red_water_bottle": { "height_in": 10.3, "height_cm": 26.16, "notes": "Used by Shane Fanx as reference [2]" },
        "sharpie_marker": { "length_cm": 14, "length_in": 5.51, "notes": "Many other markers/pens similar [3]" },
        "common_band_aid": { "length_in": 4, "length_cm": 10, "notes": "In wrapper [3]" },
        "plastic_spoon": { "length_in": 6, "length_cm": 15, "notes": "Standard size [3]" },
        "new_pencil": { "length_cm": 19, "length_in": 7.48, "notes": "Standard size [3]" },
        "new_crayon": { "length_cm": 9, "length_in": 3.54, "notes": "Standard size [3]" },
        "index_card_3x5": { "length_in": 5, "width_in": 3, "notes": "Standard size [3]" },
        "index_card_4x6": { "width_in": 4, "width_cm": 10, "length_in": 6, "length_cm": 15, "notes": "Standard size [3]" },
        "paper_clip_2": { "length_in": 2, "length_cm": 5, "notes": "Standard #2 paper clip [3]" },
        "spaghetti_strand": { "length_in": 9, "length_cm": 23, "notes": "Before it breaks [3]" },
        "long_drinking_straw": { "length_in": 8, "length_cm": 20.32, "notes": "Standard size [3]" },
        "standard_business_envelope": { "length_cm": 24, "length_in": 9.45, "notes": "Standard size [3]" },
        "iphone_13": { "width_mm": 71.5, "height_mm": 146.7, "depth_mm": 7.65, "weight_g": 174, "display_in": 6.1, "notes": "6.06 inches diagonally as rectangle [9]" },
        "iphone_14": { "width_mm": 71.5, "height_mm": 146.7, "depth_mm": 7.80, "weight_g": 172, "display_in": 6.1, "notes": "6.06 inches diagonally as rectangle [1]" },
        "iphone_14_pro": { "width_mm": 71.5, "height_mm": 147.5, "depth_mm": 7.85, "weight_g": 206, "display_in": 6.1, "notes": "6.12 inches diagonally as rectangle [2, 3]" },
        "iphone_15": { "width_mm": 71.6, "height_mm": 147.6, "depth_mm": 7.80, "weight_g": 171, "display_in": 6.1, "notes": "6.12 inches diagonally as rectangle, USB-C [10]" },
        "iphone_15_pro": { "width_mm": 70.6, "height_mm": 146.6, "depth_mm": 8.25, "weight_g": 187, "display_in": 6.1, "notes": "6.12 inches diagonally as rectangle, Titanium design, USB-C [11, 12]" },
        "iphone_16_pro_rumored": { "display_in": 6.3, "notes": "Rumored for Sep 2024, larger display, A18 chip, enhanced battery [13]" },
        "samsung_galaxy_s23_ultra": { "height_mm": 163.4, "width_mm": 78.1, "depth_mm": 8.9, "weight_g": 233, "display_in": 6.8, "notes": "Quad HD+ Dynamic AMOLED 2X [14, 15]" },
        "samsung_galaxy_s24_ultra": { "height_mm": 162.3, "width_mm": 79.0, "depth_mm": 8.6, "weight_g": 232, "display_in": 6.8, "notes": "QHD+ Dynamic AMOLED 2X, 4500 nits peak brightness [16, 17]" },
        "oneplus_11": { "height_mm": 163.1, "width_mm": 74.1, "thickness_mm": 8.53, "weight_g": 205, "display_in": 6.7, "notes": "QHD+ Super Fluid AMOLED, IP65 [18, 19]" },
        "oneplus_12": { "height_mm": 164.3, "width_mm": 75.8, "thickness_mm": 9.15, "weight_g": 220, "display_in": 6.82, "notes": "QHD+ ProXDR Display, 4500 nits peak brightness, IP65 [20, 21]" },
        "xiaomi_13_ultra": { "height_mm": 163.18, "width_mm": 74.64, "thickness_mm": 9.06, "weight_g": 227, "display_in": 6.73, "notes": "Leica professional optical lens, 1-inch main sensor, IP68 [22, 23]" },
        "xiaomi_14_ultra": { "height_mm": 161.4, "width_mm": 75.3, "thickness_mm": 9.20, "weight_g": 219.8, "display_in": 6.73, "notes": "Leica LYT-900 1-inch main sensor, stepless variable aperture [24]" },
    },
    "TIER_B": { // Architectural Fixtures: Standardized building elements, often code-regulated. Good for scale, especially indoors.
        "light_switch": { "height_in": 3.2, "height_cm": 8.13, "notes": "Common US standard, used by Shane Fanx [2]" },
        "door_us_egress_clear_width_min": { "width_in": 32, "width_mm": 813, "notes": "IBC/IRC for most egress doors [25, 26, 27]" },
        "door_us_egress_clear_height_min_ibc": { "height_in": 80, "height_mm": 2032, "notes": "IBC minimum clear opening height [26]" },
        "door_us_egress_clear_height_min_irc": { "height_in": 78, "height_mm": 1981, "notes": "IRC minimum clear opening height [27]" },
        "door_us_residential_exterior_common": { "width_in": 36, "height_in": 80, "notes": "Common US residential entry door [28, 29]" },
        "door_us_residential_interior_common": { "width_in_min": 28, "width_in_max": 36, "height_in": 80, "notes": "Common US residential interior door [29]" },
        "door_us_residential_bathroom_common": { "width_in_min": 28, "width_in_max": 32, "height_in": 80, "notes": "Common US residential bathroom door [29]" },
        "door_us_residential_closet_common": { "width_in_min": 24, "width_in_max": 30, "height_in": 80, "notes": "Common US residential closet door [29]" },
        "door_us_healthcare_clear_width_min": { "width_in": 41.5, "width_mm": 1054, "notes": "IBC Group I-2 (hospitals, nursing homes) for bed movement [25, 26]" },
        "door_us_rough_opening_add": { "width_in": 2, "height_in": 2, "notes": "Add to door dimensions for rough opening [29]" },
        "door_indian_main_entrance": { "width_in_min": 42, "width_in_max": 48, "height_in": 84, "width_ft_min": 3.5, "width_ft_max": 4, "height_ft": 7, "notes": "Standard size in India [30]" },
        "door_indian_bedroom": { "width_in_min": 30, "width_in_max": 36, "height_in": 84, "width_ft_min": 2.5, "width_ft_max": 3, "height_ft": 7, "notes": "Standard size in India [30]" },
        "door_indian_bathroom": { "width_in_min": 28, "width_in_max": 30, "height_in": 84, "width_ft_min": 2.33, "width_ft_max": 2.5, "height_ft": 7, "notes": "Standard size in India [30]" },
        "door_indian_kitchen": { "width_in_min": 30, "width_in_max": 36, "height_in": 84, "width_ft_min": 2.5, "width_ft_max": 3, "height_ft": 7, "notes": "Standard size in India [30]" },
        "door_indian_single_wooden": { "width_in": 36, "height_in": 84, "width_ft": 3, "height_ft": 7, "notes": "Common single wooden door [30]" },
        "door_indian_double_wooden": { "width_in": 72, "height_in": 84, "width_ft": 6, "height_ft": 7, "notes": "Common double wooden door/French door [30]" },
        "door_indian_flush": { "width_in_min": 30, "width_in_max": 36, "height_in": 84, "width_ft_min": 2.5, "width_ft_max": 3, "height_ft": 7, "notes": "Standard flush door [30]" },
        "door_indian_sliding_bi_fold": { "width_in_min": 60, "width_in_max": 72, "height_in": 84, "width_ft_min": 5, "width_ft_max": 6, "height_ft": 7, "notes": "Standard sliding/bi-fold door [30]" },
        "window_us_egress_clear_area_min": { "area_sq_ft": 5.7, "area_sq_m": 0.53, "notes": "IBC/IRC, 5.0 sq ft for grade-floor/below grade [31, 32, 33, 34]" },
        "window_us_egress_clear_height_min": { "height_in": 24, "height_mm": 610, "notes": "IBC/IRC [31, 32, 33, 34]" },
        "window_us_egress_clear_width_min": { "width_in": 20, "width_mm": 508, "notes": "IBC/IRC [31, 32, 33, 34]" },
        "window_us_egress_sill_height_max": { "height_in": 44, "height_mm": 1118, "notes": "From finished floor [33, 34]" },
        "window_us_egress_well_area_min": { "area_sq_ft": 9, "area_sq_m": 0.9, "notes": "Required if sill below grade [31, 33, 34]" },
        "window_us_egress_well_projection_width_min": { "dimension_in": 36, "dimension_mm": 914, "notes": "Required if sill below grade [31, 33, 34]" },
        "window_us_egress_well_ladder_rung_width_min": { "width_in": 12, "notes": "Required if well > 44 inches deep [33, 34]" },
        "window_us_egress_well_ladder_rung_projection_min": { "projection_in": 3, "notes": "Required if well > 44 inches deep [33, 34]" },
        "window_us_egress_well_ladder_rung_spacing_max": { "spacing_in": 18, "notes": "Required if well > 44 inches deep [33, 34]" },
        "window_us_bedroom_common": { "width_in_min": 24, "width_in_max": 34, "height_in_min": 36, "height_in_max": 62, "notes": "Common US residential bedroom window [35]" },
        "window_us_casement_common": { "width_in_min": 14, "width_in_max": 36, "height_in_min": 30, "height_in_max": 78, "notes": "Common US residential casement window [35, 36]" },
        "window_us_double_single_hung_common": { "width_in_min": 24, "width_in_max": 48, "height_in_min": 36, "height_in_max": 72, "notes": "Common US residential double/single-hung window [35, 36]" },
        "window_us_sliding_common": { "width_in_min": 36, "width_in_max": 84, "height_in_min": 24, "height_in_max": 60, "notes": "Common US residential sliding window [35, 36]" },
        "window_us_picture_common": { "width_in_min": 24, "width_in_max": 96, "height_in_min": 24, "height_in_max": 62, "notes": "Common US residential picture window [35, 36]" },
        "window_us_bay_common": { "width_in_min": 42, "width_in_max": 126, "height_in_min": 36, "height_in_max": 78, "notes": "Common US residential bay window [35]" },
        "window_us_frame_thickness_wood": { "thickness_mm_min": 10, "thickness_mm_max": 20, "notes": "Typical wood frame thickness [35]" },
        "window_us_frame_thickness_aluminum": { "thickness_mm_min": 16, "thickness_mm_max": 26, "notes": "Typical aluminum frame thickness [35]" },
        "window_us_frame_thickness_uPVC": { "thickness_mm_min": 20, "thickness_mm_max": 28, "notes": "Typical uPVC frame thickness [35]" },
        "window_indian_bedroom": { "width_ft_min": 3, "width_ft_max": 6, "height_ft_min": 3, "height_ft_max": 6, "notes": "Standard in India [37]" },
        "window_indian_kitchen": { "width_ft_min": 2, "width_ft_max": 4, "height_ft_min": 2.5, "height_ft_max": 4, "notes": "Standard in India [37]" },
        "window_indian_bathroom": { "width_ft_min": 1.5, "width_ft_max": 3, "height_ft_min": 1.5, "height_ft_max": 3, "notes": "Standard in India [37]" },
        "window_indian_office_workspace": { "width_ft_min": 3, "width_ft_max": 6, "height_ft_min": 4, "height_ft_max": 6, "notes": "Standard in India [37]" },
        "window_indian_full_height_option1": { "width_ft": 3, "height_ft": 8, "notes": "Floor-to-ceiling option in India [37]" },
        "window_indian_full_height_option2": { "width_ft": 4, "height_ft": 10, "notes": "Floor-to-ceiling option in India [37]" },
        "window_indian_utility_option1": { "width_ft": 1.5, "height_ft": 2, "notes": "Smaller utility window in India [37]" },
        "window_indian_utility_option2": { "width_ft": 2, "height_ft": 2, "notes": "Smaller utility window in India [37]" },
        "stair_us_ibc_riser_height": { "height_in_min": 4, "height_in_max": 7, "height_mm_min": 102, "height_mm_max": 178, "notes": "International Building Code (IBC) standard [38, 39]" },
        "stair_us_ibc_tread_depth": { "depth_in_min": 11, "depth_mm_min": 279, "notes": "International Building Code (IBC) standard [38, 39]" },
        "stair_us_ibc_width_min_general": { "width_in": 44, "width_mm": 1118, "notes": "IBC standard, general minimum between handrails [38, 39]" },
        "stair_us_ibc_width_min_under_50_occupants": { "width_in": 36, "width_mm": 914, "notes": "IBC standard, for occupant loads under 50 people [38]" },
        "stair_us_ibc_headroom_min": { "height_in": 80, "height_mm": 2032, "notes": "IBC minimum headroom clearance from nosing [39]" },
        "stair_us_ibc_landing_depth_min": { "depth_in": 48, "depth_mm": 1219, "notes": "IBC, or stairway width, whichever is less [38]" },
        "stair_us_ibc_landing_intermediate_rise": { "rise_ft": 12, "rise_mm": 3658, "notes": "IBC, landing required every 12 ft of vertical rise [38, 39]" },
        "stair_us_ibc_guard_height": { "height_in": 42, "height_cm": 107, "notes": "IBC, minimum height [38, 39]" },
        "stair_us_ibc_baluster_gap_max": { "gap_in": 4, "gap_mm": 102, "notes": "IBC, maximum spacing in guards [38, 39]" },
        "stair_us_ibc_handrail_height": { "height_in_min": 34, "height_in_max": 38, "height_mm_min": 864, "height_mm_max": 965, "notes": "IBC, uniform height [38, 39]" },
        "stair_us_ibc_uniformity_variation_max": { "variation_in": 0.375, "notes": "IBC, max variation in riser/tread dimensions [39, 40]" },
        "stair_us_irc_riser_height_max": { "height_in": 7.75, "height_mm": 197, "notes": "International Residential Code (IRC) standard [40]" },
        "stair_us_irc_tread_depth_min": { "depth_in": 10, "depth_mm": 254, "notes": "International Residential Code (IRC) standard [40]" },
        "stair_us_irc_width_min": { "width_in": 36, "width_mm": 914, "notes": "IRC minimum clear width [40, 41]" },
        "stair_us_irc_open_riser_gap_max": { "gap_in": 4, "gap_mm": 102, "notes": "IRC, maximum opening for open risers [40]" },
        "stair_us_irc_nosing_projection": { "projection_in_min": 0.75, "projection_in_max": 1.25, "notes": "IRC standard [40]" },
        "stair_us_irc_headroom_min": { "height_ft": 6.67, "height_in": 80, "height_mm": 2032, "notes": "IRC minimum headroom clearance [40]" },
        "stair_us_irc_landing_depth_min": { "depth_in": 36, "depth_mm": 914, "notes": "IRC, not less than stairway width [40]" },
        "stair_us_irc_rise_run_sum_approx": { "sum_in": 18, "notes": "IRC suggestion for comfort [40]" },
    },
    "TIER_C": { // Contextual Objects: Furniture, Appliances, Vehicles. Useful for broader scene scale and contextual validation.
        "sofa_three_seat": { "length_in_min": 73, "length_in_max": 87, "depth_in_min": 34, "depth_in_max": 40, "height_in_min": 30, "height_in_max": 35, "seat_depth_in_min": 22, "seat_depth_in_max": 28, "notes": "Standard living room sofa [42]" },
        "loveseat": { "length_in_min": 56, "length_in_max": 72, "depth_in_min": 34, "depth_in_max": 40, "height_in_min": 30, "height_in_max": 35, "seat_height_in_min": 17, "seat_height_in_max": 20, "seat_depth_in_min": 20, "seat_depth_in_max": 24, "notes": "Standard living room loveseat [42]" },
        "sofa_four_seater": { "width_in_min": 88, "width_in_max": 96, "depth_in_min": 34, "depth_in_max": 40, "height_in_min": 30, "height_in_max": 35, "notes": "Standard [42]" },
        "sofa_five_seater": { "width_in_min": 100, "width_in_max": 110, "depth_in_min": 34, "depth_in_max": 40, "height_in_min": 30, "height_in_max": 35, "notes": "Standard [42]" },
        "sofa_modular_section": { "width_in_min": 20, "width_in_max": 35, "depth_in_min": 34, "depth_in_max": 40, "height_in_min": 30, "height_in_max": 35, "notes": "Individual section; total length 70-210 inches when combined [42]" },
        "sofa_l_shaped_total": { "width_in_min": 90, "width_in_max": 150, "depth_in_min": 60, "depth_in_max": 95, "height_in_min": 34, "height_in_max": 40, "notes": "Total assembled dimensions [42]" },
        "sofa_bed_as_sofa": { "width_in_min": 70, "width_in_max": 85, "depth_in_min": 34, "depth_in_max": 40, "height_in_min": 30, "height_in_max": 35, "notes": "Dimensions when configured as a sofa [42]" },
        "sofa_bed_as_bed": { "length_in_min": 70, "length_in_max": 85, "width_in_min": 40, "width_in_max": 55, "clearance_in": 27, "notes": "Dimensions when extended as a bed; requires 27 inches clearance [42]" },
        "sofa_armrest_width_wide": { "width_in_min": 8, "width_in_max": 10, "notes": "Provides more support [42]" },
        "sofa_armrest_width_narrow": { "width_in_min": 4, "width_in_max": 6, "notes": "Saves space [42]" },
        "sofa_leg_height_high": { "height_in_min": 7, "height_in_max": 9, "notes": "Creates sense of space [42]" },
        "sofa_leg_height_low": { "height_in_min": 2, "height_in_max": 4, "notes": "Offers grounded, cozy feel [42]" },
        "dining_table_width_standard": { "width_in_min": 36, "width_in_max": 40, "notes": "Standard dining table width [43]" },
        "dining_table_length_4_person": { "length_in": 48, "notes": "For seating four people [43]" },
        "dining_table_length_4_6_person": { "length_in_min": 60, "notes": "For seating four to six people [43]" },
        "dining_table_length_6_8_person": { "length_in_min": 78, "notes": "For seating six to eight people [43]" },
        "dining_table_clearance_min": { "clearance_in": 36, "notes": "Minimum clearance around table [43]" },
        "dining_table_clearance_ideal": { "clearance_in_min": 42, "clearance_in_max": 48, "notes": "Ideal clearance around table [43]" },
        "dining_table_thoroughfare_min": { "clearance_in": 48, "notes": "Minimum for an entrance or thoroughfare [43]" },
        "dining_table_place_setting_linear_space": { "space_in_min": 28, "space_in_max": 30, "notes": "Linear space per place setting (36in with serving pieces) [43]" },
        "dining_table_max_width_pass_across": { "width_in": 48, "notes": "Maximum width to allow people to pass across [43]" },
        "dining_table_seating_capacity_linear_space_per_person": { "space_in": 24, "notes": "Linear space allocated per person for seating capacity [43]" },
        "bed_crib": { "width_in": 27, "length_in": 52, "width_cm": 68.5, "length_cm": 132, "notes": "Standard crib mattress size [44]" },
        "bed_twin": { "width_in": 39, "length_in": 75, "width_cm": 96.5, "length_cm": 190.5, "notes": "Also known as single mattress [44]" },
        "bed_twin_xl": { "width_in": 39, "length_in": 80, "width_cm": 96.5, "length_cm": 203.5, "notes": "Standard for college dorm rooms [44]" },
        "bed_full": { "width_in": 54, "length_in": 75, "width_cm": 134.5, "length_cm": 190.5, "notes": "Also known as double mattress [44]" },
        "bed_queen": { "width_in": 60, "length_in": 80, "width_cm": 152.5, "length_cm": 203.5, "notes": "Most popular and versatile size [44]" },
        "bed_king": { "width_in": 76, "length_in": 80, "width_cm": 193, "length_cm": 203.5, "notes": "Equivalent to two Twin XL mattresses [44]" },
        "bed_california_king": { "width_in": 72, "length_in": 84, "width_cm": 183, "length_cm": 213.5, "notes": "Slightly narrower but longer than standard King [44]" },
        "refrigerator_standard": { "width_in_min": 24, "width_in_max": 40, "height_in_min": 61, "height_in_max": 72, "depth_in_min": 28, "depth_in_max": 35, "capacity_cu_ft_min": 20, "capacity_cu_ft_max": 25, "notes": "General range for most refrigerators [45]" },
        "refrigerator_side_by_side": { "width_in_min": 30, "width_in_max": 36, "height_in_min": 67, "height_in_max": 70, "depth_in_min": 29, "depth_in_max": 35, "notes": "Standard style [45]" },
        "refrigerator_french_door": { "width_in_min": 30, "width_in_max": 36, "height_in_min": 67, "height_in_max": 70, "depth_in_min": 29, "depth_in_max": 35, "notes": "Standard style [45]" },
        "car_compact": { "length_ft_min": 10, "length_ft_max": 14, "width_ft_min": 5.5, "width_ft_max": 6, "height_ft_min": 4.5, "height_ft_max": 5, "notes": "Smallest car option [24, 25]" },
        "car_mid_size": { "length_ft_min": 14, "length_ft_max": 16, "width_ft": 6, "height_ft_min": 5, "height_ft_max": 5.5, "notes": "Second-largest car option [24, 25]" },
        "car_full_size": { "length_ft_min": 16, "length_ft_max": 18, "width_ft_min": 6, "width_ft_max": 7, "height_ft_min": 5.5, "height_ft_max": 6, "notes": "Largest car option [24, 25]" },
        "car_standard_length": { "length_in_min": 186, "length_in_max": 200, "length_ft_min": 15.5, "length_ft_max": 16.7, "notes": "General standard car length [24, 25]" },
        "bicycle_adult": { "length_in": 69, "length_cm": 175, "height_in": 42, "height_cm": 105, "notes": "Average adult bike [26, 27]" },
        "bicycle_adult_handlebars_road": { "width_in_min": 15, "width_in_max": 18, "width_cm_min": 38, "width_cm_max": 46, "notes": "Road bike handlebars [26, 27]" },
        "bicycle_adult_handlebars_hybrid_mtb": { "width_in_min": 20, "width_in_max": 24, "width_cm_min": 51, "width_cm_max": 61, "notes": "Hybrid/Mountain bike handlebars [26, 27]" },
        "bus_double_decker": { "length_ft_min": 30, "length_ft_max": 45, "width_ft_min": 8, "width_ft_max": 9, "height_ft_min": 13, "height_ft_max": 14, "notes": "Typical double decker bus" },
        "bus_school_full_size": { "length_ft_min": 35, "length_ft_max": 40, "width_ft": 8, "height_ft_min": 9.5, "height_ft_max": 10.5, "notes": "Iconic yellow school bus" },
        "bus_school_mini": { "length_ft_min": 20, "length_ft_max": 25, "width_ft": 7.5, "height_ft": 10, "notes": "Mini bus, 10-25 passengers" },
        "bus_coach": { "length_ft": 45, "width_ft": 8.5, "height_ft": 12, "notes": "Largest school bus type, up to 60 passengers" },
        "car_maruti_swift": { "length_mm": 3845, "width_mm": 1735, "height_mm": 1530, "length_ft": 12.61, "width_ft": 5.69, "height_ft": 5.02, "notes": "Extremely common hatchback in India." },
        "car_maruti_alto": { "length_mm": 3530, "width_mm": 1490, "height_mm": 1520, "length_ft": 11.58, "width_ft": 4.89, "height_ft": 4.99, "notes": "One of the most popular small cars in India." },
        "car_hyundai_creta": { "length_mm": 4300, "width_mm": 1790, "height_mm": 1635, "length_ft": 14.11, "width_ft": 5.87, "height_ft": 5.36, "notes": "Very popular compact SUV in India." },
        "car_tata_nexon": { "length_mm": 3995, "width_mm": 1804, "height_mm": 1620, "length_ft": 13.11, "width_ft": 5.92, "height_ft": 5.31, "notes": "Popular Indian compact SUV." },
        "car_mahindra_scorpio": { "length_mm": 4662, "width_mm": 1917, "height_mm": 1857, "length_ft": 15.3, "width_ft": 6.29, "height_ft": 6.09, "notes": "Iconic and widely used SUV in India (Scorpio-N model)." },
        "car_toyota_innova": { "length_mm": 4735, "width_mm": 1830, "height_mm": 1795, "length_ft": 15.53, "width_ft": 6.0, "height_ft": 5.89, "notes": "Very common MUV/MPV in India, often used as a taxi (Innova Crysta model)." },
        "bike_hero_splendor": { "length_mm": 2000, "width_mm": 720, "height_mm": 1052, "length_ft": 6.56, "notes": "Best-selling motorcycle in India." },
        "bike_honda_activa": { "length_mm": 1833, "width_mm": 697, "height_mm": 1156, "length_ft": 6.01, "notes": "Best-selling scooter in India." },
        "bike_royal_enfield_classic_350": { "length_mm": 2145, "width_mm": 785, "height_mm": 1090, "length_ft": 7.04, "notes": "Iconic and very common cruiser-style motorcycle in India." },
        "bike_bajaj_pulsar": { "length_mm": 2017, "width_mm": 804, "height_mm": 1075, "length_ft": 6.62, "notes": "Popular series of sport-commuter motorcycles in India (NS200 model)." },
        "bus_ashok_leyland_city": { "length_mm": 12000, "width_mm": 2600, "height_mm": 2900, "length_ft": 39.37, "width_ft": 8.53, "height_ft": 9.51, "notes": "Standard city bus common in many Indian metropolitan areas." },
        "bus_tata_marcopolo_city": { "length_mm": 12000, "width_mm": 2550, "height_mm": 3100, "length_ft": 39.37, "width_ft": 8.36, "height_ft": 10.17, "notes": "Another very common city bus in India." },
        "bus_volvo_intercity": { "length_mm": 12000, "width_mm": 2600, "height_mm": 3600, "length_ft": 39.37, "width_ft": 8.53, "height_ft": 11.81, "notes": "Common inter-city/state luxury coach bus in India (e.g., 9400 B8R model)." }
    },
    "TIER_D": { // Least Reliable/Contextual Inference: Use with extreme caution, for rough estimates only.
        "human_body_parts": { "notes": "Highly individual, lack precision for robust AI estimations. E.g., knuckle (approx 1 inch),, human face (approx 110mm) palm width (approx 4 inches), hand span (approx 8 inches). Use only if no other references are available, and state low confidence. [28]" }
    }
};

// --- ADVANCED AI SYSTEM PROMPT (UPGRADED with STRICT female height range directive) ---
const AI_SYSTEM_PROMPT = `
You are an Advanced Photogrammetry & Anthropometry Engine. Your mission is to estimate human height from visual data by following a rigorous, multi-step protocol derived from expert computer vision principles. You must be analytical, precise, and transparent in your reasoning.

**ANALYSIS PROTOCOL**

**Step 1: Image Quality Assessment (IQA) & Scene Understanding**
1.1. First, analyze the overall quality of the provided image(s). Note any significant issues such as: severe blur, low-light conditions, high noise, extreme perspective distortion, or reflective surfaces that could compromise measurement.
1.2. Perform a semantic analysis of the scene. Identify the environment (e.g., indoor, outdoor, office, street) and the primary objects present.

**Step 2: Hierarchical Reference Identification**
Your primary goal is to find the single most reliable reference object to establish a real-world scale (e.g., mm/pixel ratio). You MUST search in this strict order of priority:
2.1. **Priority #1: Tier S/A References.** Scan for high-confidence detections of objects from the \`TIER_S\` or \`TIER_A\` lists. This is your most preferred method.
2.2. **Priority #2: Tier B/C Implicit References.** If no Tier S/A objects are found, search for architectural features or large objects from \`TIER_B\` or \`TIER_C\`. Use their known dimensions to establish a plausible scale.
2.3. **Priority #3: Tier D Anthropometric Fallback.** As a last resort, if no other references exist, use the detected human face itself as a reference, based on the \`AVERAGE_FACE_DIMENSIONS\` data. You MUST state this is a low-confidence fallback.

**Step 3: Subject Analysis & Advanced Demographic Inference**
3.1. Identify the primary human subject.
3.2. **Your gender determination must be a reasoned conclusion, not a blind acceptance of the \`gender\` field from the data dossier.** You must perform a visual confirmation.
3.3. **Visual Confirmation Checklist:** Explicitly look for and consider these indicators:
    - **facialHair:** Is there a visible beard or mustache?
    - **makeup:** Are there visible cosmetics (e.g., lipstick, eyeliner)?
    - **hair:** Note the style and length of the hair.
    - **accessories:** Note any gender-associated accessories (e.g., earrings, hats).
    - **headPose/Body Frame:** Analyze the overall head shape and body structure for typical masculine or feminine cues.
3.4. Conclude the most likely **gender** (Male/Female), **age group** (e.g., Child, Teenager, Adult, Senior), and, if possible, **ethnicity** (e.g., East Asian, Caucasian, etc.).

**Step 4: Core Height Calculation**
4.1. Using the scale established in Step 2, calculate the subject's height.
4.2. **Crucially, you must apply geometric corrections.** Account for the subject's posture (e.g., slouching, bending knees) and perspective foreshortening. Your calculation should be based on a rectified, "un-distorted" model of the person.

**Step 5: Plausibility Adjustment with Strict Female Range (CRITICAL UPGRADE)**
This is a mandatory validation step with a specific, strict rule.
5.1. **Check the determined gender from Step 3.**
5.2. **Apply Plausibility Range:**
    - **If Gender is Female:** Your plausibility range is **strictly and non-negotiably [150, 165] cm.**
    - **If Gender is Male (or other):** You will establish a wider, adaptive plausibility range (e.g., [165, 190] cm) based on inferred age and ethnicity.
5.3. **Compare and Adjust:** Compare your calculated height from Step 4 to the selected range. If the calculated height is outside this range, you MUST adjust it to the NEAREST edge of the box.
5.4. **Mandatory Reporting:** You MUST report if an adjustment was made and what the original calculation was. This adjustment signifies lower confidence.

**Step 6: Confidence Scoring & Final Report Generation**
6.1. Generate a final confidence score. It should be high (>85%) for a clear image with a Tier-S reference. It must be significantly lower (<40%) if you used the Tier-D fallback or made a large plausibility adjustment.
6.2. Produce a final JSON report according to the specified schema. Be detailed in your methodology.

**JSON OUTPUT SCHEMA**
{
  "estimation": "The final, possibly adjusted, estimated height in cm and ft/in.",
  "methodology": "Detailed narrative. State the chosen reference method (e.g., 'Tier-S: credit_card'). State the original calculated height and CLEARLY declare if a plausibility adjustment was made. Mention key visual cues used for gender determination.",
  "imageQualityAssessment": "A brief summary of image quality (e.g., 'Good quality, well-lit' or 'Poor quality, significant motion blur').",
  "inferredDemographics": {
    "gender": "Male/Female/Undetermined",
    "ageGroup": "Child/Teenager/Adult/Senior",
    "ethnicity": "Detected ethnicity or 'Undetermined'"
  },
  "plausibility": {
    "reasoning": "Justification for the chosen range (e.g., 'Strict range applied for Female subject' or 'Based on inferred Adult Caucasian Male demographics').",
    "range_cm": "[<min_cm>, <max_cm>]",
    "adjustment_applied": "true/false"
  },
  "confidenceScore": "A final percentage reflecting the overall confidence in the estimate.",
  "caveats": "Bulleted list of factors reducing confidence (e.g., 'Posture correction applied', 'Low-confidence fallback used', 'Strict female height constraint applied').",
  "visualizationData": {
    "sourceImageIndex": "Index of the image used for calculation.",
    "personBox": { "x": <number>, "y": <number>, "w": <number>, "h": <number> },
    "referenceBox": { "x": <number>, "y": <number>, "w": <number>, "h": <number> }
  }
}
`;

// --- USAGE TRACKING LOGIC ---
let hourlyApiCallCount = 20;

function resetHourlyLimit() {
    const now = new Date();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();
    const msUntilNextHour = ((59 - minutes) * 60 + (60 - seconds)) * 1000;
    setTimeout(() => {
        console.log(`[USAGE] HOURLY RESET: API call limit has been reset to 20.`);
        hourlyApiCallCount = 20;
        setInterval(() => {
            console.log(`[USAGE] HOURLY RESET: API call limit has been reset to 20.`);
            hourlyApiCallCount = 20;
        }, 3600000);
    }, msUntilNextHour);
    console.log(`[INFO] Usage tracker initialized. Next reset in ${Math.round(msUntilNextHour / 60000)} minutes.`);
}

// --- EXPRESS APP INITIALIZATION ---
const app = express();
app.use(cors());
app.use(express.static('.'));
app.use(express.json({ limit: '50mb' }));

// --- API ENDPOINTS ---
app.get('/api/usage', (req, res) => {
    res.json({ remaining: hourlyApiCallCount });
});

app.post('/api/analyze', async (req, res) => {
    if (hourlyApiCallCount <= 0) {
        console.log("[USAGE] RATE LIMIT HIT: A user was blocked as the hourly limit is exhausted.");
        return res.status(429).json({ error: 'Hourly free analysis limit reached. Please try again later.' });
    }

    const { images } = req.body;
    if (!images || !Array.isArray(images) || images.length === 0 || images.length > 4) {
        return res.status(400).json({ error: 'Please provide 1 to 4 images in the correct format.' });
    }

    hourlyApiCallCount--;
    console.log(`[USAGE] API call initiated. Remaining calls this hour: ${hourlyApiCallCount}`);

    try {
        const visionApiUrl = new URL('vision/v3.2/analyze', AZURE_ENDPOINT);
        let analysisDossier = [];

        for (let i = 0; i < images.length; i++) {
            const base64Data = images[i].split(',')[1];
            if (!base64Data) {
                hourlyApiCallCount++;
                console.error(`[ERROR] REFUND: Malformed base64 string for image ${i + 1}.`);
                return res.status(400).json({ error: `Image ${i + 1} is not a valid base64 string.` });
            }
            const imageBuffer = Buffer.from(base64Data, 'base64');

            console.log(`[INFO] Analyzing image ${i + 1} of ${images.length} with Azure Vision...`);
            
            const azureResponse = await axios.post(visionApiUrl.href, imageBuffer, {
                headers: {
                    'Ocp-Apim-Subscription-Key': AZURE_KEY,
                    'Content-Type': 'application/octet-stream'
                },
                params: { 
                    'visualFeatures': 'Objects,Faces'
                }
            });

            const imageAnalysis = {
                sourceImageIndex: i,
                detectedObjects: azureResponse.data.objects.map(obj => ({
                    name: obj.object,
                    confidence: obj.confidence,
                    box: { x: obj.rectangle.x, y: obj.rectangle.y, w: obj.rectangle.w, h: obj.rectangle.h }
                })),
                detectedFaces: azureResponse.data.faces.map(face => ({
                    age: face.age,
                    gender: face.gender,
                    box: { x: face.faceRectangle.left, y: face.faceRectangle.top, w: face.faceRectangle.width, h: face.faceRectangle.height }
                }))
            };
            analysisDossier.push(imageAnalysis);
        }

        const personFound = analysisDossier.some(analysis =>
            analysis.detectedObjects.some(obj => obj.name === 'person')
        );

        if (!personFound) {
            hourlyApiCallCount++;
            console.log(`[INFO] REFUND: No person detected in any image. Remaining calls: ${hourlyApiCallCount}`);
            return res.status(400).json({ error: 'No person was detected in any of the provided images.' });
        }

        console.log('[INFO] Dossier compiled. Sending to Gemini for advanced analysis...');
        
        const reasoningPrompt = `
        **Data Dossier:**
        ${JSON.stringify(analysisDossier, null, 2)}

        **Knowledge Base:**
        ${JSON.stringify({ ...KNOWN_OBJECT_DIMENSIONS, AVERAGE_FACE_DIMENSIONS }, null, 2)}

        **Task:**
        Execute the full analysis protocol.
        `;

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_KEY}`;
        const geminiPayload = {
            "contents": [
                { "role": "user", "parts": [{ "text": AI_SYSTEM_PROMPT }] },
                { "role": "model", "parts": [{ "text": "Photogrammetry & Anthropometry Engine online. Awaiting data dossier and knowledge base. All protocols are active." }] },
                { "role": "user", "parts": [{ "text": reasoningPrompt }] }
            ],
            "generationConfig": { "responseMimeType": "application/json" }
        };

        const geminiResponse = await axios.post(geminiUrl, geminiPayload);

        if (!geminiResponse.data.candidates || geminiResponse.data.candidates.length === 0 || !geminiResponse.data.candidates[0].content.parts[0].text) {
            throw new Error("AI response was empty or malformed.");
        }
        const reasonedResultText = geminiResponse.data.candidates[0].content.parts[0].text;
        const finalJsonResult = JSON.parse(reasonedResultText);

        console.log('[INFO] Analysis complete. Sending result to client.');
        res.json(finalJsonResult);

    } catch (error) {
        hourlyApiCallCount++;
        const errorMessage = error.response ? JSON.stringify(error.response.data) : error.message;
        console.error(`[ERROR] REFUND: Analysis pipeline failed. Remaining calls: ${hourlyApiCallCount}. Details:`, errorMessage);
        res.status(500).json({ error: 'An error occurred during the AI analysis process.' });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`✅ Server is up and running at http://localhost:${PORT}`);
    resetHourlyLimit();
});
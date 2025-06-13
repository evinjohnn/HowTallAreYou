document.addEventListener('DOMContentLoaded', () => {
    // NO API KEY NEEDED HERE! It's safely stored on the server.

    // --- DOM Element Selectors ---
    const imageUploadInput = document.getElementById('image-upload');
    const imagePreviewContainer = document.getElementById('image-preview-container');
    const analyzeBtn = document.getElementById('analyze-btn');
    const resetBtn = document.getElementById('reset-btn');
    const userHeightInput = document.getElementById('user-height-input');
    const heightUnitSelect = document.getElementById('height-unit');
    const errorMessageDiv = document.getElementById('error-message');
    
    const landingPage = document.getElementById('landing-page');
    const resultsPage = document.getElementById('results-page');
    
    // --- State Management ---
    let uploadedImages = [];
    const MAX_IMAGES = 4;

    // --- Event Listeners ---
    imageUploadInput.addEventListener('change', handleImageUpload);
    analyzeBtn.addEventListener('click', handleAnalysis);
    resetBtn.addEventListener('click', showLandingPage);

    // --- Functions ---
    function handleImageUpload(event) {
        const files = event.target.files;
        const remainingSlots = MAX_IMAGES - uploadedImages.length;
        const filesToProcess = Math.min(files.length, remainingSlots);

        for (let i = 0; i < filesToProcess; i++) {
            const file = files[i];
            if (!file.type.startsWith('image/')) continue;
            const reader = new FileReader();
            reader.onload = (e) => {
                uploadedImages.push(e.target.result);
                updateImagePreview();
            };
            reader.readAsDataURL(file);
        }
        if (uploadedImages.length >= MAX_IMAGES) {
            imageUploadInput.disabled = true;
        }
    }

    function updateImagePreview() {
        imagePreviewContainer.innerHTML = '';
        uploadedImages.forEach((image, index) => {
            const div = document.createElement('div');
            div.className = 'uploaded-image-container';
            div.innerHTML = `
                <img src="${image}" alt="Uploaded image ${index + 1}">
                <button class="remove-image" data-index="${index}">×</button>
            `;
            imagePreviewContainer.appendChild(div);
        });
        // Add event listeners to new remove buttons
        document.querySelectorAll('.remove-image').forEach(button => {
            button.addEventListener('click', (e) => removeImage(e.target.dataset.index));
        });
    }

    function removeImage(index) {
        uploadedImages.splice(index, 1);
        updateImagePreview();
        imageUploadInput.disabled = false;
    }
    
    function showError(message) {
        errorMessageDiv.textContent = message;
        errorMessageDiv.style.display = 'block';
    }

    function hideError() {
        errorMessageDiv.style.display = 'none';
    }

    function toggleLoading(isLoading) {
        const btnText = analyzeBtn.querySelector('.btn-text');
        const spinner = analyzeBtn.querySelector('.spinner');
        
        analyzeBtn.disabled = isLoading;
        if (isLoading) {
            btnText.style.display = 'none';
            spinner.style.display = 'block';
        } else {
            btnText.style.display = 'inline';
            spinner.style.display = 'none';
        }
    }

    async function handleAnalysis() {
        hideError();
        
        // --- Validation ---
        if (uploadedImages.length === 0) {
            showError('Please upload at least one image.');
            return;
        }
        if (!userHeightInput.value) {
            showError('Please enter your height.');
            return;
        }
        // No API key check needed since it's handled server-side

        toggleLoading(true);
        let aiResultText = "Failed to get a result.";

        try {
            // --- MODIFIED PART: Call your own backend endpoint ---
            const response = await fetch('/api/analyze', {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ 
                    image: uploadedImages[0] // Send the full data URL including the data:image prefix
                })
            });
            // --- END OF MODIFIED PART ---

            if (!response.ok) {
                let errorMessage = 'Server error occurred';
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorMessage;
                } catch (e) {
                    // If response isn't JSON, use status text
                    errorMessage = response.statusText || errorMessage;
                }
                throw new Error(errorMessage);
            }

            const data = await response.json();
            const aiHeightCmText = data.result.trim();
            const aiHeightCm = parseFloat(aiHeightCmText);

            if (isNaN(aiHeightCm) || aiHeightCm <= 0) {
                aiResultText = "Could not determine height from the image.";
            } else {
                const totalInches = aiHeightCm / 2.54;
                const feet = Math.floor(totalInches / 12);
                const inches = Math.round(totalInches % 12);
                aiResultText = `${Math.round(aiHeightCm)} cm (~${feet}'${inches}")`;
            }
            showResultsPage(userHeightInput.value, heightUnitSelect.value, aiResultText);

        } catch (error) {
            console.error("Error analyzing height:", error);
            showError(`Analysis failed: ${error.message}`);
        } finally {
            toggleLoading(false);
        }
    }

    function showResultsPage(userHeight, heightUnit, aiResultText) {
        landingPage.style.display = 'none';
        resultsPage.style.display = 'block';

        document.getElementById('ai-height-result').textContent = aiResultText;

        let userHeightCm;
        let formattedUserHeight;
        const userHeightNum = parseFloat(userHeight);

        if (heightUnit === 'cm') {
            userHeightCm = userHeightNum;
            const totalInches = userHeightCm / 2.54;
            const feet = Math.floor(totalInches / 12);
            const inches = Math.round(totalInches % 12);
            formattedUserHeight = `${userHeightCm} cm (~${feet}'${inches}")`;
        } else { // 'ft'
            const feet = Math.floor(userHeightNum);
            const inches = Math.round((userHeightNum - feet) * 12);
            userHeightCm = (feet * 12 + inches) * 2.54;
            formattedUserHeight = `${feet}'${inches}" (~${Math.round(userHeightCm)} cm)`;
        }
        document.getElementById('user-height').textContent = formattedUserHeight;

        // Update Hall of Fame
        let percentile = 50;
        if (userHeightCm) {
            // Simple scale: 150cm = 10%, 175cm = 50%, 200cm = 90%
            percentile = Math.max(0, Math.min(100, ((userHeightCm - 150) / (200 - 150)) * 80 + 10));
        }
        document.getElementById('your-height-marker').style.left = `${percentile}%`;
        document.getElementById('hall-of-fame-text').textContent = `You are taller than ~${Math.round(percentile)}% of users`;
    }

    function showLandingPage() {
        landingPage.style.display = 'flex';
        resultsPage.style.display = 'none';
        hideError();
        
        // Reset state
        imageUploadInput.value = '';
        imageUploadInput.disabled = false;
        uploadedImages = [];
        updateImagePreview();
        userHeightInput.value = '';
    }
});
// In script.js
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element Selectors ---
    const imageUploadInput = document.getElementById('image-upload');
    const uploadBtn = document.getElementById('upload-btn');
    const imagePreviewContainer = document.getElementById('image-preview-container');
    const analyzeBtn = document.getElementById('analyze-btn');
    const resetBtn = document.getElementById('reset-btn');
    // userHeightInput and heightUnitSelect are no longer needed as the AI handles height estimation
    const errorMessageDiv = document.getElementById('error-message');
    const landingPage = document.getElementById('landing-page');
    const resultsPage = document.getElementById('results-page');

    // --- State Management ---
    let uploadedImages = [];
    const MAX_IMAGES = 4;

    // --- Event Listeners ---
    uploadBtn.addEventListener('click', () => imageUploadInput.click());
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

    // --- This is the main function to modify ---
    async function handleAnalysis() {
        hideError();

        if (uploadedImages.length === 0) {
            showError('Please upload at least one image.');
            return;
        }
        // No need to check for userHeightInput anymore, the AI does it all!

        toggleLoading(true);

        try {
            const response = await fetch('/api/analyze', {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ image: uploadedImages[0] })
            });

            const data = await response.json();

            if (!response.ok) {
                // If the server sent a specific error message, use it
                throw new Error(data.error || 'API request failed');
            }

            // We now have the structured report object
            showResultsPage(data);

        } catch (error) {
            console.error("Error analyzing height:", error);
            showError(`Analysis failed: ${error.message}`);
        } finally {
            toggleLoading(false);
        }
    }

    // --- This function is now responsible for displaying the report ---
    function showResultsPage(report) {
        landingPage.style.display = 'none';
        resultsPage.style.display = 'block';

        // Populate the report fields
        document.getElementById('report-estimation').textContent = report.estimation || "Not available.";
        document.getElementById('report-methodology').textContent = report.methodology || "Not available.";
        document.getElementById('report-confidence').textContent = report.confidenceScore || "Not available.";
        document.getElementById('report-caveats').textContent = report.caveats || "None.";

        // Hide or remove the user height comparison elements if they are no longer relevant
        // For example, if you have a div with id 'user-height-comparison-section'
        const userHeightComparisonSection = document.getElementById('user-height-comparison-section');
        if (userHeightComparisonSection) {
            userHeightComparisonSection.style.display = 'none';
        }
    }

    function showLandingPage() {
        landingPage.style.display = 'flex';
        resultsPage.style.display = 'none';
        hideError();

        imageUploadInput.value = '';
        imageUploadInput.disabled = false;
        uploadedImages = [];
        updateImagePreview();
        // userHeightInput is no longer relevant, so no need to clear it
    }
});
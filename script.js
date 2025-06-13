document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element Selectors ---
    const imageUploadInput = document.getElementById('image-upload');
    const uploadBtn = document.getElementById('upload-btn');
    const imagePreviewContainer = document.getElementById('image-preview-container');
    const analyzeBtn = document.getElementById('analyze-btn');
    const errorMessageDiv = document.getElementById('error-message');
    const landingPage = document.getElementById('landing-page');
    const resultsPage = document.getElementById('results-page');
    const aboutContainer = document.querySelector('.about-container');

    let uploadedImages = [];
    const MAX_IMAGES = 4;

    // --- Event Listeners ---
    uploadBtn.addEventListener('click', () => imageUploadInput.click());
    imageUploadInput.addEventListener('change', handleImageUpload);
    analyzeBtn.addEventListener('click', handleAnalysis);

    function handleImageUpload(event) {
        const files = Array.from(event.target.files);
        const remainingSlots = MAX_IMAGES - uploadedImages.length;
        
        files.slice(0, remainingSlots).forEach(file => {
            if (!file.type.startsWith('image/')) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                uploadedImages.push(e.target.result);
                updateImagePreview();
            };
            reader.readAsDataURL(file);
        });
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
            button.addEventListener('click', (e) => removeImage(parseInt(e.target.dataset.index, 10)));
        });
        analyzeBtn.disabled = uploadedImages.length === 0;
    }

    function removeImage(index) {
        uploadedImages.splice(index, 1);
        updateImagePreview();
    }

    function showError(message) {
        errorMessageDiv.textContent = message;
        errorMessageDiv.className = 'error-message'; // Ensure class for styling
        errorMessageDiv.style.display = 'block';
    }

    function hideError() {
        errorMessageDiv.style.display = 'none';
        errorMessageDiv.textContent = '';
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
        if (uploadedImages.length === 0) {
            alert('Please upload at least one image.');
            return;
        }
        toggleLoading(true);

        try {
            const response = await fetch('/api/analyze', {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ images: uploadedImages }) 
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'API request failed');
            
            showResultsPageUI(data);

        } catch (error) {
            console.error("Error analyzing height:", error);
            showError(`Analysis failed: ${error.message}`);
            toggleLoading(false);
        }
    }

    function showResultsPageUI(report) {
        landingPage.style.display = 'none';
        resultsPage.style.display = 'block';
        aboutContainer.style.display = 'none'; // Hide about section on results page
        
        document.getElementById('reset-btn').addEventListener('click', showLandingPageUI);

        document.getElementById('report-estimation').textContent = report.estimation || "---";
        document.getElementById('report-methodology').textContent = report.methodology || "---";
        document.getElementById('report-posture').textContent = report.postureCorrection || "---";
        document.getElementById('report-confidence').textContent = report.confidenceScore || "---";
        document.getElementById('report-caveats').textContent = report.caveats || "---";

        const viz = report.visualizationData;
        if (viz && viz.sourceImageIndex !== undefined) {
            const sourceImage = new Image();
            sourceImage.src = uploadedImages[viz.sourceImageIndex];
            
            sourceImage.onload = () => {
                const canvas = document.getElementById('analysis-canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = sourceImage.naturalWidth;
                canvas.height = sourceImage.naturalHeight;
                ctx.drawImage(sourceImage, 0, 0);

                const drawBox = (box, color, label) => {
                    if(!box) return;
                    ctx.strokeStyle = color;
                    ctx.lineWidth = Math.max(4, sourceImage.naturalWidth * 0.005);
                    ctx.strokeRect(box.x, box.y, box.w, box.h);
                    ctx.fillStyle = color;
                    ctx.font = `bold ${Math.max(16, sourceImage.naturalWidth * 0.02)}px sans-serif`;
                    ctx.fillText(label, box.x, box.y - 10);
                };
                drawBox(viz.personBox, '#39FF14', 'Subject');
                drawBox(viz.referenceBox, '#FF1493', 'Reference');
            };
        }
    }

    function showLandingPageUI() {
        resultsPage.style.display = 'none';
        landingPage.style.display = 'flex';
        aboutContainer.style.display = 'block'; // Show about section again
        hideError();
        imageUploadInput.value = '';
        uploadedImages = [];
        updateImagePreview();
        toggleLoading(false);
    }
});
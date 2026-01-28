// Global variables
let originalImageFile = null;
let originalImageDataUrl = null;

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    initializeFileUpload();
    initializeLogoAnimation();
    initializeRouting();
    fetchMewgenicsWishlistData();
    initializeBackgroundMusic();
});

// Initialize background music
function initializeBackgroundMusic() {
    const songs = [
        { file: 'assets/sounds/mewgenicstheme.mp3', title: 'Mewgenics Theme', artist: 'Matthias Bossi & Jon Evans' },
        { file: 'assets/sounds/themkittybones.mp3', title: 'Them Kitty Bones', artist: 'Matthias Bossi & Jon Evans' },
        { file: 'assets/sounds/eatinrats.mp3', title: 'Eatin Rats', artist: 'Matthias Bossi & Jon Evans' },
        { file: 'assets/sounds/guillotina.mp3', title: 'Guillotina', artist: 'Matthias Bossi & Jon Evans' }
    ];
    
    let currentSongIndex = 0;
    let backgroundMusic = new Audio(songs[currentSongIndex].file);
    const musicToggle = document.getElementById('musicToggle');
    const previousButton = document.getElementById('previousButton');
    const skipButton = document.getElementById('skipButton');
    const nowPlaying = document.getElementById('nowPlaying');
    
    // Configure background music
    backgroundMusic.loop = false; // Don't loop individual songs
    backgroundMusic.volume = 0.12; // 40% quieter than 0.2
    
    let isPlaying = false;
    
    // Update now playing display
    function updateNowPlaying() {
        const currentSong = songs[currentSongIndex];
        nowPlaying.innerHTML = `<small>Now Playing: ${currentSong.title}</small>`;
    }
    
    // Load a new song
    function loadSong(index) {
        const wasPlaying = isPlaying;
        backgroundMusic.pause();
        currentSongIndex = index;
        backgroundMusic = new Audio(songs[currentSongIndex].file);
        backgroundMusic.volume = 0.12;
        updateNowPlaying();
        
        // Auto-advance to next song when current one ends
        backgroundMusic.addEventListener('ended', () => {
            skipSong();
        });
        
        if (wasPlaying) {
            startMusic();
        }
    }
    
    // Show now playing initially
    nowPlaying.style.display = 'block';
    updateNowPlaying();
    
    // Auto-start music (with user interaction requirement)
    function startMusic() {
        backgroundMusic.play().then(() => {
            isPlaying = true;
            musicToggle.textContent = '⏸';
            musicToggle.title = 'Pause Music';
        }).catch(error => {
            console.log('Autoplay prevented by browser:', error);
        });
    }
    
    // Toggle music function
    function toggleMusic() {
        if (isPlaying) {
            backgroundMusic.pause();
            musicToggle.textContent = '▶';
            musicToggle.title = 'Play Music';
            isPlaying = false;
        } else {
            startMusic();
        }
    }
    
    // Skip to next song
    function skipSong() {
        const nextIndex = (currentSongIndex + 1) % songs.length;
        loadSong(nextIndex);
    }
    
    // Go to previous song
    function previousSong() {
        const prevIndex = currentSongIndex === 0 ? songs.length - 1 : currentSongIndex - 1;
        loadSong(prevIndex);
    }
    
    // Auto-advance to next song when current one ends
    backgroundMusic.addEventListener('ended', () => {
        skipSong();
    });
    
    // Add click events
    musicToggle.addEventListener('click', toggleMusic);
    skipButton.addEventListener('click', skipSong);
    previousButton.addEventListener('click', previousSong);
    
    // Try to auto-start music after a short delay
    setTimeout(() => {
        startMusic();
    }, 1000);
}

// Fetch Mewgenics wishlist ranking from games-popularity.com API
async function fetchMewgenicsWishlistData() {
    try {
        // Use the correct swagger endpoint with Mewgenics Steam ID: 686060
        const response = await fetch('https://games-popularity.com/swagger/api/game/top-wishlist/686060');
        
        if (!response.ok) {
            throw new Error(`API request failed with status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Mewgenics wishlist data:', data);
        
        const wishlistStatsElement = document.getElementById('wishlistStats');
        
        if (data && data.history && data.history.length > 0) {
            // Get the most recent position (first item in history array)
            const currentPosition = data.history[0].position;
            const lastUpdated = new Date(data.history[0].added).toLocaleDateString();
            
            wishlistStatsElement.innerHTML = `
                <p><strong>Current Wishlist Ranking:</strong> #${currentPosition}</p>
                <p><strong>Last Updated:</strong> ${lastUpdated}</p>
            `;
        } else {
            wishlistStatsElement.innerHTML = `
                <p><em>No wishlist data found for Mewgenics</em></p>
            `;
        }
    } catch (error) {
        console.error('Error fetching wishlist data:', error);
        document.getElementById('wishlistStats').innerHTML = `
            <p><em>Unable to load wishlist data at this time</em></p>
        `;
    }
}

// Initialize routing system
function initializeRouting() {
    const navLinks = document.querySelectorAll('.nav-link');
    const routeSections = document.querySelectorAll('.route-section');
    let currentMeowAudio = null;
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            const route = this.dataset.route;
            
            // Handle meow route specially - just play sound
            if (route === 'meow') {
                playMeowSound();
                return;
            }
            
            // Update active nav link for non-meow routes
            navLinks.forEach(nav => nav.classList.remove('active'));
            this.classList.add('active');
            
            // Show/hide route sections for non-meow routes
            routeSections.forEach(section => {
                if (section.id === `${route}-route`) {
                    section.style.display = 'block';
                } else {
                    section.style.display = 'none';
                }
            });
        });
    });
    
    // Function to play random meow sound
    function playMeowSound() {
        // Stop any currently playing meow sound
        if (currentMeowAudio && !currentMeowAudio.ended) {
            currentMeowAudio.pause();
            currentMeowAudio.currentTime = 0;
        }
        
        // Array of meow sound files - recordings 1 through 30
        const meowSounds = [];
        for (let i = 1; i <= 30; i++) {
            meowSounds.push(`assets/sounds/Recording${i}.mp3`);
        }
        
        // Pick a random meow sound
        const randomMeow = meowSounds[Math.floor(Math.random() * meowSounds.length)];
        
        // Create and play the audio with volume control
        currentMeowAudio = new Audio(randomMeow);
        currentMeowAudio.volume = 0.3; // Keep volume low to prevent being too loud
        
        // Normalize volume levels across different recordings
        currentMeowAudio.addEventListener('loadedmetadata', function() {
            // Set a consistent, safe volume level
            this.volume = Math.min(0.3, this.volume);
        });
        
        currentMeowAudio.play().catch(error => {
            console.log('Could not play meow sound:', error);
        });
    }
}

// Initialize logo animation
function initializeLogoAnimation() {
    const logoVideo = document.getElementById('logoVideo');
    
    // Set up interval to restart video every 15 seconds
    setInterval(() => {
        logoVideo.currentTime = 0;
        logoVideo.play();
    }, 15000);
}

// Initialize file upload functionality
function initializeFileUpload() {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    
    // Handle file input change
    fileInput.addEventListener('change', handleFileSelect);
    
    // Handle drag and drop
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleDrop);
    uploadArea.addEventListener('click', () => fileInput.click());
}

// Handle drag over
function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.add('dragover');
}

// Handle drag leave
function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('dragover');
}

// Handle drop
function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
}

// Handle file select from input
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        handleFile(file);
    }
}

// Handle file processing
function handleFile(file) {
    // Validate file type
    if (!file.type.startsWith('image/')) {
        alert('Please select an image file, mortal!');
        return;
    }
    
    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
        alert('Your offering is too large! Keep it under 10MB!');
        return;
    }
    
    originalImageFile = file;
    
    // Create FileReader to display preview
    const reader = new FileReader();
    reader.onload = function(e) {
        originalImageDataUrl = e.target.result;
        displayPreview(e.target.result);
    };
    reader.readAsDataURL(file);
}

// Display image preview
function displayPreview(imageSrc) {
    const uploadArea = document.getElementById('uploadArea');
    const previewSection = document.getElementById('previewSection');
    const originalImage = document.getElementById('originalImage');
    
    // Hide upload area and show preview
    uploadArea.style.display = 'none';
    previewSection.style.display = 'block';
    
    // Set the original image
    originalImage.src = imageSrc;
    
    // Reset mutation result
    resetMutationResult();
}

// Reset mutation result
function resetMutationResult() {
    const mutatedResult = document.getElementById('mutatedResult');
    const downloadBtn = document.getElementById('downloadBtn');
    
    mutatedResult.innerHTML = '<div class="mutation-text">Click "MUTATE" to begin the corruption...</div>';
    downloadBtn.style.display = 'none';
}

// Mutate cat function (placeholder)
function mutateCat() {
    if (!originalImageFile) {
        alert('You must offer a sacrifice first!');
        return;
    }
    
    const mutatedResult = document.getElementById('mutatedResult');
    const downloadBtn = document.getElementById('downloadBtn');
    const mutateBtn = document.getElementById('mutateBtn');
    
    // Show loading state
    mutatedResult.innerHTML = '<div class="loading-spinner">🌀</div><div class="mutation-text">Corrupting your feline...</div>';
    mutateBtn.disabled = true;
    mutateBtn.textContent = 'CORRUPTING...';
    
    // Simulate mutation process (replace with actual API call)
    setTimeout(() => {
        // For now, we'll just apply some CSS filters to simulate mutation
        // In a real implementation, you'd send the image to a server or use AI APIs
        simulateMutation();
        
        mutateBtn.disabled = false;
        mutateBtn.textContent = '🐾 CORRUPT AGAIN';
        downloadBtn.style.display = 'inline-block';
    }, 3000);
}

// Simulate mutation (placeholder implementation)
function simulateMutation() {
    const mutatedResult = document.getElementById('mutatedResult');
    
    // Create a canvas to apply effects
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = function() {
        canvas.width = img.width;
        canvas.height = img.height;
        
        // Draw original image
        ctx.drawImage(img, 0, 0);
        
        // Apply some random effects (this is just a placeholder)
        const effects = [
            () => applyColorFilter(ctx, canvas),
            () => applyDistortion(ctx, canvas),
            () => applyGlitch(ctx, canvas)
        ];
        
        // Apply random effect
        const randomEffect = effects[Math.floor(Math.random() * effects.length)];
        randomEffect();
        
        // Display result
        const mutatedImg = document.createElement('img');
        mutatedImg.src = canvas.toDataURL();
        mutatedImg.className = 'mutation-result';
        mutatedImg.alt = 'Mutated cat';
        
        mutatedResult.innerHTML = '';
        mutatedResult.appendChild(mutatedImg);
    };
    
    img.src = originalImageDataUrl;
}

// Apply color filter effect
function applyColorFilter(ctx, canvas) {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
        // Random color mutations
        data[i] = Math.min(255, data[i] * (0.5 + Math.random())); // Red
        data[i + 1] = Math.min(255, data[i + 1] * (0.5 + Math.random())); // Green
        data[i + 2] = Math.min(255, data[i + 2] * (0.5 + Math.random())); // Blue
    }
    
    ctx.putImageData(imageData, 0, 0);
}

// Apply distortion effect
function applyDistortion(ctx, canvas) {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    ctx.save();
    
    // Apply some transformations
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(1 + (Math.random() - 0.5) * 0.3, 1 + (Math.random() - 0.5) * 0.3);
    ctx.rotate((Math.random() - 0.5) * 0.2);
    ctx.translate(-canvas.width / 2, -canvas.height / 2);
    
    ctx.putImageData(imageData, 0, 0);
    ctx.restore();
}

// Apply glitch effect
function applyGlitch(ctx, canvas) {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // Create glitch lines
    for (let i = 0; i < 10; i++) {
        const y = Math.random() * canvas.height;
        const height = 5 + Math.random() * 20;
        const offset = (Math.random() - 0.5) * 50;
        
        const sliceData = ctx.getImageData(0, y, canvas.width, height);
        ctx.putImageData(sliceData, offset, y);
    }
}

// Download result function
function downloadResult() {
    const mutatedImg = document.querySelector('.mutation-result');
    if (!mutatedImg) {
        alert('No corrupted creation to download!');
        return;
    }
    
    // Create download link
    const link = document.createElement('a');
    link.download = 'corrupted-cat-' + Date.now() + '.png';
    link.href = mutatedImg.src;
    link.click();
}

// Reset upload function
function resetUpload() {
    const uploadArea = document.getElementById('uploadArea');
    const previewSection = document.getElementById('previewSection');
    const fileInput = document.getElementById('fileInput');
    
    // Reset variables
    originalImageFile = null;
    originalImageDataUrl = null;
    
    // Reset UI
    uploadArea.style.display = 'block';
    previewSection.style.display = 'none';
    fileInput.value = '';
    
    // Reset button text
    const mutateBtn = document.getElementById('mutateBtn');
    mutateBtn.textContent = '🐾 MUTATE MY CAT';
    mutateBtn.disabled = false;
}

// Utility function to show notifications (you can enhance this)
function showNotification(message, type = 'info') {
    // Simple alert for now - you can replace with a better notification system
    alert(message);
}
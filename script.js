let originalImageFile = null;
let originalImageDataUrl = null;
let fileUploadInitialized = false;
let mutationComplete = false;
let currentMutationData = null;
let catFaceEnabled = true;

// ===== FIREBASE CONFIGURATION =====
const firebaseConfig = {
    apiKey: "AIzaSyDM8NkaXevjYtW5HTBpvNruzaVodsAPfJs",
    authDomain: "mutateyourcat.firebaseapp.com",
    databaseURL: "https://mutateyourcat-default-rtdb.firebaseio.com", // Add this from Firebase Console if different
    projectId: "mutateyourcat",
    storageBucket: "mutateyourcat.firebasestorage.app",
    messagingSenderId: "751831187251",
    appId: "1:751831187251:web:e9a42fbea52bf4ea7a0846",
    measurementId: "G-39VDGC5M63"
};

// Initialize Firebase
let firebaseApp = null;
let database = null;
let pixelsRef = null;

try {
    firebaseApp = firebase.initializeApp(firebaseConfig);
    database = firebase.database();
    pixelsRef = database.ref('pixels');
    console.log('Firebase initialized successfully');
} catch (error) {
    console.warn('Firebase not configured. Running in local mode.', error);
}

// ===== DRAW FUNCTIONALITY =====
class PixelDrawingSystem {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.catImage = new Image();
        this.pixelData = null;
        this.selectedColor = '#0000FF';
        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;
        this.isDragging = false;
        this.lastX = 0;
        this.lastY = 0;
        this.pixelsRemaining = 100;
        this.maxPixels = 100;
        this.cooldownEnd = null;
        this.pixelSize = 4; // Size of each "pixel" the user places
        this.currentTool = 'hand'; // 'place' or 'hand'
        this.firebaseEnabled = false;
        
        // Circle drawing area (will be positioned on cat's face)
        this.drawingCircle = {
            centerX: 0,
            centerY: 0,
            radius: 450
        };
        
        // Second smaller drawing circle
        this.drawingCircle2 = {
            centerX: 0,
            centerY: 0,
            radius: 200
        };
        
        // Third drawing circle
        this.drawingCircle3 = {
            centerX: 0,
            centerY: 0,
            radius: 180
        };
        
        // Fourth drawing circle
        this.drawingCircle4 = {
            centerX: 0,
            centerY: 0,
            radius: 150
        };
    }
    
    init() {
        this.canvas = document.getElementById('drawCanvas');
        if (!this.canvas) return;
        
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        this.canvas.style.cursor = 'grab'; // Default to grab cursor
        
        // Check if Firebase is available
        this.firebaseEnabled = pixelsRef !== null;
        
        if (this.firebaseEnabled) {
            console.log('Using Firebase for live updates');
            this.setupFirebaseListeners();
        } else {
            console.log('Using localStorage (offline mode)');
            this.loadPixelData();
        }
        
        this.loadCooldownData();
        this.setupEventListeners();
        this.loadCatImage();
        this.startCooldownTimer();
    }
    
    loadCatImage() {
        this.catImage.crossOrigin = 'anonymous';
        this.catImage.src = 'assets/images/drawcatface.jpg';
        this.catImage.onload = () => {
            this.canvas.width = this.catImage.width;
            this.canvas.height = this.catImage.height;
            
            // Position circle: 10% to the left and 10% down from center
            this.drawingCircle.centerX = this.canvas.width / 2 + (this.canvas.width * 0.07);
            this.drawingCircle.centerY = this.canvas.height / 2 - (this.canvas.height * 0.06);
            this.drawingCircle.radius = 590; // 3x the original 150
            
            // Position second smaller circle
            this.drawingCircle2.centerX = this.canvas.width / 2 - (this.canvas.width * 0.11);
            this.drawingCircle2.centerY = this.canvas.height / 2 -(this.canvas.height * 0.19);
            this.drawingCircle2.radius = 300;
            
            // Position third circle
            this.drawingCircle3.centerX = this.canvas.width / 2 + (this.canvas.width * 0.14);
            this.drawingCircle3.centerY = this.canvas.height / 2 - (this.canvas.height * 0.115);
            this.drawingCircle3.radius = 330;
            
            // Position fourth circle
            this.drawingCircle4.centerX = this.canvas.width / 2 - (this.canvas.width * 0.03);
            this.drawingCircle4.centerY = this.canvas.height / 2 - (this.canvas.height * 0.06);
            this.drawingCircle4.radius = 400;
            
            this.render();
        };
    }
    
    render() {
        if (!this.ctx || !this.catImage.complete) return;
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw cat image
        this.ctx.drawImage(this.catImage, 0, 0);
        
        // Draw placed pixels
        if (this.pixelData) {
            const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
            const data = imageData.data;
            
            for (let key in this.pixelData) {
                const [x, y] = key.split(',').map(Number);
                const color = this.pixelData[key];
                const rgb = this.hexToRgb(color);
                
                // Draw a pixelSize x pixelSize block
                for (let dy = 0; dy < this.pixelSize; dy++) {
                    for (let dx = 0; dx < this.pixelSize; dx++) {
                        const px = x + dx;
                        const py = y + dy;
                        if (px < this.canvas.width && py < this.canvas.height) {
                            const index = (py * this.canvas.width + px) * 4;
                            data[index] = rgb.r;
                            data[index + 1] = rgb.g;
                            data[index + 2] = rgb.b;
                            data[index + 3] = 255;
                        }
                    }
                }
            }
            
            this.ctx.putImageData(imageData, 0, 0);
        }
        
        // Circles hidden - uncomment to show drawing area boundaries
        /*
        this.ctx.strokeStyle = '#0088FF';
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([10, 5]);
        this.ctx.beginPath();
        this.ctx.arc(this.drawingCircle.centerX, this.drawingCircle.centerY, this.drawingCircle.radius, 0, Math.PI * 2);
        this.ctx.stroke();
        
        this.ctx.beginPath();
        this.ctx.arc(this.drawingCircle2.centerX, this.drawingCircle2.centerY, this.drawingCircle2.radius, 0, Math.PI * 2);
        this.ctx.stroke();
        
        this.ctx.beginPath();
        this.ctx.arc(this.drawingCircle3.centerX, this.drawingCircle3.centerY, this.drawingCircle3.radius, 0, Math.PI * 2);
        this.ctx.stroke();
        
        this.ctx.beginPath();
        this.ctx.arc(this.drawingCircle4.centerX, this.drawingCircle4.centerY, this.drawingCircle4.radius, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        */
    }
    
    setupEventListeners() {
        // Tool selection
        document.getElementById('placeTool').addEventListener('click', () => {
            this.currentTool = 'place';
            document.getElementById('placeTool').classList.add('active');
            document.getElementById('handTool').classList.remove('active');
            this.canvas.style.cursor = 'crosshair';
        });
        
        document.getElementById('handTool').addEventListener('click', () => {
            this.currentTool = 'hand';
            document.getElementById('handTool').classList.add('active');
            document.getElementById('placeTool').classList.remove('active');
            this.canvas.style.cursor = 'grab';
        });
        
        // Color selection
        document.querySelectorAll('.color-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.selectedColor = btn.dataset.color;
                document.getElementById('selectedColor').style.background = this.selectedColor;
                document.getElementById('customColorPicker').value = this.selectedColor;
            });
        });
        
        // Custom color picker
        document.getElementById('customColorPicker').addEventListener('input', (e) => {
            this.selectedColor = e.target.value;
            document.getElementById('selectedColor').style.background = this.selectedColor;
            document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
        });
        
        // Canvas interactions
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', () => this.handleMouseUp());
        this.canvas.addEventListener('mouseleave', () => this.hidePreview());
        this.canvas.addEventListener('click', (e) => this.handleClick(e));
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault()); // Prevent right-click menu
        this.canvas.addEventListener('wheel', (e) => this.handleWheel(e)); // Scroll wheel zoom
        
        // Touch support
        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e));
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e));
        this.canvas.addEventListener('touchend', () => this.handleMouseUp());
    }
    
    handleWheel(e) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        this.adjustZoom(delta);
    }
    
    updateTransform() {
        this.canvas.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
    }
    
    adjustZoom(factor) {
        this.zoom *= factor;
        this.zoom = Math.max(0.5, Math.min(20, this.zoom));
        this.updateTransform();
        document.getElementById('zoomLevel').textContent = `${Math.round(this.zoom * 100)}%`;
    }
    
    resetZoom() {
        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;
        this.updateTransform();
        document.getElementById('zoomLevel').textContent = '100%';
    }
    
    getCanvasCoordinates(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        return {
            x: Math.floor((e.clientX - rect.left) * scaleX),
            y: Math.floor((e.clientY - rect.top) * scaleY)
        };
    }
    
    isInsideDrawingArea(x, y) {
        // Check first circle
        const dx1 = x - this.drawingCircle.centerX;
        const dy1 = y - this.drawingCircle.centerY;
        const inCircle1 = (dx1 * dx1 + dy1 * dy1) <= (this.drawingCircle.radius * this.drawingCircle.radius);
        
        // Check second circle
        const dx2 = x - this.drawingCircle2.centerX;
        const dy2 = y - this.drawingCircle2.centerY;
        const inCircle2 = (dx2 * dx2 + dy2 * dy2) <= (this.drawingCircle2.radius * this.drawingCircle2.radius);
        
        // Check third circle
        const dx3 = x - this.drawingCircle3.centerX;
        const dy3 = y - this.drawingCircle3.centerY;
        const inCircle3 = (dx3 * dx3 + dy3 * dy3) <= (this.drawingCircle3.radius * this.drawingCircle3.radius);
        
        // Check fourth circle
        const dx4 = x - this.drawingCircle4.centerX;
        const dy4 = y - this.drawingCircle4.centerY;
        const inCircle4 = (dx4 * dx4 + dy4 * dy4) <= (this.drawingCircle4.radius * this.drawingCircle4.radius);
        
        return inCircle1 || inCircle2 || inCircle3 || inCircle4;
    }
    
    handleMouseDown(e) {
        if (this.currentTool === 'hand' || e.button === 1 || e.button === 2 || e.shiftKey) {
            this.isDragging = true;
            this.lastX = e.clientX;
            this.lastY = e.clientY;
            this.canvas.style.cursor = 'grabbing';
            e.preventDefault();
        }
    }
    
    handleMouseMove(e) {
        const coords = this.getCanvasCoordinates(e);
        
        if (this.isDragging) {
            const deltaX = e.clientX - this.lastX;
            const deltaY = e.clientY - this.lastY;
            this.panX += deltaX;
            this.panY += deltaY;
            this.lastX = e.clientX;
            this.lastY = e.clientY;
            this.updateTransform();
            return;
        }
        
        // Show preview only in place mode
        if (this.currentTool === 'place' && this.isInsideDrawingArea(coords.x, coords.y) && this.pixelsRemaining > 0) {
            this.showPreview(e, coords);
        } else {
            this.hidePreview();
        }
    }
    
    handleMouseUp() {
        this.isDragging = false;
        if (this.currentTool === 'hand') {
            this.canvas.style.cursor = 'grab';
        } else {
            this.canvas.style.cursor = 'crosshair';
        }
    }
    
    handleTouchStart(e) {
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            const coords = this.getCanvasCoordinates(touch);
            this.placePixel(coords.x, coords.y);
            e.preventDefault();
        }
    }
    
    handleTouchMove(e) {
        e.preventDefault();
    }
    
    showPreview(e, coords) {
        const preview = document.getElementById('pixelPreview');
        preview.classList.add('active');
        preview.style.left = `${e.clientX + 15}px`;
        preview.style.top = `${e.clientY + 15}px`;
        preview.style.background = this.selectedColor;
    }
    
    hidePreview() {
        document.getElementById('pixelPreview').classList.remove('active');
    }
    
    handleClick(e) {
        if (this.isDragging || this.currentTool === 'hand') return;
        
        const coords = this.getCanvasCoordinates(e);
        
        // Silently ignore clicks outside drawing area
        if (!this.isInsideDrawingArea(coords.x, coords.y)) {
            return;
        }
        
        if (this.pixelsRemaining <= 0) {
            alert('No pixels remaining! Wait for the cooldown to finish.');
            return;
        }
        
        this.placePixel(coords.x, coords.y);
    }
    
    placePixel(x, y) {
        // Snap to pixel grid
        x = Math.floor(x / this.pixelSize) * this.pixelSize;
        y = Math.floor(y / this.pixelSize) * this.pixelSize;
        
        // Silently ignore if outside drawing area
        if (!this.isInsideDrawingArea(x, y)) return;
        
        if (this.pixelsRemaining <= 0) return;
        
        // Check if this is a new pixel placement
        if (!this.pixelData) this.pixelData = {};
        const key = `${x},${y}`;
        const existingColor = this.pixelData[key];
        
        // If pixel already exists with same color, don't decrement count
        const isNewPixel = !existingColor || existingColor !== this.selectedColor;
        
        // Store pixel data
        this.pixelData[key] = this.selectedColor;
        
        // Only decrease pixel count for new/changed pixels
        if (isNewPixel) {
            this.pixelsRemaining--;
            this.updatePixelCount();
            
            // If this is the first pixel placed, start cooldown
            if (this.pixelsRemaining === this.maxPixels - 1 && !this.cooldownEnd) {
                this.startCooldown();
            }
            
            // Save data
            this.saveCooldownData();
        }
        
        // Save to Firebase or localStorage
        if (this.firebaseEnabled && pixelsRef) {
            // Save to Firebase (will trigger updates for all users)
            pixelsRef.child(key).set(this.selectedColor).catch(error => {
                console.error('Firebase error:', error);
                // Fallback to localStorage if Firebase fails
                this.savePixelData();
            });
        } else {
            // Fallback to localStorage
            this.savePixelData();
        }
        
        // Re-render
        this.render();
    }
    
    startCooldown() {
        this.cooldownEnd = Date.now() + (60 * 60 * 1000); // 1 hour
        this.saveCooldownData();
    }
    
    startCooldownTimer() {
        setInterval(() => {
            if (this.cooldownEnd && Date.now() >= this.cooldownEnd) {
                this.pixelsRemaining = this.maxPixels;
                this.cooldownEnd = null;
                this.updatePixelCount();
                this.saveCooldownData();
            }
            this.updateCooldownDisplay();
        }, 1000);
    }
    
    updateCooldownDisplay() {
        const timerEl = document.getElementById('cooldownTimer');
        if (!this.cooldownEnd || Date.now() >= this.cooldownEnd) {
            timerEl.textContent = '';
            return;
        }
        
        const remaining = this.cooldownEnd - Date.now();
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        timerEl.textContent = `Next refill in ${minutes}m ${seconds}s`;
    }
    
    updatePixelCount() {
        document.getElementById('pixelCount').textContent = this.pixelsRemaining;
    }
    
    savePixelData() {
        localStorage.setItem('pixelDrawingData', JSON.stringify(this.pixelData));
    }
    
    loadPixelData() {
        const saved = localStorage.getItem('pixelDrawingData');
        if (saved) {
            this.pixelData = JSON.parse(saved);
        }
    }
    
    saveCooldownData() {
        localStorage.setItem('pixelCooldown', JSON.stringify({
            pixelsRemaining: this.pixelsRemaining,
            cooldownEnd: this.cooldownEnd
        }));
    }
    
    loadCooldownData() {
        const saved = localStorage.getItem('pixelCooldown');
        if (saved) {
            const data = JSON.parse(saved);
            this.pixelsRemaining = data.pixelsRemaining;
            this.cooldownEnd = data.cooldownEnd;
            
            // Check if cooldown has expired
            if (this.cooldownEnd && Date.now() >= this.cooldownEnd) {
                this.pixelsRemaining = this.maxPixels;
                this.cooldownEnd = null;
            }
        }
        this.updatePixelCount();
    }
    
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
    }
    
    setupFirebaseListeners() {
        if (!pixelsRef) return;
        
        // Initialize pixelData if not already
        if (!this.pixelData) this.pixelData = {};
        
        // Listen for new pixels from other users
        pixelsRef.on('child_added', (snapshot) => {
            const key = snapshot.key;
            const color = snapshot.val();
            if (this.pixelData[key] !== color) {
                this.pixelData[key] = color;
                this.render();
            }
        });
        
        // Listen for pixel changes from other users
        pixelsRef.on('child_changed', (snapshot) => {
            const key = snapshot.key;
            const color = snapshot.val();
            this.pixelData[key] = color;
            this.render();
        });
        
        // Listen for pixel removals
        pixelsRef.on('child_removed', (snapshot) => {
            const key = snapshot.key;
            delete this.pixelData[key];
            this.render();
        });
        
        console.log('Firebase listeners active - live multiplayer enabled!');
    }
}

let pixelDrawingSystem = null;

document.addEventListener('DOMContentLoaded', function() {
    if (!fileUploadInitialized) {
        initializeFileUpload();
        fileUploadInitialized = true;
    }
    initializeLogoAnimation();
    initializeRouting();
    fetchMewgenicsWishlistData();
    initializeBackgroundMusic();
    
    // Initialize pixel drawing system
    pixelDrawingSystem = new PixelDrawingSystem();
    pixelDrawingSystem.init();
});

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
    
    backgroundMusic.loop = false;
    backgroundMusic.volume = 0.12;
    
    let isPlaying = false;
    
    function updateNowPlaying() {
        const currentSong = songs[currentSongIndex];
        nowPlaying.innerHTML = `<small>Now Playing: ${currentSong.title}</small>`;
    }
    
    function loadSong(index) {
        const wasPlaying = isPlaying;
        backgroundMusic.pause();
        currentSongIndex = index;
        backgroundMusic = new Audio(songs[currentSongIndex].file);
        backgroundMusic.volume = 0.12;
        updateNowPlaying();
        
        backgroundMusic.addEventListener('ended', () => {
            skipSong();
        });
        
        if (wasPlaying) {
            startMusic();
        }
    }
    
    nowPlaying.style.display = 'block';
    updateNowPlaying();
    
    function startMusic() {
        backgroundMusic.play().then(() => {
            isPlaying = true;
            musicToggle.textContent = '⏸';
            musicToggle.title = 'Pause Music';
        }).catch(error => {
            console.log('Autoplay prevented by browser:', error);
        });
    }
    
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
    
    function skipSong() {
        const nextIndex = (currentSongIndex + 1) % songs.length;
        loadSong(nextIndex);
    }
    
    function previousSong() {
        const prevIndex = currentSongIndex === 0 ? songs.length - 1 : currentSongIndex - 1;
        loadSong(prevIndex);
    }
    
    backgroundMusic.addEventListener('ended', () => {
        skipSong();
    });
    
    musicToggle.addEventListener('click', toggleMusic);
    skipButton.addEventListener('click', skipSong);
    previousButton.addEventListener('click', previousSong);
    
    setTimeout(() => {
        startMusic();
    }, 1000);
}

async function fetchMewgenicsWishlistData() {
    try {
        const response = await fetch('https://games-popularity.com/swagger/api/game/top-wishlist/686060?apiKey=fcc42d7f-6510-4d10-b3bf-6fdbc3635195');
        
        if (!response.ok) {
            throw new Error(`API request failed with status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Mewgenics wishlist data:', data);
        
        const wishlistStatsElement = document.getElementById('wishlistStats');
        
        if (data && data.history && data.history.length > 0) {
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
        console.error('Error fetching wishlist data (likely CORS or API issue):', error);
        
        const wishlistStatsElement = document.getElementById('wishlistStats');
        wishlistStatsElement.innerHTML = `
            <p><strong>Mewgenics</strong> is highly anticipated!</p>
            <p><em>Add it to your Steam wishlist to support Edmund McMillen & Tyler Glaiel</em></p>
            <p><small>API temporarily unavailable</small></p>
        `;
    }
}

function toggleCatFace() {
    catFaceEnabled = !catFaceEnabled;
    const toggleBtn = document.getElementById('faceToggleBtn');
    
    if (catFaceEnabled) {
        toggleBtn.style.background = '#4CAF50';
    } else {
        toggleBtn.style.background = '#f44336';
    }
    
    // Only regenerate the image without changing name/stats
    if (mutationComplete && currentMutationData) {
        regenerateImageOnly();
    }
}

function regenerateImageOnly() {
    if (!currentMutationData) return;
    
    // Create canvas from stored image data
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = currentMutationData.imageData.width;
    canvas.height = currentMutationData.imageData.height;
    ctx.putImageData(currentMutationData.imageData, 0, 0);
    
    // Only recreate the composite image, keeping existing name and stats
    recreateCompositeOnly(canvas, currentMutationData.mutationClass);
}

function regenerateMutation() {
    if (!currentMutationData) return;
    
    // Create canvas from stored image data
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = currentMutationData.imageData.width;
    canvas.height = currentMutationData.imageData.height;
    ctx.putImageData(currentMutationData.imageData, 0, 0);
    
    createMutatedCatComposite(canvas, currentMutationData.mutationClass);
}

async function recreateCompositeOnly(mutatedCanvas, mutationClass) {
    const mutatedResult = document.getElementById('mutatedResult');
    const existingContainer = mutatedResult.querySelector('div[style*="position: relative"]');
    
    if (!existingContainer) return;
    
    const bodyFileName = `${mutationClass.name.toLowerCase()}body.png`;
    const catBodyImg = new Image();
    
    catBodyImg.onload = async function() {
        const compositeCanvas = document.createElement('canvas');
        const compositeCtx = compositeCanvas.getContext('2d');
        
        compositeCanvas.width = catBodyImg.width;
        compositeCanvas.height = catBodyImg.height;
        
        // Background
        compositeCtx.fillStyle = '#2d2d2d';
        compositeCtx.fillRect(0, 0, compositeCanvas.width, compositeCanvas.height);
        
        // Ground elements
        const groundCircleRadius = catBodyImg.width * 1.2;
        const groundCircleY = catBodyImg.height * 0.95;
        compositeCtx.fillStyle = '#4c4c4c';
        compositeCtx.beginPath();
        compositeCtx.ellipse(compositeCanvas.width / 2, groundCircleY, groundCircleRadius, groundCircleRadius * 0.25, 0, 0, Math.PI * 2);
        compositeCtx.fill();
        
        // Shadow
        const shadowWidth = catBodyImg.width * 0.2244; // 20% bigger (0.187 * 1.2)
        const shadowHeight = catBodyImg.height * 0.0768; // 20% bigger (0.064 * 1.2)
        const shadowY = catBodyImg.height * 0.88;
        compositeCtx.fillStyle = '#414141';
        compositeCtx.beginPath();
        compositeCtx.ellipse(compositeCanvas.width / 2, shadowY, shadowWidth, shadowHeight, 0, 0, Math.PI * 2);
        compositeCtx.fill();
        
        compositeCtx.drawImage(catBodyImg, 0, 0);
        
        // Cat head positioning
        const cropSize = Math.min(mutatedCanvas.width, mutatedCanvas.height);
        const cropX = (mutatedCanvas.width - cropSize) / 2;
        const cropY = (mutatedCanvas.height - cropSize) / 2;
        
        const circleSize = Math.min(catBodyImg.width * 0.368, catBodyImg.height * 0.368);
        const circleX = (catBodyImg.width - circleSize) / 2 - circleSize * 0.4;
        const circleY = catBodyImg.height * 0.35;
        
        compositeCtx.save();
        compositeCtx.beginPath();
        compositeCtx.arc(circleX + circleSize/2, circleY + circleSize/2, circleSize/2, 0, Math.PI * 2);
        compositeCtx.clip();
        
        compositeCtx.drawImage(
            mutatedCanvas,
            cropX, cropY, cropSize, cropSize,
            circleX, circleY, circleSize, circleSize
        );
        
        compositeCtx.restore();
        
        // Border
        compositeCtx.strokeStyle = '#000000';
        compositeCtx.lineWidth = 38.98;
        compositeCtx.beginPath();
        compositeCtx.arc(circleX + circleSize/2, circleY + circleSize/2, circleSize/2, 0, Math.PI * 2);
        compositeCtx.stroke();
        
        // Face features
        if (catFaceEnabled) {
            await drawCatFaceFeatures(compositeCtx, circleX, circleY, circleSize, mutationClass);
        }
        
        // Update only the image, keep existing name and stats
        const existingImg = existingContainer.querySelector('img');
        if (existingImg) {
            existingImg.src = compositeCanvas.toDataURL();
            window.mutatedImageDataUrl = compositeCanvas.toDataURL();
        }
    };
    
    catBodyImg.src = `assets/images/${bodyFileName}`;
}

function initializeRouting() {
    const navLinks = document.querySelectorAll('.nav-link');
    const routeSections = document.querySelectorAll('.route-section');
    let currentMeowAudio = null;
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            const route = this.dataset.route;
            
            if (route === 'meow') {
                playMeowSound();
                return;
            }
            
            navLinks.forEach(nav => nav.classList.remove('active'));
            this.classList.add('active');
            
            routeSections.forEach(section => {
                if (section.id === `${route}-route`) {
                    section.style.display = 'block';
                    section.classList.add('active');
                    
                    // Initialize draw system when switching to draw route
                    if (route === 'draw' && pixelDrawingSystem) {
                        pixelDrawingSystem.render();
                    }
                } else {
                    section.style.display = 'none';
                    section.classList.remove('active');
                }
            });
        });
    });
    
    function playMeowSound() {
        if (currentMeowAudio && !currentMeowAudio.ended) {
            currentMeowAudio.pause();
            currentMeowAudio.currentTime = 0;
        }
        
        const meowSounds = [];
        for (let i = 1; i <= 30; i++) {
            meowSounds.push(`assets/sounds/Recording${i}.mp3`);
        }
        
        const randomMeow = meowSounds[Math.floor(Math.random() * meowSounds.length)];
        
        currentMeowAudio = new Audio(randomMeow);
        currentMeowAudio.volume = 0.3;
        
        currentMeowAudio.addEventListener('loadedmetadata', function() {
            this.volume = Math.min(0.3, this.volume);
        });
        
        currentMeowAudio.play().catch(error => {
            console.log('Could not play meow sound:', error);
        });
    }
}

function initializeLogoAnimation() {
    const logoVideo = document.getElementById('logoVideo');
    
    setInterval(() => {
        logoVideo.currentTime = 0;
        logoVideo.play();
    }, 15000);
}

function initializeFileUpload() {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    
    fileInput.replaceWith(fileInput.cloneNode(true));
    const newFileInput = document.getElementById('fileInput');
    
    let isProcessing = false;
    
    newFileInput.addEventListener('change', function(e) {
        if (isProcessing) {
            console.log('Already processing a file, ignoring...');
            return;
        }
        
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
            isProcessing = true;
            console.log('Processing file:', file.name);
            
            processSelectedFile(file).finally(() => {
                isProcessing = false;
                e.target.value = '';
            });
        }
    });
    
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', function(e) {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.classList.remove('dragover');
        
        if (isProcessing) return;
        
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].type.startsWith('image/')) {
            isProcessing = true;
            processSelectedFile(files[0]).finally(() => {
                isProcessing = false;
            });
        }
    });
}

async function processSelectedFile(file) {
    console.log('Processing file:', file.name, file.type, file.size);
    
    if (!file.type.startsWith('image/')) {
        alert('Please select an image file, mortal!');
        return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
        alert('Your offering is too large! Keep it under 10MB!');
        return;
    }
    
    originalImageFile = file;
    
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            console.log('FileReader loaded successfully');
            originalImageDataUrl = e.target.result;
            displayPreview(e.target.result);
            resolve();
        };
        reader.onerror = function(e) {
            console.error('FileReader error:', e);
            alert('Failed to read the file. Please try again.');
            reject(e);
        };
        reader.readAsDataURL(file);
    });
}

function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('dragover');
}

function displayPreview(imageSrc) {
    const uploadArea = document.getElementById('uploadArea');
    const previewSection = document.getElementById('previewSection');
    const originalImage = document.getElementById('originalImage');
    const mutateBtn = document.getElementById('mutateBtn');
    
    if (!uploadArea || !previewSection || !originalImage) {
        console.error('Preview elements not found');
        return;
    }
    
    if (mutateBtn) {
        mutateBtn.disabled = true;
        mutateBtn.innerHTML = '<img src="assets/images/mewgenicspaw.png" alt="" class="btn-icon"> LOADING...';
    }
    
    uploadArea.style.display = 'none';
    previewSection.style.display = 'block';
    
    originalImage.onload = function() {
        console.log('Image loaded successfully');
        if (mutateBtn) {
            mutateBtn.disabled = false;
            mutateBtn.innerHTML = '<img src="assets/images/mewgenicspaw.png" alt="" class="btn-icon"> MUTATE';
        }
        resetMutationResult();
    };
    originalImage.onerror = function() {
        console.error('Failed to load image');
        alert('Failed to load the image. Please try again.');
        resetUpload();
    };
    originalImage.src = imageSrc;
}

function resetMutationResult() {
    const mutatedResult = document.getElementById('mutatedResult');
    
    mutatedResult.innerHTML = '<div class="mutation-text">Click "MUTATE" to, well, mutate</div>';
}

function mutateCat() {
    if (!originalImageFile) {
        alert('You must offer a sacrifice first!');
        return;
    }
    
    const mutatedResult = document.getElementById('mutatedResult');
    const mutateBtn = document.getElementById('mutateBtn');
    
    mutatedResult.innerHTML = '<div class="loading-spinner"><img src="assets/images/mewgenicspaw.png" class="spinning-paw"></div><div class="mutation-text">Mutating your image...</div>';
    mutateBtn.disabled = true;
    mutateBtn.innerHTML = '<img src="assets/images/mewgenicspaw.png" alt="" class="btn-icon"> MUTATING...';
    
    setTimeout(() => {
        performColorMutation();
        
        mutateBtn.disabled = false;
        mutateBtn.innerHTML = '<img src="assets/images/mewgenicspaw.png" alt="" class="btn-icon"> MUTATE AGAIN';
        
        mutationComplete = true;
    }, 2000);
}

function performColorMutation() {
    const mutatedResult = document.getElementById('mutatedResult');
    
    const mutationClasses = [
        { color: '#787898', name: 'Mage' },
        { color: '#435d3e', name: 'Ranger' },
        { color: '#b17275', name: 'Fighter' },
        { color: '#86734a', name: 'Tank' },
        { color: '#f4f1de', name: 'Cleric' },
        { color: '#f2cc8f', name: 'Thief' }
    ];
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = function() {
        const maxWidth = 400;
        const maxHeight = 400;
        let { width, height } = img;
        
        if (width > height) {
            if (width > maxWidth) {
                height = (height * maxWidth) / width;
                width = maxWidth;
            }
        } else {
            if (height > maxHeight) {
                width = (width * maxHeight) / height;
                height = maxHeight;
            }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        ctx.drawImage(img, 0, 0, width, height);
        
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        
        const mutationClass = mutationClasses[Math.floor(Math.random() * mutationClasses.length)];
        const mutationColor = mutationClass.color;
        const r = parseInt(mutationColor.slice(1, 3), 16);
        const g = parseInt(mutationColor.slice(3, 5), 16);
        const b = parseInt(mutationColor.slice(5, 7), 16);
        
        for (let i = 0; i < data.length; i += 4) {
            const red = data[i];
            const green = data[i + 1];
            const blue = data[i + 2];
            const alpha = data[i + 3];
            
            if (alpha < 50) {
                continue;
            }
            
            if (red > 240 && green > 240 && blue > 240) {
                continue;
            }
            
            const brightness = (red * 0.299 + green * 0.587 + blue * 0.114) / 255;
            const factor = Math.max(0.3, Math.min(1.2, brightness + 0.2));
            
            data[i] = Math.min(255, Math.max(0, r * factor));
            data[i + 1] = Math.min(255, Math.max(0, g * factor));
            data[i + 2] = Math.min(255, Math.max(0, b * factor));
        }
        
        ctx.putImageData(imageData, 0, 0);
        
        // Store mutation data for regeneration
        currentMutationData = {
            imageData: ctx.getImageData(0, 0, width, height),
            mutationClass: mutationClass
        };
        
        createMutatedCatComposite(canvas, mutationClass);
    };
    
    img.src = originalImageDataUrl;
}

function generateCatStats() {
    const stats = [];
    for (let i = 0; i < 7; i++) {
        const rand = Math.random();
        let stat;
        if (rand < 0.05) stat = 1;
        else if (rand < 0.15) stat = 2;
        else if (rand < 0.40) stat = 3;
        else if (rand < 0.65) stat = 4;
        else if (rand < 0.90) stat = 5;
        else if (rand < 0.95) stat = 6;
        else stat = 7;
        
        stats.push(stat);
    }
    return stats;
}

function generateRandomCatName() {
    const catNames = [
        'Edmund', 'Tyler', 'Lillie', 'Lilly', 'Lily', 'Eight', 'Luna', 'Seven', 'Max', 'Six', 'Charles', 'Charley', 'Charlie', 'Four',
        'Archer', 'Sterling Archer', 'Dexter', 'Fred', 'Freddie', 'Jack', 'Oliver', 'Penny', 'Smokee', 'Smokie', 'Smokey', 'Smoky',
        'Thomas', 'Tom', 'Tommy', 'Three', 'Boris', 'Callie', 'Chairman Meow', 'Chewie', 'Chewy', 'Dusty', 'Frank', 'Frankie',
        'Lenny', 'Leo', 'Link', 'Lucy', 'Mac', 'Marley', 'Odin', 'Oreo', 'Peanut', 'Pumpkin', 'Sasha', 'Simba', 'Simon',
        'Sugar', 'Suki', 'Waffle', 'Waffles', 'Zoe', 'Zoey', 'Two', 'Abby', 'Artemis', 'Athena', 'Ben', 'Benny', 'Buster',
        'Butters', 'Cora', 'Kora', 'Cricket', 'Daisy', 'Daniel', 'Dany', 'Elvis', 'Emma', 'Gato', 'Gizmo', 'Han Solo',
        'Harleigh', 'Harley', 'Henry', 'Hobbes', 'Jackson', 'Jerry', 'Joe', 'Joey', 'Leela', 'Lela', 'Little', 'Lola',
        'Louie', 'Lucky', 'Maybe', 'Milo', 'Mittens', 'Mittenz', 'Monster', 'Monty', 'Mufasa', 'Muffet', 'Muffin', 'Panda',
        'Peach', 'Peaches', 'Penelope', 'Pepper', 'Romeo', 'Sam', 'Shadow', 'Sheldon', 'Steve French', 'Taco', 'Tobi', 'Toby',
        'Winston', 'Ziggy', 'One', 'Agata', 'Aimee', 'Akua', 'Albus', 'Alf', 'All Star', 'Alpha', 'Amigo', 'Anakin',
        'Annabel', 'Arc', 'Areyah', 'Aries', 'Arya', 'Astrid', 'Aussie', 'Autumn', 'BadBoy', 'Bailey', 'Bane', 'Banjo',
        'Barker', 'Barnaby', 'Barney', 'Bartholomew', 'Bastet', 'Batley', 'Batman', 'Battleship', 'Baylor', 'Beans', 'Bear',
        'Bella', 'Belle', 'Bernard Oscar', 'Beta', 'Big Moe', 'Biggles', 'Bill Furray', 'Bingo', 'Binx', 'Biscuit', 'Blitzle',
        'Blue', 'Bluecat', 'Bo', 'Bob', 'Boule Noire', 'Bouncer', 'Bubba', 'Bunny', 'Butterscotch', 'Buttons', 'Candy',
        'Captain Janeway', 'Captain Nemo', 'Carl', 'Carlin', 'Carter', 'Cash', 'Chalice', 'Charlotte', 'Chauncy', 'Cheese',
        'Cheong Mei', 'Chez', 'Chickpea', 'Chloe', 'Chrissy', 'Churchill', 'Cinderella', 'Cisco', 'Claude', 'Cleo', 'Cloud',
        'Clyde', 'Commodore', 'Coral', 'Coraline', 'Cujo', 'Cypress', 'Dali', 'Damien', 'Dante', 'Darla', 'Darwin', 'Dean',
        'Delilah', 'Dezi', 'Diablo', 'Diego', 'Dobby', 'Dolce Lynn', 'Dolly', 'Dovahkiin', 'Dr. Bombay', 'Drusilla', 'Dudley',
        'Duke', 'Edgar', 'Emergency', 'Emmett', 'Ernie', 'Eve', 'Ezio', 'Farofa', 'Felix', 'Fifi', 'Finn', 'Finnegan',
        'Florence', 'Fluff Puff', 'Francine', 'François', 'Frigg', 'Frita', 'Froggy', 'Fudge', 'Gadget', 'Gaia', 'Gallifrey',
        'Garfield', 'George', 'Giblet', 'Gilbert', 'Gilgamesh', 'Ginger', 'Ginko', 'Gisle', 'Glados', 'Godzilla', 'Goose',
        'Gordon', 'Griffey', 'Halo', 'Hawthorne', 'Hazey', 'Heisenberg', 'Helios', 'Hemingway', 'Hexxus', 'Hilo', 'Hjalmy',
        'Hogan', 'Holden', 'Honey', 'Huckle', 'Hunter', 'Ignacio', 'Indiana Jones', 'Inky', 'Isaac', 'Isaiah', 'Isis', 'Jake',
        'James', 'Jareth', 'Jarvis', 'Jasper', 'JD', 'Jeffery', 'Jinx', 'Jory', 'June', 'Junior', 'Kaiser Wilhelm', 'Kalie',
        'Kaliste Strayborn', 'Kasper', 'Keti', 'Kevin', 'Kiara', 'Kidu', 'Kiera', 'Kiki', 'King Hyperion', 'Kins', 'Kira',
        'Kirby', 'Kitana', 'Kitten', 'Kitty', 'Kiwi', 'Krackel', 'Larry', 'Leonard', 'Levi', 'Lexie', 'Liam', 'Loki',
        'Lord Potato', 'Ludwig', 'Luffy', 'Luke', 'Lunatic', 'Lunchbox', 'Lydia', 'Macy', 'Madeline', 'Magellan', 'Maggie',
        'Magoo', 'Maizy', 'Malibu', 'Mana', 'Manny', 'Marceline', 'Mardi', 'Margot', 'Marko', 'Marlowe', 'Marna', 'Marshmallow',
        'Mary', 'Mau', 'Maude', 'Medea', 'Meeko', 'Meera', 'Memine', 'Me-Mow', 'Meowington', 'Merlin', 'Mew', 'Mia',
        'Michaelangelo', 'Midi', 'Midna', 'Miggy', 'Milan', 'Mildred', 'Milkshake', 'Milton', 'Mina', 'Minka', 'Minnie',
        'Mischief', 'Miso', 'Miss Bojangles', 'Miss Furr', 'Miss Kitty', 'Missy', 'Misty', 'Mitzi', 'Mixi', 'Mojo', 'Molly',
        'Moogy', 'Moose', 'Morgan', 'Mort', 'Mosley', 'Mouse', 'Mr. Cuppy Cakes', 'Mr. Riley Toulouse', 'Mr. Tough', 'Muad', 'Dib',
        'Mulan', 'Mushi', 'Nala', 'Napoleon', 'Nas', 'Nels', 'Ness', 'Newt', 'Nicholas', 'Nigel', 'Nikko', 'Niles', 'Nina',
        'Nino', 'Nitro', 'Noel', 'Nymeria', 'Nyx', 'Odessa', 'Olive', 'Opie', 'Oscar', 'Otis', 'Otto', 'Oz', 'Paco', 'Padme',
        'Padraic', 'Papi', 'Paschoal', 'Paw', 'Pax', 'Peekaboo', 'Phoebe', 'Pico', 'Pierre', 'Pineapple', 'Pinocchio',
        'Pistachio', 'Playboy', 'Pluto', 'Pond', 'Pootie', 'Poppet', 'Poppy', 'Purrcules', 'Pushkin', 'Quentin', 'Quinn',
        'Raja', 'Ramses', 'Randy', 'Ranger', 'Red Baron', 'Reese', 'Renly', 'Rhaegar', 'Rita', 'Ritzy', 'River', 'Roger',
        'Roland', 'Rouge', 'Ruby', 'Saffy', 'Sakamoto', 'Sakura', 'Salem', 'Samson', 'Sandwich', 'Scaredy', 'Scorpio',
        'Scratch', 'Scribbles', 'Seabass', 'Shampoo', 'Shay', 'Sheeba', 'Shelly', 'Shimmy', 'Shmi', 'Shocky', 'Sidney',
        'Silver', 'Simone', 'Skippy John', 'Smudge', 'Sneakers', 'Snowball', 'Snowy', 'Sofie', 'Sonny', 'Sparrow',
        'Spartapuss', 'Spectre', 'Spock', 'Spoons', 'Squeakers', 'Squirt', 'Squishy', 'Stripe', 'Sue', 'Sulis', 'Suzi',
        'Sweep', 'Sy', 'Tak', 'Tallow', 'Tallulah', 'Tank', 'Tati', 'Taz', 'Tazo', 'T-Bone', 'Teddy', 'Tex', 'Theodora',
        'Tiddles', 'Tigger', 'Tim', 'Tinkerbell', 'Titan', 'TJ', 'Tobias', 'Topher', 'Toro', 'Trick', 'Trouble', 'Tuna',
        'Twitch', 'Tyson', 'Venom', 'Vern', 'Victor', 'Virtue', 'Visa', 'Wallace', 'Wally', 'Walter', 'Wazzie', 'Weasley',
        'Wheatley', 'Whïsker Dü', 'Whisky', 'Whisp', 'Wiley', 'William Catner', 'Willis', 'Willy', 'Wilson', 'Xaiotato',
        'Yang', 'Yik', 'Yin', 'Yoda', 'Zappacatsa', 'Zef', 'Zelda', 'Zephy', 'Zeppelin', 'Zippy'
    ];
    return catNames[Math.floor(Math.random() * catNames.length)];
}

async function createMutatedCatComposite(mutatedCanvas, mutationClass) {
    const mutatedResult = document.getElementById('mutatedResult');
    
    const bodyFileName = `${mutationClass.name.toLowerCase()}body.png`;
    
    const catBodyImg = new Image();
    catBodyImg.onload = async function() {
        const compositeCanvas = document.createElement('canvas');
        const compositeCtx = compositeCanvas.getContext('2d');
        
        compositeCanvas.width = catBodyImg.width;
        compositeCanvas.height = catBodyImg.height;
        
        compositeCtx.fillStyle = '#2d2d2d';
        compositeCtx.fillRect(0, 0, compositeCanvas.width, compositeCanvas.height);
        
        const groundCircleRadius = catBodyImg.width * 1.2;
        const groundCircleY = catBodyImg.height * 0.95;
        compositeCtx.fillStyle = '#4c4c4c';
        compositeCtx.beginPath();
        compositeCtx.ellipse(compositeCanvas.width / 2, groundCircleY, groundCircleRadius, groundCircleRadius * 0.25, 0, 0, Math.PI * 2);
        compositeCtx.fill();
        
        const shadowWidth = catBodyImg.width * 0.2244; // 20% bigger (0.187 * 1.2)
        const shadowHeight = catBodyImg.height * 0.0768; // 20% bigger (0.064 * 1.2)
        const shadowY = catBodyImg.height * 0.88;
        compositeCtx.fillStyle = '#414141';
        compositeCtx.beginPath();
        compositeCtx.ellipse(compositeCanvas.width / 2, shadowY, shadowWidth, shadowHeight, 0, 0, Math.PI * 2);
        compositeCtx.fill();
        
        compositeCtx.drawImage(catBodyImg, 0, 0);
        
        const cropSize = Math.min(mutatedCanvas.width, mutatedCanvas.height);
        const cropX = (mutatedCanvas.width - cropSize) / 2;
        const cropY = (mutatedCanvas.height - cropSize) / 2;
        
        const circleSize = Math.min(catBodyImg.width * 0.368, catBodyImg.height * 0.368);
        const circleX = (catBodyImg.width - circleSize) / 2 - circleSize * 0.4;
        const circleY = catBodyImg.height * 0.35;
        
        compositeCtx.save();
        
        compositeCtx.beginPath();
        compositeCtx.arc(circleX + circleSize/2, circleY + circleSize/2, circleSize/2, 0, Math.PI * 2);
        compositeCtx.clip();
        
        compositeCtx.drawImage(
            mutatedCanvas,
            cropX, cropY, cropSize, cropSize,
            circleX, circleY, circleSize, circleSize
        );
        
        compositeCtx.restore();
        
        compositeCtx.strokeStyle = '#000000';
        compositeCtx.lineWidth = 38.98;
        compositeCtx.beginPath();
        compositeCtx.arc(circleX + circleSize/2, circleY + circleSize/2, circleSize/2, 0, Math.PI * 2);
        compositeCtx.stroke();
        
        if (catFaceEnabled) {
            await drawCatFaceFeatures(compositeCtx, circleX, circleY, circleSize, mutationClass);
        }
        
        const resultImg = document.createElement('img');
        resultImg.src = compositeCanvas.toDataURL();
        resultImg.style.maxWidth = '100%';
        resultImg.style.height = 'auto';
        resultImg.style.borderRadius = '10px';
        resultImg.style.display = 'block';
        resultImg.style.margin = '0';
        resultImg.style.padding = '0';
        
        window.mutatedImageDataUrl = compositeCanvas.toDataURL();
        
        mutatedResult.innerHTML = '';
        
        const catName = generateRandomCatName();
        const baseCatStats = generateCatStats();
        
        const catStats = [...baseCatStats];
        
        switch(mutationClass.name) {
            case 'Mage':
                catStats[3] += 2;
                catStats[5] += 2;
                catStats[2] -= 1;
                catStats[0] -= 1;
                break;
            case 'Fighter':
                catStats[0] += 2;
                catStats[4] += 1;
                catStats[3] -= 1;
                break;
            case 'Ranger':
                catStats[1] += 3;
                catStats[6] += 2;
                catStats[2] -= 1;
                catStats[4] -= 2;
                break;
            case 'Tank':
                catStats[2] += 4;
                catStats[3] -= 1;
                catStats[1] -= 1;
                break;
            case 'Thief':
                catStats[4] += 4;
                catStats[6] += 1;
                catStats[0] -= 1;
                catStats[2] -= 1;
                break;
            case 'Cleric':
                catStats[2] += 1;
                catStats[3] += 2;
                catStats[5] += 3;
                break;
        }
        
        for(let i = 0; i < catStats.length; i++) {
            catStats[i] = Math.max(1, Math.min(7, catStats[i]));
        }
        
        const textColor = mutationClass.name === 'Cleric' ? '#444444' : mutationClass.color;
        const description = document.createElement('div');
        description.className = 'mutation-description';
        description.innerHTML = `<p style="margin: 0; padding: 0;">Your cat has been mew-tated into the <span style="color: ${textColor}; font-weight: bold;">${mutationClass.name}</span> class!</p>`;
        description.style.position = 'absolute';
        description.style.top = '-1px';
        description.style.left = '0';
        description.style.right = '0';
        description.style.width = '100%';
        description.style.zIndex = '10';
        description.style.backgroundColor = '#f1f1f1';
        description.style.padding = '8px 20px';
        description.style.borderRadius = '10px 10px 0 0';
        description.style.textAlign = 'center';
        description.style.boxSizing = 'border-box';
        description.style.margin = '0';
        description.style.lineHeight = '1';
        
        const container = document.createElement('div');
        container.style.position = 'relative';
        container.style.display = 'inline-block';
        container.style.margin = '0';
        container.style.padding = '0';
        container.style.lineHeight = '0';
        
        container.appendChild(resultImg);
        container.appendChild(description);
        
        const catNameDiv = document.createElement('div');
        catNameDiv.className = 'cat-name';
        catNameDiv.innerHTML = `<p style="margin: 10px 0 5px 0; font-size: 1.1em; font-weight: bold; color: #333; text-align: center;">${catName}</p>`;
        
        const rerollBtn = document.createElement('button');
        rerollBtn.innerHTML = '<img src="assets/images/d6.png" alt="" style="width: 20px; height: 20px;">';
        rerollBtn.className = 'reroll-btn';
        rerollBtn.style.cssText = 'background: #4a4a4a; color: white; border: none; padding: 8px; border-radius: 5px; font-family: "Manline Slabs", serif; cursor: pointer; margin-left: 10px; display: inline-flex; align-items: center;';
        rerollBtn.onclick = () => {
            const newCatName = generateRandomCatName();
            catNameSpan.innerHTML = newCatName;
        };
        
        const faceToggleBtn = document.createElement('button');
        faceToggleBtn.id = 'faceToggleBtn';
        faceToggleBtn.innerHTML = '<img src="assets/images/catfacetoggle.png" alt="" style="width: 20px; height: 20px;">';
        faceToggleBtn.className = 'face-toggle-btn';
        faceToggleBtn.style.cssText = `background: ${catFaceEnabled ? '#4CAF50' : '#f44336'}; color: white; border: none; padding: 8px; border-radius: 5px; font-family: "Manline Slabs", serif; cursor: pointer; margin-left: 5px; display: inline-flex; align-items: center;`;
        faceToggleBtn.onclick = toggleCatFace;
        
        mutatedResult.appendChild(container);
        
        const nameRerollContainer = document.createElement('div');
        nameRerollContainer.style.cssText = `display: flex; align-items: center; justify-content: center; margin-bottom: 0; padding: 15px 20px; border-radius: 8px 8px 0 0; width: calc(100% - 20px); box-sizing: border-box; margin: 10px auto 0 auto; background-color: #dbdbd8;`;
        
        const catNameSpan = document.createElement('span');
        catNameSpan.innerHTML = catName;
        catNameSpan.style.cssText = 'font-size: 1.1em; font-weight: bold; color: #333; font-family: "Manline Slabs", serif;';
        
        nameRerollContainer.appendChild(catNameSpan);
        nameRerollContainer.appendChild(rerollBtn);
        nameRerollContainer.appendChild(faceToggleBtn);
        mutatedResult.appendChild(nameRerollContainer);
        
        const gameStatsContainer = document.createElement('div');
        
        const catGender = Math.random() < 0.5 ? 'male' : 'female';
        
        const canvas = document.createElement('canvas');
        canvas.width = 400;
        canvas.height = 200;
        const ctx = canvas.getContext('2d');
        
        ctx.fillStyle = '#dbdbd8';
        ctx.fillRect(0, 0, 400, 200);
        
        const noiseDataUrl = canvas.toDataURL();
        gameStatsContainer.style.cssText = `background-color: #dbdbd8; border-radius: 0 0 8px 8px; padding: 15px; margin: 0 auto 10px auto; width: calc(100% - 20px); box-sizing: border-box; position: relative;`;
        
        const genderIcon = document.createElement('img');
        genderIcon.src = `assets/images/${catGender}icon.png`;
        genderIcon.style.cssText = 'position: absolute; top: 10px; right: 60px; width: 52px; height: 52px; z-index: 10;';
        genderIcon.alt = catGender;
        gameStatsContainer.appendChild(genderIcon);
        
        const collarImg = document.createElement('img');
        const collarName = mutationClass.name.toLowerCase() + 'collar.png';
        collarImg.src = `assets/images/${collarName}`;
        collarImg.style.cssText = 'position: absolute; top: 10px; right: 10px; width: 40px; height: 40px; z-index: 10;';
        collarImg.alt = `${mutationClass.name} collar`;
        gameStatsContainer.appendChild(collarImg);
        
        const hpLevelContainer = document.createElement('div');
        const hp = catStats[2] * 4;
        const level = Math.floor(Math.random() * 4);
        hpLevelContainer.style.cssText = 'display: flex; justify-content: center; align-items: center; gap: 15px; margin-bottom: 15px; font-weight: bold; color: #333;';
        
        const hpDisplay = document.createElement('span');
        hpDisplay.textContent = `HP: ${hp}`;
        hpDisplay.style.cssText = 'font-size: 20px; font-family: "Manline Slabs", serif;';
        
        const divider = document.createElement('span');
        divider.textContent = '|';
        divider.style.cssText = 'font-size: 22px; color: #666; font-family: "Manline Slabs", serif;';
        
        const levelDisplay = document.createElement('span');
        levelDisplay.textContent = `LV. ${level}`;
        levelDisplay.style.cssText = 'font-size: 20px; font-family: "Manline Slabs", serif;';
        
        hpLevelContainer.appendChild(hpDisplay);
        hpLevelContainer.appendChild(divider);
        hpLevelContainer.appendChild(levelDisplay);
        gameStatsContainer.appendChild(hpLevelContainer);
        
        const statsContainer = document.createElement('div');
        statsContainer.style.cssText = 'display: flex; justify-content: center; align-items: center; gap: 8px; flex-wrap: wrap;';
        
        const statImages = ['strength.png', 'dexterity.png', 'constitution.png', 'intelligence.png', 'speed.png', 'charisma.png', 'luck.png'];
        
        catStats.forEach((statValue, index) => {
            const statDiv = document.createElement('div');
            statDiv.style.cssText = 'display: flex; flex-direction: column; align-items: center; margin: 0 2px;';
            
            const statImage = document.createElement('img');
            statImage.src = `assets/images/${statImages[index]}`;
            statImage.style.cssText = 'width: 24px; height: 24px; margin-bottom: 2px;';
            statImage.alt = statImages[index].replace('.png', '');
            
            let circleColor = '#afafad';
            if (statValue < 4) {
                const intensity = Math.floor((4 - statValue) * 50);
                circleColor = `rgb(${255 - intensity}, ${255 - intensity * 1.2}, ${255 - intensity * 1.2})`;
            } else if (statValue > 4) {
                const intensity = Math.floor((statValue - 4) * 40);
                circleColor = `rgb(${255 - intensity * 1.2}, ${255 - intensity * 0.5}, ${255 - intensity * 1.2})`;
            }
            
            const statCircle = document.createElement('div');
            statCircle.style.cssText = `width: 45px; height: 45px; border-radius: 50%; background-color: ${circleColor}; display: flex; align-items: center; justify-content: center; font-weight: bold; color: #333; font-size: 16px; font-family: "Manline Slabs", serif;`;
            statCircle.textContent = statValue;
            
            statDiv.appendChild(statImage);
            statDiv.appendChild(statCircle);
            statsContainer.appendChild(statDiv);
        });
        
        gameStatsContainer.appendChild(statsContainer);
        mutatedResult.appendChild(gameStatsContainer);
    };
    
    catBodyImg.src = `assets/images/${bodyFileName}`;
}

function simulateMutation() {
    const mutatedResult = document.getElementById('mutatedResult');
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = function() {
        canvas.width = img.width;
        canvas.height = img.height;
        
        ctx.drawImage(img, 0, 0);
        
        const effects = [
            () => applyColorFilter(ctx, canvas),
            () => applyDistortion(ctx, canvas),
            () => applyGlitch(ctx, canvas)
        ];
        
        const randomEffect = effects[Math.floor(Math.random() * effects.length)];
        randomEffect();
        
        const mutatedImg = document.createElement('img');
        mutatedImg.src = canvas.toDataURL();
        mutatedImg.className = 'mutation-result';
        mutatedImg.alt = 'Mutated cat';
        
        mutatedResult.innerHTML = '';
        mutatedResult.appendChild(mutatedImg);
    };
    
    img.src = originalImageDataUrl;
}

function applyColorFilter(ctx, canvas) {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.min(255, data[i] * (0.5 + Math.random()));
        data[i + 1] = Math.min(255, data[i + 1] * (0.5 + Math.random()));
        data[i + 2] = Math.min(255, data[i + 2] * (0.5 + Math.random()));
    }
    
    ctx.putImageData(imageData, 0, 0);
}

function applyDistortion(ctx, canvas) {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    ctx.save();
    
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(1 + (Math.random() - 0.5) * 0.3, 1 + (Math.random() - 0.5) * 0.3);
    ctx.rotate((Math.random() - 0.5) * 0.2);
    ctx.translate(-canvas.width / 2, -canvas.height / 2);
    
    ctx.putImageData(imageData, 0, 0);
    ctx.restore();
}

function applyGlitch(ctx, canvas) {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    for (let i = 0; i < 10; i++) {
        const y = Math.random() * canvas.height;
        const height = 5 + Math.random() * 20;
        const offset = (Math.random() - 0.5) * 50;
        
        const sliceData = ctx.getImageData(0, y, canvas.width, height);
        ctx.putImageData(sliceData, offset, y);
    }
}

function downloadResult() {
    const downloadBtn = document.getElementById('downloadBtn');
    if (!downloadBtn || downloadBtn.style.display === 'none') {
        alert('Please mutate a cat first before downloading!');
        return;
    }
    
    const mutatedResult = document.getElementById('mutatedResult');
    const catCanvas = mutatedResult.querySelector('canvas');
    
    if (!catCanvas) {
        alert('Mutation data not found. Please try mutating again!');
        return;
    }

    const catName = document.querySelector('span[style*="font-family"][style*="Manline Slabs"]');
    const hpDisplay = document.querySelector('span[style*="font-size: 20px"]');
    const levelDisplay = document.querySelectorAll('span[style*="font-size: 20px"]')[1];
    const statCircles = document.querySelectorAll('div[style*="border-radius: 50%"]');
    const collarImg = document.querySelector('img[alt*="collar"]');
    
    try {
        const downloadCanvas = document.createElement('canvas');
        const ctx = downloadCanvas.getContext('2d');
        
        downloadCanvas.width = 400;
        downloadCanvas.height = 650;
        
        const gradient = ctx.createLinearGradient(0, 0, 0, downloadCanvas.height);
        gradient.addColorStop(0, '#3d3d3d');
        gradient.addColorStop(1, '#1d1d1d');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, downloadCanvas.width, downloadCanvas.height);
        
        const catImgWidth = 320;
        const catImgHeight = 240;
        const catX = (downloadCanvas.width - catImgWidth) / 2;
        const catY = 30;
        
        ctx.drawImage(catCanvas, catX, catY, catImgWidth, catImgHeight);
        
        const statsY = catY + catImgHeight + 20;
        const statsHeight = 280;
        ctx.fillStyle = '#dbdbd8';
        ctx.fillRect(30, statsY, downloadCanvas.width - 60, statsHeight);
        
        for (let i = 0; i < 20; i++) {
            const x = 30 + Math.random() * (downloadCanvas.width - 60);
            const y = statsY + Math.random() * statsHeight;
            const size = 2 + Math.random() * 6;
            const alpha = 0.1 + Math.random() * 0.1;
            
            ctx.fillStyle = Math.random() > 0.5 ? `rgba(200, 200, 196, ${alpha})` : `rgba(230, 230, 226, ${alpha})`;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
        }
        
        if (collarImg && collarImg.complete && collarImg.naturalWidth > 0) {
            ctx.drawImage(collarImg, downloadCanvas.width - 80, statsY + 15, 35, 35);
        }
        
        const nameText = catName ? catName.textContent : 'Mystery Cat';
        ctx.fillStyle = '#333';
        ctx.font = 'bold 28px serif';
        ctx.textAlign = 'center';
        ctx.fillText(nameText, downloadCanvas.width / 2, statsY + 50);
        
        const hpText = hpDisplay ? hpDisplay.textContent : 'HP: ?';
        const levelText = levelDisplay ? levelDisplay.textContent : 'LV. ?';
        ctx.font = 'bold 20px serif';
        ctx.fillText(`${hpText} | ${levelText}`, downloadCanvas.width / 2, statsY + 85);
        
        const statIcons = ['💪', '🏃', '🛡️', '🎯', '🧠', '😊', '🍀'];
        const statsStartY = statsY + 130;
        const statSpacing = 42;
        const startX = 70;
        
        for (let i = 0; i < 7; i++) {
            const x = startX + (i * statSpacing);
            
            const statCircle = statCircles[i];
            const statValue = statCircle ? parseInt(statCircle.textContent) || 4 : 4;
            
            ctx.font = '18px serif';
            ctx.fillText(statIcons[i], x, statsStartY);
            
            let circleColor = '#afafad';
            if (statValue < 4) {
                const intensity = Math.floor((4 - statValue) * 50);
                circleColor = `rgb(${255 - intensity}, ${Math.floor(255 - intensity * 1.2)}, ${Math.floor(255 - intensity * 1.2)})`;
            } else if (statValue > 4) {
                const intensity = Math.floor((statValue - 4) * 40);
                circleColor = `rgb(${Math.floor(255 - intensity * 1.2)}, ${Math.floor(255 - intensity * 0.5)}, ${Math.floor(255 - intensity * 1.2)})`;
            }
            
            ctx.fillStyle = circleColor;
            ctx.beginPath();
            ctx.arc(x, statsStartY + 40, 18, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = '#333';
            ctx.font = 'bold 16px serif';
            ctx.fillText(statValue.toString(), x, statsStartY + 45);
        }
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '12px serif';
        ctx.textAlign = 'center';
        ctx.fillText('mutateyourcat.com', downloadCanvas.width / 2, downloadCanvas.height - 20);
        
        downloadCanvas.toBlob(function(blob) {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            const safeName = nameText.replace(/[^a-zA-Z0-9]/g, '_');
            link.download = `${safeName}_mutated_cat.png`;
            link.href = url;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 'image/png');
        
    } catch (error) {
        console.error('Download failed:', error);
        alert('Download failed. Please try again!');
    }
}

function resetUpload() {
    const uploadArea = document.getElementById('uploadArea');
    const previewSection = document.getElementById('previewSection');
    const fileInput = document.getElementById('fileInput');
    
    originalImageFile = null;
    originalImageDataUrl = null;
    mutationComplete = false;
    currentMutationData = null;
    
    uploadArea.style.display = 'block';
    previewSection.style.display = 'none';
    fileInput.value = '';
    
    const mutateBtn = document.getElementById('mutateBtn');
    mutateBtn.innerHTML = '<img src="assets/images/mewgenicspaw.png" alt="" class="btn-icon"> MUTATE';
    mutateBtn.disabled = false;
}

function showNotification(message, type = 'info') {
    alert(message);
}

async function drawCatFaceFeatures(ctx, headX, headY, headSize, mutationClass) {
    const centerX = headX + headSize / 2;
    const centerY = headY + headSize / 2;
    const scale = headSize / 200; // Base scale for features
    
    // Draw class-specific ears
    const earsImg = new Image();
    const earsPromise = new Promise((resolve) => {
        earsImg.onload = resolve;
        earsImg.onerror = resolve; // Continue even if ears don't load
    });
    
    // Use class-specific ears
    const earsFileName = `${mutationClass.name.toLowerCase()}ears.png`;
    earsImg.src = `assets/images/${earsFileName}`;
    await earsPromise;
    
    if (earsImg.complete && earsImg.naturalWidth !== 0) {
        const earsWidth = headSize * 1.2;
        const earsHeight = (earsImg.naturalHeight / earsImg.naturalWidth) * earsWidth;
        const earsX = headX - (earsWidth - headSize) / 2;
        const earsY = headY - earsHeight * 0.8; // Position ears much higher at top of head
        
        ctx.drawImage(earsImg, earsX, earsY, earsWidth, earsHeight);
    }
    
    // Draw random eyes (eyes1.png to eyes5.png)
    const eyesImg = new Image();
    const eyesPromise = new Promise((resolve) => {
        eyesImg.onload = resolve;
        eyesImg.onerror = resolve; // Continue even if eyes don't load
    });
    
    const eyesNumber = Math.floor(Math.random() * 10) + 1; // Random 1-10
    const eyesFileName = `eyes${eyesNumber}.png`;
    eyesImg.src = `assets/images/${eyesFileName}`;
    await eyesPromise;
    
    if (eyesImg.complete && eyesImg.naturalWidth !== 0) {
        const eyesWidth = headSize * 1.2; // 50% bigger (was 0.8, now 1.2)
        const eyesHeight = (eyesImg.naturalHeight / eyesImg.naturalWidth) * eyesWidth;
        const eyesX = centerX - eyesWidth / 2 - headSize * 0.2; // Shifted 20% left
        const eyesY = centerY - eyesHeight / 2 - headSize * 0.1; // Slightly higher
        
        ctx.drawImage(eyesImg, eyesX, eyesY, eyesWidth, eyesHeight);
    } else {
        // Fallback: Draw simple eyes if image doesn't load
        const eyeSize = headSize * 0.08;
        const eyeY = centerY - headSize * 0.1;
        const eyeOffsetX = headSize * 0.15;
        
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(centerX - eyeOffsetX, eyeY, eyeSize, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(centerX + eyeOffsetX, eyeY, eyeSize, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Draw random mouth (mouth1.png to mouth5.png)
    const mouthImg = new Image();
    const mouthPromise = new Promise((resolve) => {
        mouthImg.onload = resolve;
        mouthImg.onerror = resolve; // Continue even if mouth doesn't load
    });
    
    const mouthNumber = Math.floor(Math.random() * 10) + 1; // Random 1-10
    const mouthFileName = `mouth${mouthNumber}.png`;
    mouthImg.src = `assets/images/${mouthFileName}`;
    await mouthPromise;
    
    if (mouthImg.complete && mouthImg.naturalWidth !== 0) {
        const mouthWidth = headSize * 0.8; // Same size as eyes
        const mouthHeight = (mouthImg.naturalHeight / mouthImg.naturalWidth) * mouthWidth;
        const mouthX = centerX - mouthWidth / 2 - headSize * 0.2; // Shifted 20% left
        const mouthY = centerY - headSize * 0.3; // 10% higher (was -0.225, now -0.3)
        
        ctx.drawImage(mouthImg, mouthX, mouthY, mouthWidth, mouthHeight);
    } else {
        // Fallback: Draw simple mouth if image doesn't load
        const mouthY = centerY + headSize * 0.15;
        const mouthWidth = headSize * 0.12;
        
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = headSize * 0.015;
        
        // Cat mouth (inverted Y shape)
        ctx.beginPath();
        ctx.moveTo(centerX, mouthY - headSize * 0.02);
        ctx.lineTo(centerX - mouthWidth / 2, mouthY + headSize * 0.02);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(centerX, mouthY - headSize * 0.02);
        ctx.lineTo(centerX + mouthWidth / 2, mouthY + headSize * 0.02);
        ctx.stroke();
    }
}
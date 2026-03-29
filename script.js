/**
 * ZIMRI & SHAWN WEDDING WEBSITE
 * Interactive Features & Camera Functionality
 */

// ============================================
// GLOBAL STATE
// ============================================
const state = {
    photos: [],
    currentPage: 1,
    photosPerPage: 8,
    currentStream: null,
    facingMode: 'environment',
    lightboxIndex: 0,
    weddingDate: new Date('2026-09-10T16:30:00'),
    guestId: localStorage.getItem('weddingGuestId') || generateGuestId(),
    // Guests should only be able to take photos after 16:30 South African time (Africa/Johannesburg).
    // In September South Africa is UTC+2, so 16:30 SAST == 14:30 UTC.
    cameraLiveAtUtcMs: Date.UTC(2026, 8, 10, 14, 30, 0)
};

const SUPABASE_URL = 'https://uptwmlulayrbcopdenwz.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_eZ9UCeemQyP67lsBNkzfBQ_GpzwkYan';
const supabaseClient = window.supabase?.createClient
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
    : null;

// Generate unique guest ID for tracking photos
function generateGuestId() {
    const id = 'guest_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('weddingGuestId', id);
    return id;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================
function $(selector) {
    return document.querySelector(selector);
}

function $$(selector) {
    return document.querySelectorAll(selector);
}

function showToast(message, type = 'success') {
    const toast = $('#toast');
    toast.querySelector('.toast-message').textContent = message;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function canTakePhotosNow() {
    return Date.now() >= state.cameraLiveAtUtcMs;
}

function canTakePhotosHere() {
    return true;
}

async function sendNotificationEmail(type, payload) {
    try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/send-notification-email`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                apikey: SUPABASE_PUBLISHABLE_KEY,
                Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`
            },
            body: JSON.stringify({ type, payload })
        });

        if (!res.ok) {
            const err = await res.text();
            console.error(`Notification email failed (${type}):`, err);
            return false;
        }

        return true;
    } catch (error) {
        console.error(`Notification email error (${type}):`, error);
        return false;
    }
}

function dataURItoBlob(dataURI) {
    const byteString = atob(dataURI.split(',')[1]);
    const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);

    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }

    return new Blob([ab], { type: mimeString });
}

// ============================================
// COUNTDOWN TIMER
// ============================================
function updateCountdown() {
    const now = new Date();
    const diff = state.weddingDate - now;
    
    if (diff <= 0) {
        $('#days').textContent = '00';
        $('#hours').textContent = '00';
        $('#minutes').textContent = '00';
        $('#seconds').textContent = '00';
        return;
    }
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    const daysEl = $('#days');
    const hoursEl = $('#hours');
    const minutesEl = $('#minutes');
    const secondsEl = $('#seconds');
    if (!daysEl || !hoursEl || !minutesEl || !secondsEl) return;

    daysEl.textContent = days.toString().padStart(3, '0');
    hoursEl.textContent = hours.toString().padStart(2, '0');
    minutesEl.textContent = minutes.toString().padStart(2, '0');
    secondsEl.textContent = seconds.toString().padStart(2, '0');
}

// ============================================
// CAMERA FUNCTIONALITY
// ============================================
const camera = {
    video: $('#cameraVideo'),
    canvas: $('#cameraCanvas'),
    shutterBtn: $('#shutterBtn'),
    enableBtn: $('#enableCameraBtn'),
    permissionDiv: $('#cameraPermission'),
    fallbackDiv: $('#cameraFallback'),
    flash: $('#flashEffect'),
    preview: $('#photoPreview'),
    previewImg: $('#previewImage'),
    saveBtn: $('#saveBtn'),
    discardBtn: $('#discardBtn'),
    toggleBtn: $('#cameraToggle'),
    uploadBtn: $('#uploadBtn'),
    uploadInput: $('#photoUpload'),
    realtimeChannel: null,
    wasCameraLive: false,
    
    init() {
        this.loadSavedShots();
        this.bindEvents();
        this.loadPhotosFromStorage();
        this.updateCameraAvailability();
        // Keep the camera gate in sync if the page stays open past 16:30 SAST.
        setInterval(() => this.updateCameraAvailability(), 15000);
        // Start realtime updates after the initial fetch attempt.
        this.fetchPhotosFromSupabase().finally(() => this.startRealtimeUpdates());
    },
    
    bindEvents() {
        this.enableBtn?.addEventListener('click', () => {
            if (!canTakePhotosNow()) {
                showToast('Camera is locked until after 16:30 SAST (South Africa time).');
                return;
            }
            this.start();
        });
        this.shutterBtn?.addEventListener('click', () => this.takePhoto());
        this.discardBtn?.addEventListener('click', () => this.discardPhoto());
        this.saveBtn?.addEventListener('click', () => this.savePhoto());
        this.toggleBtn?.addEventListener('click', () => this.toggleCamera());
    },
    
    loadSavedShots() {
        this.updateShotsDisplay();
    },
    
    updateShotsDisplay() {
        const shotsCount = $('#shotsCount');
        const photoCounter = $('#photoCounter');
        
        const total = state.photos.length;
        if (shotsCount) shotsCount.textContent = total;
        if (photoCounter) photoCounter.textContent = `${total} photos captured`;
        
        if (this.shutterBtn) {
            this.shutterBtn.disabled = !(canTakePhotosNow() && canTakePhotosHere());
        }
    },
    
    updateCameraAvailability() {
        const live = canTakePhotosNow();
        
        // Keep the button clickable so guests get feedback (instead of "nothing happens").
        if (this.enableBtn) {
            this.enableBtn.disabled = false;
            this.enableBtn.title = live
                ? ''
                : 'Camera will go live at 4:30 PM on 10 September (South Africa time).';
        }
        if (this.shutterBtn) this.shutterBtn.disabled = !(live && canTakePhotosHere());
        if (live && !this.wasCameraLive) {
            this.wasCameraLive = true;
            showToast('Camera is now live! Take photos.');
            this.updateShotsDisplay();
        }

        const gateEl = $('#cameraLiveGate');
        if (gateEl) {
            if (live) {
                gateEl.style.display = 'none';
            } else {
                gateEl.style.display = 'block';
                gateEl.innerHTML = 'Camera will go live at <strong>4:30 PM</strong> on <strong>10 September</strong>.';
            }
        }
    },
    
    async start() {
        if (!canTakePhotosNow()) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { 
                    facingMode: state.facingMode,
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                },
                audio: false
            });
            
            state.currentStream = stream;
            this.video.srcObject = stream;
            this.permissionDiv.style.display = 'none';
            this.shutterBtn.disabled = false;
            
        } catch (err) {
            console.error('Camera access denied:', err);
            this.showFallback();
        }
    },
    
    showFallback() {
        this.permissionDiv.style.display = 'none';
        this.fallbackDiv.style.display = 'flex';
    },
    
    takePhoto() {
        if (!canTakePhotosNow()) {
            showToast('Camera is not live yet.');
            return;
        }
        // Flash effect
        this.flash.classList.add('active');
        setTimeout(() => this.flash.classList.remove('active'), 150);
        
        // Capture photo with basic downscaling for smaller file size
        const srcWidth = this.video.videoWidth || 1280;
        const srcHeight = this.video.videoHeight || 720;
        const maxDim = 1600; // max width/height to keep images lighter
        let targetWidth = srcWidth;
        let targetHeight = srcHeight;
        if (Math.max(srcWidth, srcHeight) > maxDim) {
            const scale = maxDim / Math.max(srcWidth, srcHeight);
            targetWidth = Math.round(srcWidth * scale);
            targetHeight = Math.round(srcHeight * scale);
        }
        
        this.canvas.width = targetWidth;
        this.canvas.height = targetHeight;
        const ctx = this.canvas.getContext('2d');
        ctx.drawImage(this.video, 0, 0, targetWidth, targetHeight);
        
        // Show preview
        this.previewImg.src = this.canvas.toDataURL('image/jpeg', 0.75);
        this.preview.classList.add('active');
    },
    
    discardPhoto() {
        this.preview.classList.remove('active');
        this.previewImg.src = '';
    },
    
    async savePhoto() {
        if (!canTakePhotosNow()) {
            showToast('Camera is not live yet.');
            return;
        }
        const photoData = {
            id: Date.now(),
            src: this.previewImg.src,
            timestamp: new Date().toISOString(),
            guestId: state.guestId,
            // Supabase-ready fields
            created_at: new Date().toISOString(),
            guest_id: state.guestId,
            photo_url: null, // Will be populated when uploaded to Supabase
            is_synced: false
        };
        
        // Add to state
        state.photos.unshift(photoData);

        // Optimistic UI update
        this.updateShotsDisplay();
        gallery.render();
        this.discardPhoto();

        if (supabaseClient) {
            try {
                const fileName = `${state.guestId}/${photoData.id}.jpg`;
                const photoBlob = dataURItoBlob(photoData.src);

                const { error: uploadError } = await supabaseClient.storage
                    .from('wedding-photos')
                    .upload(fileName, photoBlob, {
                        contentType: 'image/jpeg',
                        upsert: false
                    });

                if (uploadError) throw uploadError;

                const { data: publicData } = supabaseClient.storage
                    .from('wedding-photos')
                    .getPublicUrl(fileName);

                const publicUrl = publicData?.publicUrl;
                if (!publicUrl) {
                    throw new Error('Unable to get public URL for uploaded photo.');
                }

                const { error: insertError } = await supabaseClient
                    .from('photos')
                    .insert([{
                        guest_id: photoData.guestId,
                        photo_url: publicUrl,
                        created_at: photoData.timestamp
                    }]);

                if (insertError) throw insertError;

                photoData.src = publicUrl;
                photoData.photo_url = publicUrl;
                photoData.is_synced = true;
                this.savePhotosToStorage();
                gallery.render();
                showToast(`Photo saved! ${state.photos.length} photos captured so far`);
            } catch (err) {
                console.error('Supabase photo sync error:', err);
                this.savePhotosToStorage();
                showToast('Photo saved locally. Sync will retry when online.');
            }
        } else {
            this.savePhotosToStorage();
            showToast(`Photo saved! ${state.photos.length} photos captured so far`);
        }

        $('#live-gallery').scrollIntoView({ behavior: 'smooth' });
    },
    
    async toggleCamera() {
        if (!canTakePhotosNow()) return;
        state.facingMode = state.facingMode === 'environment' ? 'user' : 'environment';
        
        if (state.currentStream) {
            state.currentStream.getTracks().forEach(track => track.stop());
        }
        
        await this.start();
    },
    
    handleUpload(e) {
        // Uploads intentionally disabled for this event
        if (e?.target) {
            e.target.value = '';
        }
        showToast('Photo uploads are disabled for this wedding.');
    },
    
    savePhotosToStorage() {
        // Store only essential data to avoid localStorage limits
        const storageData = state.photos.map(p => ({
            id: p.id,
            src: p.src,
            timestamp: p.timestamp,
            guestId: p.guestId,
            is_synced: p.is_synced
        }));
        
        try {
            localStorage.setItem('weddingPhotos', JSON.stringify(storageData));
        } catch (e) {
            console.warn('localStorage full, keeping recent photos only');
            // Keep only recent 20 photos if storage is full
            const recent = storageData.slice(0, 20);
            localStorage.setItem('weddingPhotos', JSON.stringify(recent));
        }
    },
    
    loadPhotosFromStorage() {
        const saved = localStorage.getItem('weddingPhotos');
        if (saved) {
            try {
                state.photos = JSON.parse(saved);
                gallery.render();
                this.updateShotsDisplay();
            } catch (e) {
                console.error('Error loading photos:', e);
            }
        }
    },

    async fetchPhotosFromSupabase() {
        if (!supabaseClient) return;

        try {
            const { data, error } = await supabaseClient
                .from('photos')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            const knownUrls = new Set(
                state.photos
                    .map((p) => p.photo_url || p.src)
                    .filter((url) => typeof url === 'string' && url.startsWith('http'))
            );

            (data || []).forEach((photo) => {
                if (!knownUrls.has(photo.photo_url)) {
                    state.photos.push({
                        id: photo.id,
                        src: photo.photo_url,
                        timestamp: photo.created_at,
                        guestId: photo.guest_id,
                        photo_url: photo.photo_url,
                        is_synced: true
                    });
                }
            });

            state.photos.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            this.savePhotosToStorage();
            gallery.render();
            this.updateShotsDisplay();
        } catch (err) {
            console.error('Failed to fetch Supabase photos:', err);
        }
    },

    startRealtimeUpdates() {
        if (!supabaseClient) return;
        if (this.realtimeChannel) return; // prevent duplicate subscriptions

        // Supabase Realtime: notify clients when new rows are inserted.
        this.realtimeChannel = supabaseClient
            .channel('wedding-guest-photos')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'photos' },
                (payload) => {
                    const photo = payload?.new;
                    if (!photo) return;

                    const newId = photo.id;
                    const newUrl = photo.photo_url;
                    if (typeof newUrl !== 'string' || !newUrl) return;
                    const createdAt = photo.created_at || new Date().toISOString();

                    // Dedupe to avoid duplicate entries from optimistic UI + fetch + realtime.
                    const alreadyExists = state.photos.some((p) => {
                        if (newId != null && p.id === newId) return true;
                        if (typeof newUrl === 'string' && newUrl && p.photo_url === newUrl) return true;
                        return false;
                    });
                    if (alreadyExists) return;

                    state.photos.push({
                        id: newId ?? photo.created_at ?? Date.now(),
                        src: newUrl,
                        timestamp: createdAt,
                        guestId: photo.guest_id,
                        photo_url: newUrl,
                        is_synced: true
                    });

                    state.photos.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                    this.savePhotosToStorage();
                    gallery.render();
                    this.updateShotsDisplay();
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('📡 Realtime photo updates connected');
                } else if (status === 'CHANNEL_ERROR') {
                    console.warn('Realtime photo updates failed to connect');
                }
            });
    },

    stopRealtimeUpdates() {
        if (!this.realtimeChannel) return;
        try {
            this.realtimeChannel.unsubscribe();
        } catch (e) {
            // ignore
        } finally {
            this.realtimeChannel = null;
        }
    }
};

// ============================================
// PHOTO GALLERY
// ============================================
const gallery = {
    container: $('#photoGallery'),
    emptyState: $('#galleryEmpty'),
    pagination: $('#galleryPagination'),
    currentPageEl: $('#currentPage'),
    totalPagesEl: $('#totalPages'),
    prevBtn: $('#prevPage'),
    nextBtn: $('#nextPage'),
    countEl: $('#galleryCount'),
    lightbox: $('#lightbox'),
    lightboxImg: $('#lightboxImage'),
    lightboxClose: $('#lightboxClose'),
    lightboxPrev: $('#lightboxPrev'),
    lightboxNext: $('#lightboxNext'),
    
    init() {
        this.bindEvents();
        this.render();
    },
    
    bindEvents() {
        this.prevBtn?.addEventListener('click', () => this.prevPage());
        this.nextBtn?.addEventListener('click', () => this.nextPage());
        this.lightboxClose?.addEventListener('click', () => this.closeLightbox());
        this.lightboxPrev?.addEventListener('click', () => this.prevImage());
        this.lightboxNext?.addEventListener('click', () => this.nextImage());
        
        document.addEventListener('keydown', (e) => {
            if (!this.lightbox.classList.contains('active')) return;
            if (e.key === 'Escape') this.closeLightbox();
            if (e.key === 'ArrowLeft') this.prevImage();
            if (e.key === 'ArrowRight') this.nextImage();
        });
        
        // Close on background click
        this.lightbox?.addEventListener('click', (e) => {
            if (e.target === this.lightbox) this.closeLightbox();
        });
    },
    
    render() {
        const totalPhotos = state.photos.length;
        
        // Update count
        if (this.countEl) this.countEl.textContent = totalPhotos;
        
        // Show/hide empty state
        if (totalPhotos === 0) {
            this.emptyState.style.display = 'block';
            this.pagination.style.display = 'none';
            return;
        }
        
        this.emptyState.style.display = 'none';
        
        // Calculate pagination
        const totalPages = Math.ceil(totalPhotos / state.photosPerPage);
        state.currentPage = Math.min(state.currentPage, totalPages);
        
        // Get current page photos
        const start = (state.currentPage - 1) * state.photosPerPage;
        const end = start + state.photosPerPage;
        const pagePhotos = state.photos.slice(start, end);
        
        // Render photos
        this.container.innerHTML = '';
        pagePhotos.forEach((photo, index) => {
            const item = document.createElement('div');
            item.className = 'gallery-item';
            item.innerHTML = `
                <img src="${photo.src}" alt="Guest photo" loading="lazy">
                <div class="gallery-item-overlay">
                    ${new Date(photo.timestamp).toLocaleTimeString()}
                </div>
            `;
            item.addEventListener('click', () => this.openLightbox(start + index));
            this.container.appendChild(item);
        });

        // Update pagination
        if (totalPages > 1) {
            this.pagination.style.display = 'flex';
            this.currentPageEl.textContent = state.currentPage;
            this.totalPagesEl.textContent = totalPages;
            this.prevBtn.disabled = state.currentPage === 1;
            this.nextBtn.disabled = state.currentPage === totalPages;
        } else {
            this.pagination.style.display = 'none';
        }
    },
    
    prevPage() {
        if (state.currentPage > 1) {
            state.currentPage--;
            this.render();
        }
    },
    
    nextPage() {
        const totalPages = Math.ceil(state.photos.length / state.photosPerPage);
        if (state.currentPage < totalPages) {
            state.currentPage++;
            this.render();
        }
    },
    
    openLightbox(index) {
        state.lightboxIndex = index;
        this.lightboxImg.src = state.photos[index].src;
        this.lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';
    },
    
    closeLightbox() {
        this.lightbox.classList.remove('active');
        document.body.style.overflow = '';
    },
    
    prevImage() {
        if (state.lightboxIndex > 0) {
            state.lightboxIndex--;
            this.lightboxImg.src = state.photos[state.lightboxIndex].src;
        }
    },
    
    nextImage() {
        if (state.lightboxIndex < state.photos.length - 1) {
            state.lightboxIndex++;
            this.lightboxImg.src = state.photos[state.lightboxIndex].src;
        }
    }
};


// ============================================
// PHOTO CATALOGUE FILTER
// ============================================
function initCatalogueFilter() {
    const buttons = $$('.filter-btn');
    // We keep the filter buttons for future use, but the
    // visual display is now handled by the 3D ring gallery.
    
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active button
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const filter = btn.dataset.filter;
            
            // Filter items
            items.forEach(item => {
                if (filter === 'all' || item.dataset.category === filter) {
                    item.style.display = 'block';
                    item.style.animation = 'fadeIn 0.5s ease';
                } else {
                    item.style.display = 'none';
                }
            });
        });
    });
}

// ============================================
// 3D RING GALLERIES (Photo catalogue & capture)
// ============================================
function initPhotoRing(containerId, options = {}) {
    const container = document.getElementById(containerId);
    if (!container || !window.gsap || !window.Draggable) return;

    const ring = container.querySelector('.photo-ring');
    const dragger = container.querySelector('.photo-ring-dragger');
    const images = container.querySelectorAll('.photo-ring-img');

    if (!ring || !dragger || images.length === 0) return;

    const {
        imageUrls = Array.from({ length: images.length }).map((_, i) =>
            `https://picsum.photos/id/${32 + i}/700/300/`
        )
    } = options;

    let xPos = 0;

    const getBgPos = (i) => {
        const rotation = gsap.getProperty(ring, 'rotationY') || 0;
        return (
            (-gsap.utils.wrap(0, 360, rotation - 180 - i * 36) / 360) * 400 +
            'px 0px'
        );
    };

    gsap
        .timeline()
        .set(dragger, { opacity: 0 })
        .set(ring, { rotationY: 180 })
        .set(images, {
            rotateY: (i) => i * -36,
            transformOrigin: '50% 50% 500px',
            z: -500,
            backgroundImage: (i) =>
                `url(${imageUrls[i % imageUrls.length]})`,
            backgroundPosition: (i) => getBgPos(i),
            backfaceVisibility: 'hidden'
        })
        .from(images, {
            duration: 1.2,
            y: 120,
            opacity: 0,
            stagger: 0.08,
            ease: 'expo.out'
        });

    Draggable.create(dragger, {
        type: 'x',
        onDragStart: (e) => {
            if (e.touches) e.clientX = e.touches[0].clientX;
            xPos = Math.round(e.clientX);
        },
        onDrag: (e) => {
            if (e.touches) e.clientX = e.touches[0].clientX;

            gsap.to(ring, {
                rotationY:
                    '-=' + ((Math.round(e.clientX) - xPos) % 360),
                onUpdate: () => {
                    gsap.set(images, {
                        backgroundPosition: (i) => getBgPos(i)
                    });
                }
            });

            xPos = Math.round(e.clientX);
        },
        onDragEnd: () => {
            gsap.set(dragger, { x: 0, y: 0 });
        }
    });
}

function initPhotoRings() {
    initPhotoRing('catalogueRingContainer');
    initPhotoRing('captureRingContainer');
}


// ============================================
// RSVP FORM
// ============================================
function initRSVP() {
    const form = $('#rsvpForm');
    const success = $('#rsvpSuccess');
    const successMessage = $('#rsvpSuccessMessage');
    const successTitle = $('#rsvpSuccessTitle');
    const successIcon = $('#rsvpSuccessIcon');
    const resetBtn = $('#resetRsvp');
    const attendingRadios = document.querySelectorAll('input[name="attending"]');
    const guestDetails = $('#guestDetails');
    
    // Toggle guest details based on attendance
    attendingRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            if (!guestDetails) return;
            if (radio.value === 'yes' && radio.checked) {
                guestDetails.style.display = 'grid';
            } else if (radio.value === 'no' && radio.checked) {
                guestDetails.style.display = 'none';
            }
        });
    });
    
    form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;
        
        try {
            const formData = new FormData(form);
            const data = Object.fromEntries(formData);
            const songRequestTrimmed = (data.songRequest || '').trim();
            if (!songRequestTrimmed) {
                showToast('Please enter a song request.', 'error');
                if (submitBtn) submitBtn.disabled = false;
                return;
            }
            data.songRequest = songRequestTrimmed;

            // Add timestamp and ID
            data.submittedAt = new Date().toISOString();
            data.id = Date.now().toString();
            
            if (supabaseClient) {
                const { error } = await supabaseClient
                    .from('rsvps')
                    .insert([{
                        first_name: data.firstName,
                        last_name: data.lastName,
                        email: data.email,
                        attending: data.attending,
                        dietary: data.dietary || null,
                        song_request: data.songRequest,
                        message: data.message || null,
                        submitted_at: data.submittedAt
                    }]);

                if (error) {
                    console.error('RSVP Supabase insert failed:', error);
                    const rsvps = JSON.parse(localStorage.getItem('weddingRSVPs') || '[]');
                    rsvps.push(data);
                    localStorage.setItem('weddingRSVPs', JSON.stringify(rsvps));
                }
            } else {
                const rsvps = JSON.parse(localStorage.getItem('weddingRSVPs') || '[]');
                rsvps.push(data);
                localStorage.setItem('weddingRSVPs', JSON.stringify(rsvps));
            }

            // Show success immediately; do not block on email function latency/failure
            if (successMessage) {
                if (data.attending === 'yes') {
                    if (successTitle) successTitle.textContent = 'Thank You!';
                    if (successIcon) {
                        successIcon.textContent = '✓';
                        successIcon.classList.remove('decline');
                    }
                    successMessage.textContent = 'See you there!';
                } else {
                    if (successTitle) successTitle.textContent = "I'm sorry";
                    if (successIcon) {
                        successIcon.textContent = '✕';
                        successIcon.classList.add('decline');
                    }
                    successMessage.textContent = "I'm sorry you wont be attneding";
                }
            }

            form.style.display = 'none';
            if (success) success.style.display = 'block';
            showToast('RSVP submitted!');

            sendNotificationEmail('rsvp', data).then((sent) => {
                showToast(sent ? 'RSVP email notification sent!' : 'RSVP saved, but email notification failed.');
            });
        } catch (error) {
            console.error('RSVP submit failed:', error);
            showToast('Could not submit RSVP. Please try again.', 'error');
        } finally {
            if (submitBtn) submitBtn.disabled = false;
        }
    });
    
    resetBtn?.addEventListener('click', () => {
        form.reset();
        form.style.display = 'flex';
        success.style.display = 'none';
    });
}

// ============================================
// CONTACT FORM
// ============================================
function initContact() {
    const form = $('#contactForm');
    const success = $('#contactSuccess');
    const successMessage = $('#contactSuccessMessage');
    const resetBtn = $('#resetContact');

    form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;

        try {
            const formData = new FormData(form);
            const data = Object.fromEntries(formData);
            data.createdAt = new Date().toISOString();
            const messageText = (data.message || '').toLowerCase();
            const subjectText = (data.subject || '').toLowerCase();

            let sent = false;
            if (supabaseClient) {
                const { error } = await supabaseClient
                    .from('contact_messages')
                    .insert([{
                        name: data.name,
                        email: data.email,
                        subject: data.subject || null,
                        message: data.message,
                        created_at: data.createdAt
                    }]);
                if (!error) sent = true;
                if (error) {
                    console.error('Contact Supabase insert failed:', error);
                }
            }

            if (!sent) {
                const messages = JSON.parse(localStorage.getItem('weddingContactMessages') || '[]');
                messages.push(data);
                localStorage.setItem('weddingContactMessages', JSON.stringify(messages));
            }

            if (successMessage) {
                if (messageText.includes('urgent') || messageText.includes('asap') || subjectText.includes('urgent')) {
                    successMessage.textContent = 'Thanks for reaching out. We have marked this as urgent and will respond as soon as possible.';
                } else if (messageText.includes('?') || messageText.includes('question') || subjectText.includes('question')) {
                    successMessage.textContent = 'Thanks for your question. We received it and will get back to you soon.';
                } else {
                    successMessage.textContent = 'Thanks for reaching out. We have received your message.';
                }
            }

            form.style.display = 'none';
            if (success) success.style.display = 'block';
            showToast('Message sent!');

            sendNotificationEmail('contact', data).then((sentOk) => {
                showToast(sentOk ? 'Contact email notification sent!' : 'Message saved, but email notification failed.');
            });
        } catch (error) {
            console.error('Contact submit failed:', error);
            showToast('Could not send message. Please try again.', 'error');
        } finally {
            if (submitBtn) submitBtn.disabled = false;
        }
    });

    resetBtn?.addEventListener('click', () => {
        form.reset();
        form.style.display = 'flex';
        success.style.display = 'none';
    });
}

// ============================================
// Q&A ACCORDION
// ============================================
function initQA() {
    const items = $$('.qa-item');
    
    items.forEach(item => {
        const question = item.querySelector('.qa-question');
        
        question.addEventListener('click', () => {
            const isOpen = item.classList.contains('open');
            
            // Close all
            items.forEach(i => i.classList.remove('open'));
            
            // Open clicked if wasn't open
            if (!isOpen) {
                item.classList.add('open');
            }
        });
    });
}

// ============================================
// NAVIGATION
// ============================================
function initNavigation() {
    const nav = $('#mainNav');
    const navLinks = $$('.nav-link');
    const sections = $$('.section, .hero-section, .countdown-section');
    
    // Sticky nav shadow
    window.addEventListener('scroll', () => {
        if (window.scrollY > 100) {
            nav.style.boxShadow = '0 2px 20px rgba(0,0,0,0.1)';
        } else {
            nav.style.boxShadow = 'none';
        }
    });
    
    // Active link on scroll
    const observerOptions = {
        rootMargin: '-50% 0px -50% 0px',
        threshold: 0
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.id;
                navLinks.forEach(link => {
                    link.classList.toggle('active', link.dataset.section === id);
                });
            }
        });
    }, observerOptions);
    
    sections.forEach(section => observer.observe(section));
}

// ============================================
// SCROLL ANIMATIONS
// ============================================
function initScrollAnimations() {
    const reveals = $$('.section-header, .schedule-card, .catalogue-item, .qa-item, .registry-card, .dress-code-card-large, .note-card');
    
    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('reveal', 'active');
                revealObserver.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });
    
    reveals.forEach(el => {
        el.classList.add('reveal');
        revealObserver.observe(el);
    });
    
    // Timeline events animation
    const timelineEvents = $$('.timeline-event');
    
    const timelineObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('reveal');
                timelineObserver.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.2,
        rootMargin: '0px 0px -100px 0px'
    });
    
    timelineEvents.forEach(el => {
        timelineObserver.observe(el);
    });
}

// ============================================
// SMOOTH SCROLL
// ============================================
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = $(this.getAttribute('href'));
            if (target) {
                const offset = 80; // Account for sticky nav
                const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - offset;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}

function initDressSlideshows() {
    const women1 = document.querySelector('.women-slideshow .mover-1');
    const women2 = document.querySelector('.women-slideshow .mover-2');
    const men1 = document.querySelector('.men-slideshow .mover-1');
    const men2 = document.querySelector('.men-slideshow .mover-2');

    const womenImages = [
        'images/woman1.jpeg',
        'images/woman2.jpeg',
        'images/woman3.jpeg',
        'images/woman4.jpeg',
        'images/woman5.jpeg',
        'images/woman6.jpeg',
        'images/woman7.jpeg',
        'images/woman8.jpeg'
    ];

    const menImages = [
        'images/man1.jpeg',
        'images/man2.jpeg',
        'images/man3.jpeg',
        'images/man4.jpeg',
        'images/man5.jpeg',
        'images/man6.jpeg',
        'images/man7.jpeg',
        'images/man9.jpeg',
        'images/man10.jpeg'
    ];

    const renderStrip = (el, images) => {
        if (!el) return;
        const strip = [...images, ...images]
            .map((src) => `<img class="slide-strip-img" src="${src}" alt="Dress code inspiration" loading="eager" decoding="async">`)
            .join('');
        el.innerHTML = strip;
    };

    renderStrip(women1, womenImages);
    renderStrip(women2, womenImages.slice().reverse());
    renderStrip(men1, menImages);
    renderStrip(men2, menImages.slice().reverse());
}



// ============================================
// INITIALIZE
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    // Unlock page scrolling immediately even if a later init fails.
    document.body.classList.add('loaded');
    document.documentElement.style.overflowY = 'auto';
    document.body.style.overflowY = 'auto';
    document.body.style.overflow = '';

    const safeInit = (name, fn) => {
        try {
            fn();
        } catch (error) {
            console.error(`Init failed: ${name}`, error);
        }
    };

    // Start countdown
    safeInit('countdown', () => {
        updateCountdown();
        setInterval(updateCountdown, 1000);
    });
    
    // Run attire slideshows early so they still render if another feature fails on mobile.
    safeInit('dress slideshows', initDressSlideshows);

    // Initialize camera
    safeInit('camera', () => camera.init());
    
    // Initialize gallery
    safeInit('gallery', () => gallery.init());

    // Initialize features
    safeInit('catalogue filter', initCatalogueFilter);
    safeInit('rsvp', initRSVP);
    safeInit('contact', initContact);
    safeInit('q&a', initQA);
    safeInit('navigation', initNavigation);
    safeInit('scroll animations', initScrollAnimations);
    safeInit('smooth scroll', initSmoothScroll);
    safeInit('photo rings', initPhotoRings);
    
    console.log('🎉 Zimri & Shawn Wedding Website Loaded!');
    console.log('📸 Camera ready - Take as many photos as you like!');
    console.log(supabaseClient ? '☁️ Supabase connected' : '💾 Running with local fallback storage');
});

// Safari/Chrome mobile can restore a stale scroll lock from bfcache.
window.addEventListener('pageshow', () => {
    document.documentElement.style.overflowY = 'auto';
    document.body.style.overflowY = 'auto';
    if (!$('#lightbox')?.classList.contains('active')) {
        document.body.style.overflow = '';
    }
});

// Handle visibility change - pause camera when tab hidden
document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.currentStream) {
        state.currentStream.getTracks().forEach(track => track.stop());
    }
});

// Handle beforeunload - save any unsaved data
window.addEventListener('beforeunload', () => {
    camera.savePhotosToStorage();
    camera.stopRealtimeUpdates();
});

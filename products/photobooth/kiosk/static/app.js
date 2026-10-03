// Mobley Photo Booth Co. - Client Kiosk State Machine
const app = {
    currentScreen: 'screen-attractor',
    selectedFilter: 'clean_color',
    totalPoses: 3,
    currentPose: 1,
    currentSessionId: null,
    capturedFrames: [],
    resetTimerInterval: null,
    countdownInterval: null,

    init() {
        this.loadEventConfig();
    },

    async loadEventConfig() {
        try {
            const res = await fetch('/api/status');
            const data = await res.json();
            if (data.event) {
                document.getElementById('event-title-display').innerText = data.event.title || 'GALA PORTRAIT ATELIER';
                document.getElementById('event-meta-display').innerText = `${data.event.venue || 'Richmond, VA'} • ${data.event.date || ''}`;
            }
        } catch (e) {
            console.error('Config fetch failed:', e);
        }
    },

    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const target = document.getElementById(screenId);
        if (target) target.classList.add('active');
        this.currentScreen = screenId;
    },

    startFlow() {
        this.showScreen('screen-filter');
    },

    async selectFilter(filterName) {
        this.selectedFilter = filterName;
        // Start Session
        try {
            const res = await fetch('/api/start_session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filter: filterName })
            });
            const data = await res.json();
            this.currentSessionId = data.session_id;
            this.currentPose = 1;
            this.capturedFrames = [];
            this.runPoseSequence();
        } catch (e) {
            alert('Failed to initialize session. Check server connection.');
            this.resetToAttractor();
        }
    },

    async runPoseSequence() {
        if (this.currentPose > this.totalPoses) {
            this.processAndRender();
            return;
        }

        this.showScreen('screen-capture');
        document.getElementById('pose-indicator').innerText = `POSE ${this.currentPose} OF ${this.totalPoses}`;
        
        let count = 3;
        const countEl = document.getElementById('countdown-number');
        countEl.innerText = count;

        this.countdownInterval = setInterval(async () => {
            count--;
            if (count > 0) {
                countEl.innerText = count;
            } else {
                clearInterval(this.countdownInterval);
                countEl.innerText = 'SMILE!';
                
                // Trigger Visual Strobe Flash
                this.triggerFlash();

                // Trigger Camera Capture API
                try {
                    const res = await fetch('/api/capture_pose', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            session_id: this.currentSessionId,
                            pose_idx: this.currentPose
                        })
                    });
                    const data = await res.json();
                    if (data.frame_path) {
                        this.capturedFrames.push(data.frame_path);
                    }
                } catch (e) {
                    console.error('Capture API error:', e);
                }

                // Advance to next pose after brief pause
                setTimeout(() => {
                    this.currentPose++;
                    this.runPoseSequence();
                }, 1200);
            }
        }, 1000);
    },

    triggerFlash() {
        const overlay = document.getElementById('flash-overlay');
        overlay.classList.add('active');
        setTimeout(() => overlay.classList.remove('active'), 180);
    },

    async processAndRender() {
        this.showScreen('screen-processing');

        try {
            const res = await fetch('/api/render_strip', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: this.currentSessionId,
                    filter: this.selectedFilter
                })
            });
            const data = await res.json();

            // Display Results
            document.getElementById('rendered-strip-img').src = data.strip_url + '?t=' + Date.now();
            document.getElementById('qr-code-img').src = data.qr_url + '?t=' + Date.now();
            document.getElementById('print-status-msg').innerText = '';

            this.showScreen('screen-review');
            this.startAutoReset(30);
        } catch (e) {
            alert('Error rendering composite photo strip: ' + e);
            this.resetToAttractor();
        }
    },

    async dispatchPrint(copies = 2) {
        const msgEl = document.getElementById('print-status-msg');
        msgEl.innerText = `Dispatching ${copies} prints to dye-sub spooler...`;

        try {
            const res = await fetch('/api/print', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: this.currentSessionId,
                    copies: copies
                })
            });
            const data = await res.json();
            msgEl.innerText = `✓ Dispensing ${copies} prints. Collect from tray.`;
        } catch (e) {
            msgEl.innerText = 'Print queue error. Attendant notified.';
        }
    },

    startAutoReset(seconds) {
        clearInterval(this.resetTimerInterval);
        let remain = seconds;
        const timerEl = document.getElementById('reset-timer');
        timerEl.innerText = remain;

        this.resetTimerInterval = setInterval(() => {
            remain--;
            timerEl.innerText = remain;
            if (remain <= 0) {
                clearInterval(this.resetTimerInterval);
                this.resetToAttractor();
            }
        }, 1000);
    },

    resetToAttractor() {
        clearInterval(this.resetTimerInterval);
        clearInterval(this.countdownInterval);
        this.currentSessionId = null;
        this.capturedFrames = [];
        this.currentPose = 1;
        this.showScreen('screen-attractor');
    }
};

window.addEventListener('DOMContentLoaded', () => app.init());

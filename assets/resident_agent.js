/**
 * resident_agent.js
 * Evaluates current URL, pathname, and venture config metadata.
 * Dynamically determines which layout blocks to subtract based on the active division.
 */

document.addEventListener("DOMContentLoaded", async () => {
    // 1. Evaluate metadata
    const divisionMeta = document.querySelector('meta[name="venture-division"]');
    const division = divisionMeta ? divisionMeta.content : 'unknown';
    
    // Add dynamic CSS class for subtraction
    const style = document.createElement('style');
    style.textContent = '.pruned { display: none !important; }';
    document.head.appendChild(style);

    // 2. Determine layout blocks to subtract based on active division
    const subtractIds = [];
    
    if (division === 'finance') {
        subtractIds.push('media-viewport', 'code-terminal', 'code-sandboxes');
        // Keep telemetry, payment gate, and ledger components
    } else if (division === 'education') {
        subtractIds.push('developer-terminals', 'cap-tables');
        // Keep media viewport, chat conduit, and lesson progress indicators
    } else if (division === 'defense') {
        subtractIds.push('public-pricing-grids', 'sign-ups', 'social-proof');
        // Keep encrypted access portals and secure telemetry
    }
    
    // Perform subtraction
    subtractIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.add('pruned');
        }
    });

    // ── 3D Background & Content Overlay Idle Transition (Aesthetic Absolutism) ──
    const overlay = document.getElementById('overlay') || document.querySelector('main') || document.body;
    let idleTimer = null;
    function resetIdleTimer() {
        if (overlay) {
            overlay.style.opacity = '1';
            overlay.style.transition = 'opacity 0.4s ease';
            overlay.style.pointerEvents = 'auto';
        }
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
            if (overlay && window.innerWidth >= 768) {
                overlay.style.opacity = '0';
                overlay.style.pointerEvents = 'none';
            }
        }, 4000);
    }
    ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'].forEach(evt => {
        window.addEventListener(evt, resetIdleTimer, { passive: true });
    });
    resetIdleTimer();

    // ── Universal Fleet Footer Browser Injection ──
    const footer = document.querySelector('footer');
    if (footer) {
        const fBrowser = document.createElement('div');
        fBrowser.id = 'fleet-footer-browser';
        fBrowser.style.cssText = 'margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--border, rgba(255,255,255,0.08)); font-family: monospace; font-size: 0.8rem; color: var(--text-muted, #888); text-align: center;';
        fBrowser.innerHTML = `
            <div style="font-weight:700; margin-bottom: 0.5rem; color: var(--accent, #ffcc00);">CONGLOMERATE STELLAR NETWORK</div>
            <div style="display:flex; justify-content:center; gap: 0.8rem; flex-wrap: wrap;">
                <a href="https://authfor.com" style="color:inherit; text-decoration:none;">🔐 AuthFor</a>
                <a href="https://vendyai.com" style="color:inherit; text-decoration:none;">💳 VendyAI</a>
                <a href="https://mailguyai.com" style="color:inherit; text-decoration:none;">✉️ MailguyAI</a>
                <a href="https://weylandai.com" style="color:inherit; text-decoration:none;">🤖 WeylandAI</a>
                <a href="https://mobleysoft.com" style="color:inherit; text-decoration:none;">👾 Mobleysoft</a>
            </div>
        `;
        footer.appendChild(fBrowser);
    }

    // 3. Connect to the local Qwen-local adapter at localhost:11435 or the edge gateway
    // to fetch real-time suggestions from the resident model.
    try {
        const payload = {
            url: window.location.href,
            pathname: window.location.pathname,
            division: division,
            subtracted: subtractIds
        };
        
        // Attempt local adapter first, fallback to the secure edge tunnel endpoint, then edge-gateway
        fetch('/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'qwen-local',
                messages: [
                    { role: 'system', content: 'Resident Agent Active.' },
                    { role: 'user', content: JSON.stringify(payload) }
                ]
            })
        }).then(response => {
            console.log('[Resident Agent] Local Qwen connection successful.');
        }).catch(err => {
            console.warn('[Resident Agent] Local Qwen unavailable, attempting secure tunnel endpoint...', err);
            fetch('https://mobley.mobleysoft.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'qwen-local',
                    messages: [
                        { role: 'system', content: 'Resident Agent Active.' },
                        { role: 'user', content: JSON.stringify(payload) }
                    ]
                })
            }).then(res => {
                console.log('[Resident Agent] Edge Tunnel Qwen connection successful.');
            }).catch(tunnelErr => {
                console.warn('[Resident Agent] Secure Tunnel unavailable, attempting edge gateway...', tunnelErr);
                // Fallback to edge gateway
                fetch('https://edge-gateway.johnmobley99.workers.dev/resident', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                }).then(res => {
                console.log('[Resident Agent] Edge gateway connection successful.');
            }).catch(edgeErr => {
                console.error('[Resident Agent] Edge gateway also unavailable.', edgeErr);
            });
        });
    } catch (e) {
        console.error('[Resident Agent] Telemetry connection failed.', e);
    }
});

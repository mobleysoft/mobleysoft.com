(() => {
  "use strict";

  const body = document.body;
  const isCompact = window.matchMedia("(max-width: 920px)");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const shell = document.getElementById("site-shell");
  const revealHint = document.getElementById("reveal-hint");
  const slides = [...document.querySelectorAll(".product-slide")];
  const dots = document.getElementById("product-dots");
  const slideIndex = document.getElementById("slide-index");
  const slideCount = document.getElementById("slide-count");
  const previousProduct = document.getElementById("previous-product");
  const nextProduct = document.getElementById("next-product");
  const fleetStrip = document.getElementById("fleet-strip");
  const fleetSearch = document.getElementById("fleet-search");
  const fleetCount = document.getElementById("fleet-count");
  const timelinePanel = document.getElementById("timeline-panel");
  const timelineFrame = document.getElementById("timeline-frame");
  const timelineVideo = document.getElementById("timeline-video");
  const timelineRange = document.getElementById("timeline-range");
  const timelineTitle = document.getElementById("timeline-frame-title");
  const timelineMeta = document.getElementById("timeline-frame-meta");
  const accessDialog = document.getElementById("access-dialog");
  const backgroundToggle = document.getElementById("background-toggle");
  const backgroundToggleLabel = document.getElementById("background-toggle-label");
  const backgroundReplay = document.getElementById("background-replay");
  const backgroundStatus = document.getElementById("background-status");

  let activeSlide = 0;
  let carouselTimer = 0;
  let idleTimer = 0;
  let fleet = [];
  let timelineFrames = [];
  let timelinePosition = 0;
  let timelineReturnFocus = null;

  function reveal() {
    body.classList.add("shell-visible");
    window.clearTimeout(idleTimer);
    if (!isCompact.matches && !timelinePanel.classList.contains("is-open")) {
      idleTimer = window.setTimeout(() => {
        if (!shell.contains(document.activeElement) && !accessDialog.open) {
          body.classList.remove("shell-visible");
        }
      }, 30000);
    }
  }

  function productIndexFromHash() {
    const slug = window.location.hash.replace(/^#\/?/, "").toLowerCase();
    const index = slides.findIndex((slide) => slide.dataset.product === slug);
    return index >= 0 ? index : 0;
  }

  function updateProduct(index, updateHash = true) {
    activeSlide = (index + slides.length) % slides.length;
    slides.forEach((slide, position) => {
      const active = position === activeSlide;
      slide.classList.toggle("is-active", active);
      slide.setAttribute("aria-hidden", String(!active));
      if ("inert" in slide) slide.inert = !active;
    });
    [...dots.children].forEach((dot, position) => {
      const active = position === activeSlide;
      dot.classList.toggle("is-active", active);
      dot.setAttribute("aria-current", active ? "true" : "false");
    });
    slideIndex.textContent = String(activeSlide + 1).padStart(2, "0");
    if (updateHash) {
      history.replaceState(null, "", `#${slides[activeSlide].dataset.product}`);
    }
    resetCarousel();
  }

  function resetCarousel() {
    window.clearInterval(carouselTimer);
    if (!reducedMotion.matches && !document.hidden) {
      carouselTimer = window.setInterval(() => updateProduct(activeSlide + 1), 10000);
    }
  }

  function initializeCarousel() {
    slideCount.textContent = String(slides.length).padStart(2, "0");
    slides.forEach((slide, index) => {
      const dot = document.createElement("button");
      dot.className = "product-dot";
      dot.type = "button";
      dot.setAttribute("aria-label", `Show ${slide.dataset.product}`);
      dot.addEventListener("click", () => updateProduct(index));
      dots.appendChild(dot);
    });
    previousProduct.addEventListener("click", () => updateProduct(activeSlide - 1));
    nextProduct.addEventListener("click", () => updateProduct(activeSlide + 1));
    window.addEventListener("hashchange", () => updateProduct(productIndexFromHash(), false));
    updateProduct(productIndexFromHash(), false);
  }

  function ventureMarkup(venture) {
    const label = venture.domain.split(".")[0].replace(/[-_]+/g, " ");
    return `<a class="fleet-card" href="${venture.url}" target="_blank" rel="noreferrer"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(venture.domain)}</span></a>`;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    })[character]);
  }

  function renderFleet(query = "") {
    const normalized = query.trim().toLowerCase();
    const visible = normalized
      ? fleet.filter((venture) => venture.domain.includes(normalized))
      : fleet;
    fleetStrip.innerHTML = visible.length
      ? visible.map(ventureMarkup).join("")
      : '<p class="fleet-empty">No authoritative venture matches that query.</p>';
    fleetCount.textContent = `${visible.length} of ${fleet.length} ventures`;
  }

  async function initializeFleet() {
    try {
      const response = await fetch("/data/fleet.json", { cache: "no-store" });
      if (!response.ok) throw new Error(`fleet request returned ${response.status}`);
      const payload = await response.json();
      if (!Array.isArray(payload.ventures) || payload.ventures.length !== payload.count) {
        throw new Error("fleet payload failed count validation");
      }
      fleet = payload.ventures;
      renderFleet();
    } catch (error) {
      fleetStrip.innerHTML = `<p class="fleet-empty">Fleet unavailable: ${escapeHtml(error.message)}</p>`;
      fleetCount.textContent = "Fleet unavailable";
    }
  }

  async function initializeUnlostFacts() {
    try {
      const response = await fetch("/products/unlost/product.json", { cache: "no-store" });
      if (!response.ok) throw new Error(`Unlost status returned ${response.status}`);
      const payload = await response.json();
      const baseline = payload.observed_baseline || {};
      document.getElementById("unlost-artifact-count").textContent = Number(
        baseline.local_artifacts_indexed || baseline.artifacts_indexed || 0
      ).toLocaleString();
      document.getElementById("unlost-find-latency").textContent = baseline.find_median_seconds == null
        ? "—"
        : `${Number(baseline.find_median_seconds).toFixed(2)}s`;
      document.getElementById("unlost-shard-count").textContent = String(baseline.federated_shards || 1);
    } catch (error) {
      console.warn(error.message);
    }
  }

  function selectTimelineFrame(index) {
    if (!timelineFrames.length) return;
    timelinePosition = Math.max(0, Math.min(index, timelineFrames.length - 1));
    const frame = timelineFrames[timelinePosition];
    timelineRange.value = String(timelinePosition);
    timelineFrame.src = frame.image;
    timelineFrame.alt = `${frame.label} Mobleysoft checkpoint`;
    timelineTitle.textContent = frame.label;
    const shortCommit = frame.commit ? frame.commit.slice(0, 10) : "uncommitted";
    timelineMeta.textContent = `${timelinePosition + 1} / ${timelineFrames.length} · ${frame.observed_at} · ${shortCommit}`;
  }

  async function loadTimeline() {
    if (timelineFrames.length) return;
    try {
      const response = await fetch("/evolution/manifest.json", { cache: "no-store" });
      if (!response.ok) throw new Error(`timeline request returned ${response.status}`);
      const payload = await response.json();
      timelineFrames = Array.isArray(payload.frames) ? payload.frames : [];
      timelineRange.max = String(Math.max(0, timelineFrames.length - 1));
      selectTimelineFrame(timelineFrames.length - 1);
    } catch (error) {
      timelineTitle.textContent = "Archive unavailable";
      timelineMeta.textContent = error.message;
    }
  }

  function openTimeline(trigger) {
    timelineReturnFocus = trigger || document.activeElement;
    timelinePanel.classList.add("is-open");
    timelinePanel.setAttribute("aria-hidden", "false");
    timelinePanel.dataset.mode = "movie";
    window.clearTimeout(idleTimer);
    document.getElementById("timeline-close").focus();
    loadTimeline();
  }

  function closeTimeline() {
    timelinePanel.classList.remove("is-open");
    timelinePanel.setAttribute("aria-hidden", "true");
    timelineVideo.pause();
    if (timelineReturnFocus && typeof timelineReturnFocus.focus === "function") timelineReturnFocus.focus();
    reveal();
  }

  function setTimelineMode(mode) {
    timelinePanel.dataset.mode = mode;
    document.querySelectorAll("[data-timeline-mode]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.timelineMode === mode);
    });
    if (mode === "frames") timelineVideo.pause();
  }

  function initializeTimeline() {
    document.getElementById("timeline-link").addEventListener("click", (event) => openTimeline(event.currentTarget));
    document.getElementById("pi-trigger").addEventListener("click", (event) => openTimeline(event.currentTarget));
    document.getElementById("timeline-close").addEventListener("click", closeTimeline);
    document.getElementById("timeline-previous").addEventListener("click", () => selectTimelineFrame(timelinePosition - 1));
    document.getElementById("timeline-next").addEventListener("click", () => selectTimelineFrame(timelinePosition + 1));
    timelineRange.addEventListener("input", () => selectTimelineFrame(Number(timelineRange.value)));
    document.querySelectorAll("[data-timeline-mode]").forEach((button) => {
      button.addEventListener("click", () => setTimelineMode(button.dataset.timelineMode));
    });
    timelinePanel.addEventListener("click", (event) => {
      if (event.target === timelinePanel) closeTimeline();
    });
  }

  function initializeAccess() {
    document.getElementById("unlost-buy").addEventListener("click", () => {
      if (typeof accessDialog.showModal === "function") accessDialog.showModal();
      else accessDialog.setAttribute("open", "");
    });
    document.getElementById("access-close").addEventListener("click", () => accessDialog.close());
  }

  function initializeInteraction() {
    if (isCompact.matches) body.classList.add("shell-visible");
    revealHint.addEventListener("click", reveal);
    ["pointermove", "pointerdown", "touchstart", "keydown"].forEach((eventName) => {
      document.addEventListener(eventName, reveal, { passive: eventName !== "keydown" });
    });
    document.addEventListener("keydown", (event) => {
      const timelineShortcut = event.ctrlKey && event.shiftKey
        && (event.code === "Backquote" || event.key === "~" || event.key === "`");
      if (timelineShortcut) {
        event.preventDefault();
        timelinePanel.classList.contains("is-open") ? closeTimeline() : openTimeline(document.activeElement);
        return;
      }
      if (event.key === "Escape" && timelinePanel.classList.contains("is-open")) closeTimeline();
      if (event.key === "/" && !/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) {
        event.preventDefault();
        fleetSearch.focus();
        document.getElementById("fleet-browser").scrollIntoView({ behavior: reducedMotion.matches ? "auto" : "smooth" });
      }
      if (event.key === "ArrowLeft" && !timelinePanel.classList.contains("is-open") && !/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) updateProduct(activeSlide - 1);
      if (event.key === "ArrowRight" && !timelinePanel.classList.contains("is-open") && !/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) updateProduct(activeSlide + 1);
    });
    isCompact.addEventListener("change", (event) => {
      if (event.matches) body.classList.add("shell-visible");
      else reveal();
    });
    document.addEventListener("visibilitychange", resetCarousel);
  }

  function setBackgroundState(playing) {
    backgroundToggle.setAttribute("aria-pressed", String(playing));
    backgroundToggleLabel.textContent = playing ? "Pause encounter" : "Play encounter";
    backgroundToggle.querySelector(".play-symbol").textContent = playing ? "II" : "\u25b6";
    backgroundStatus.textContent = playing ? "PLAYING" : "FROZEN";
    document.body.classList.toggle("background-playing", playing);
  }

  function initializeBackgroundPlayer() {
    backgroundToggle.addEventListener("click", () => window.MobleyBlackhole?.toggle());
    backgroundReplay.addEventListener("click", () => {
      window.MobleyBlackhole?.replay();
      if (!window.MobleyBlackhole?.getState().playing) window.MobleyBlackhole?.play();
    });
    window.addEventListener("mobley:blackhole-state", (event) => setBackgroundState(event.detail.playing));
    document.addEventListener("keydown", (event) => {
      if (event.code !== "KeyP" || /^(INPUT|TEXTAREA|BUTTON)$/.test(document.activeElement.tagName)) return;
      event.preventDefault();
      window.MobleyBlackhole?.toggle();
    });
    setBackgroundState(Boolean(window.MobleyBlackhole?.getState().playing));
  }

  fleetSearch.addEventListener("input", () => renderFleet(fleetSearch.value));

  initializeCarousel();
  initializeFleet();
  initializeUnlostFacts();
  initializeTimeline();
  initializeAccess();
  initializeInteraction();
  initializeBackgroundPlayer();
  window.setTimeout(reveal, isCompact.matches ? 0 : 1200);
})();

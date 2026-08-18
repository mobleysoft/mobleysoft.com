(() => {
  "use strict";

  const chapters = [...document.querySelectorAll(".chapter")];
  const navigation = document.getElementById("chapter-nav");
  const progress = document.getElementById("progress-bar");
  const label = document.getElementById("chapter-label");
  const count = document.getElementById("chapter-count");
  const playButton = document.getElementById("play-deck");
  const pipelineList = document.getElementById("pipeline-list");
  const boundary = document.getElementById("pipeline-boundary");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let activeIndex = 0;
  let autoplayTimer = 0;

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, character => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
    })[character]);
  }

  function updateNavigation(index) {
    activeIndex = Math.max(0, Math.min(index, chapters.length - 1));
    [...navigation.children].forEach((link, position) => link.classList.toggle("is-active", position === activeIndex));
    label.textContent = chapters[activeIndex].dataset.label;
    count.textContent = `${String(activeIndex + 1).padStart(2, "0")} / ${String(chapters.length).padStart(2, "0")}`;
  }

  function goTo(index) {
    const next = Math.max(0, Math.min(index, chapters.length - 1));
    chapters[next].scrollIntoView({ behavior: reducedMotion.matches ? "auto" : "smooth", block: "start" });
    updateNavigation(next);
  }

  function stopAutoplay() {
    window.clearInterval(autoplayTimer);
    autoplayTimer = 0;
    playButton.setAttribute("aria-pressed", "false");
    playButton.querySelector("span").textContent = "Play 75 sec";
  }

  function toggleAutoplay() {
    if (autoplayTimer) return stopAutoplay();
    playButton.setAttribute("aria-pressed", "true");
    playButton.querySelector("span").textContent = "Pause deck";
    if (activeIndex === chapters.length - 1) goTo(0);
    autoplayTimer = window.setInterval(() => {
      if (activeIndex >= chapters.length - 1) return stopAutoplay();
      goTo(activeIndex + 1);
    }, 9000);
  }

  async function loadPipeline() {
    try {
      const response = await fetch("/showbiz/pipeline.json", { cache: "no-store" });
      if (!response.ok) throw new Error(`pipeline returned ${response.status}`);
      const payload = await response.json();
      if (!Array.isArray(payload.stages) || payload.stages.length !== payload.count || payload.count !== 9) {
        throw new Error("pipeline failed count validation");
      }
      pipelineList.innerHTML = payload.stages.map(stage => `
        <article class="pipeline-card">
          <b>${String(stage.position).padStart(2, "0")}</b>
          <span>${escapeHtml(stage.stage)}</span>
          <h3>${escapeHtml(stage.product)}</h3>
          <p>${escapeHtml(stage.application)}</p>
          <small>${escapeHtml(stage.domain)}<br>${escapeHtml(stage.handoff)}</small>
        </article>`).join("");
      boundary.textContent = payload.status_boundary;
      document.documentElement.dataset.pipeline = "verified";
    } catch (error) {
      pipelineList.innerHTML = `<p class="loading">Canonical pipeline unavailable: ${escapeHtml(error.message)}</p>`;
      document.documentElement.dataset.pipeline = "failed";
    }
  }

  chapters.forEach((chapter, index) => {
    const link = document.createElement("a");
    link.href = `#${chapter.id}`;
    link.textContent = chapter.dataset.label;
    link.setAttribute("aria-label", `Go to ${chapter.dataset.label}`);
    link.addEventListener("click", event => {
      event.preventDefault();
      stopAutoplay();
      goTo(index);
    });
    navigation.appendChild(link);
  });

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const index = chapters.indexOf(entry.target);
      entry.target.classList.add("is-visible");
      updateNavigation(index);
    });
  }, { threshold: 0.55 });
  chapters.forEach(chapter => observer.observe(chapter));

  window.addEventListener("scroll", () => {
    const maximum = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.width = `${maximum > 0 ? (window.scrollY / maximum) * 100 : 0}%`;
  }, { passive: true });

  document.addEventListener("keydown", event => {
    if (["ArrowDown", "ArrowRight", "PageDown", "Space"].includes(event.code)) {
      event.preventDefault(); stopAutoplay(); goTo(activeIndex + 1);
    } else if (["ArrowUp", "ArrowLeft", "PageUp"].includes(event.code)) {
      event.preventDefault(); stopAutoplay(); goTo(activeIndex - 1);
    } else if (event.code === "Home") {
      event.preventDefault(); stopAutoplay(); goTo(0);
    } else if (event.code === "End") {
      event.preventDefault(); stopAutoplay(); goTo(chapters.length - 1);
    }
  });

  playButton.addEventListener("click", toggleAutoplay);
  chapters[0].classList.add("is-visible");
  updateNavigation(0);
  loadPipeline().finally(() => { window.__SHOWBIZ_READY__ = true; });
})();

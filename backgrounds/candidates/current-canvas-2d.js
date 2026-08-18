(() => {
  "use strict";

  const canvas = document.getElementById("blackhole-canvas");
  if (!canvas) return;

  const context = canvas.getContext("2d", { alpha: false });
  if (!context) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const compact = window.matchMedia("(max-width: 720px)");
  const tau = Math.PI * 2;
  let width = 0;
  let height = 0;
  let ratio = 1;
  let centerX = 0;
  let centerY = 0;
  let radius = 0;
  let frame = 0;
  let running = true;
  let pointerX = 0;
  let pointerY = 0;
  let particles = [];

  function particle() {
    return {
      angle: Math.random() * tau,
      distance: 1.25 + Math.random() * 4.6,
      depth: 0.3 + Math.random() * 0.7,
      speed: 0.00045 + Math.random() * 0.0016,
      drift: (Math.random() - 0.5) * 0.00045,
      size: 0.3 + Math.random() * 1.5,
      heat: Math.random(),
    };
  }

  function resetParticles() {
    const count = reducedMotion.matches ? 120 : compact.matches ? 360 : 760;
    particles = Array.from({ length: count }, particle);
  }

  function resize() {
    ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.max(1, Math.floor(width * ratio));
    canvas.height = Math.max(1, Math.floor(height * ratio));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    centerX = width * (compact.matches ? 0.53 : 0.64);
    centerY = height * (compact.matches ? 0.32 : 0.5);
    radius = Math.max(44, Math.min(width, height) * (compact.matches ? 0.105 : 0.13));
    resetParticles();
  }

  function background() {
    const gradient = context.createRadialGradient(
      centerX + pointerX * 0.02,
      centerY + pointerY * 0.02,
      radius * 0.2,
      centerX,
      centerY,
      Math.max(width, height) * 0.9,
    );
    gradient.addColorStop(0, "#0b1114");
    gradient.addColorStop(0.28, "#050a0e");
    gradient.addColorStop(1, "#010305");
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
  }

  function stars(time) {
    const count = compact.matches ? 70 : 150;
    context.save();
    for (let index = 0; index < count; index += 1) {
      const seedX = ((index * 177.31) % 101) / 101;
      const seedY = ((index * 91.73) % 97) / 97;
      const x = seedX * width + pointerX * (0.003 + (index % 4) * 0.001);
      const y = seedY * height + pointerY * (0.003 + (index % 5) * 0.001);
      const flicker = 0.18 + 0.22 * Math.sin(time * 0.0007 + index * 2.17);
      context.globalAlpha = Math.max(0.04, flicker);
      context.fillStyle = index % 17 === 0 ? "#f1c66f" : "#dce7e8";
      context.fillRect(x, y, index % 13 === 0 ? 1.6 : 0.7, index % 13 === 0 ? 1.6 : 0.7);
    }
    context.restore();
  }

  function accretion(time) {
    const tilt = compact.matches ? -0.16 : -0.28;
    context.save();
    context.translate(centerX + pointerX * 0.012, centerY + pointerY * 0.012);
    context.rotate(tilt);
    context.scale(1, 0.32);
    context.globalCompositeOperation = "lighter";

    for (let ring = 0; ring < 12; ring += 1) {
      const ringRadius = radius * (1.32 + ring * 0.19);
      const start = time * (0.00004 + ring * 0.000003) + ring * 0.61;
      const color = ring < 4 ? "244, 210, 132" : ring < 8 ? "217, 164, 65" : "102, 123, 126";
      context.beginPath();
      context.arc(0, 0, ringRadius, start, start + Math.PI * (0.42 + (ring % 4) * 0.12));
      context.strokeStyle = `rgba(${color}, ${0.12 - ring * 0.005})`;
      context.lineWidth = Math.max(0.6, radius * (0.025 - ring * 0.0012));
      context.stroke();
    }

    particles.forEach((point) => {
      point.angle += point.speed * (reducedMotion.matches ? 0.15 : 1);
      point.distance += point.drift;
      if (point.distance < 1.2 || point.distance > 5.9) point.drift *= -1;
      const x = Math.cos(point.angle) * radius * point.distance;
      const y = Math.sin(point.angle) * radius * point.distance;
      const alpha = Math.min(0.72, 0.08 + point.heat * 0.42) * point.depth;
      context.fillStyle = point.heat > 0.7
        ? `rgba(243, 198, 108, ${alpha})`
        : `rgba(164, 185, 184, ${alpha * 0.65})`;
      context.beginPath();
      context.arc(x, y, point.size, 0, tau);
      context.fill();
    });
    context.restore();
  }

  function horizon(time) {
    const x = centerX + pointerX * 0.012;
    const y = centerY + pointerY * 0.012;
    context.save();

    const lens = context.createRadialGradient(x, y, radius * 0.76, x, y, radius * 1.36);
    lens.addColorStop(0, "rgba(0,0,0,1)");
    lens.addColorStop(0.72, "rgba(0,0,0,1)");
    lens.addColorStop(0.82, "rgba(244,210,132,0.85)");
    lens.addColorStop(0.88, "rgba(217,164,65,0.16)");
    lens.addColorStop(1, "rgba(0,0,0,0)");
    context.fillStyle = lens;
    context.beginPath();
    context.arc(x, y, radius * 1.38, 0, tau);
    context.fill();

    context.globalCompositeOperation = "lighter";
    context.strokeStyle = `rgba(244, 224, 176, ${0.2 + Math.sin(time * 0.0006) * 0.04})`;
    context.lineWidth = 1;
    context.beginPath();
    context.ellipse(x, y, radius * 1.12, radius * 0.36, -0.28, Math.PI * 0.06, Math.PI * 0.94);
    context.stroke();

    context.globalCompositeOperation = "source-over";
    const core = context.createRadialGradient(x - radius * 0.18, y - radius * 0.2, 0, x, y, radius);
    core.addColorStop(0, "#05080a");
    core.addColorStop(0.58, "#000");
    core.addColorStop(1, "rgba(0,0,0,0.98)");
    context.fillStyle = core;
    context.beginPath();
    context.arc(x, y, radius * 0.98, 0, tau);
    context.fill();
    context.restore();
  }

  function vignette() {
    const gradient = context.createRadialGradient(width * 0.5, height * 0.45, 0, width * 0.5, height * 0.45, Math.max(width, height) * 0.78);
    gradient.addColorStop(0.35, "rgba(0,0,0,0)");
    gradient.addColorStop(1, "rgba(0,0,0,0.72)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
  }

  function render(time) {
    if (!running) return;
    background();
    stars(time);
    accretion(time);
    horizon(time);
    vignette();
    frame = window.requestAnimationFrame(render);
  }

  function pointer(event) {
    pointerX += (event.clientX - width / 2 - pointerX) * 0.08;
    pointerY += (event.clientY - height / 2 - pointerY) * 0.08;
  }

  function pause() {
    running = false;
    window.cancelAnimationFrame(frame);
  }

  function resume() {
    if (running) return;
    running = true;
    frame = window.requestAnimationFrame(render);
  }

  window.addEventListener("resize", resize, { passive: true });
  window.addEventListener("pointermove", pointer, { passive: true });
  document.addEventListener("visibilitychange", () => document.hidden ? pause() : resume());
  reducedMotion.addEventListener("change", resetParticles);
  compact.addEventListener("change", resize);

  resize();
  frame = window.requestAnimationFrame(render);
  window.MobleyBlackhole = { pause, resume, resize };
})();

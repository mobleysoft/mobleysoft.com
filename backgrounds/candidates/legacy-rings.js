(() => {
  "use strict";

  const canvas = document.getElementById("blackhole-canvas");
  const context = canvas.getContext("2d");
  let time = 0;

  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(window.innerWidth * ratio);
    canvas.height = Math.floor(window.innerHeight * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function animate() {
    context.fillStyle = "rgba(4, 4, 10, 0.1)";
    context.fillRect(0, 0, window.innerWidth, window.innerHeight);

    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    for (let index = 0; index < 20; index += 1) {
      const radius = 50 + index * 60 + Math.sin(time * 0.001 + index) * 20;
      context.strokeStyle = `rgba(240, 184, 0, ${0.05 - index * 0.002})`;
      context.lineWidth = 2;
      context.beginPath();
      context.arc(centerX, centerY, radius, 0, Math.PI * 2);
      context.stroke();
    }

    time += 1;
    window.requestAnimationFrame(animate);
  }

  window.addEventListener("resize", resize, { passive: true });
  resize();
  animate();
})();

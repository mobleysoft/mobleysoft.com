import { fingerprintSimulationState } from "./engine/fingerprint.mjs";
import { InputRecorder } from "./engine/recorder.mjs";
import { FixedStepEngine } from "./engine/runtime.mjs";
import { BrowserSessionRepository } from "./platform/browser/session-repository.mjs";
import { EventwakeWorldView } from "./presentation/world-view.mjs";

const RELEASE = "eventwake-slice-r3";
const EMPTY_INPUT = Object.freeze({
  bank: 0,
  fire: false,
  pitch: 0,
  reverse: false,
  scan: false,
  source: "idle",
  thrust: false,
});

function emit(name, detail) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

function waitForCanonical(timeout = 5000) {
  if (window.MobleyCanonicalBridge?.ready) return Promise.resolve(window.MobleyCanonicalBridge);
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      window.removeEventListener("mobley:canonical-ready", onReady);
      reject(new Error("The canonical anomaly renderer did not initialize."));
    }, timeout);
    function onReady() {
      window.clearTimeout(timer);
      resolve(window.MobleyCanonicalBridge);
    }
    window.addEventListener("mobley:canonical-ready", onReady, { once: true });
  });
}

async function initialize() {
  const canvas = document.getElementById("encounter-canvas");
  const THREE = window.THREE;
  if (!canvas || !THREE) throw new Error("EVENTWAKE requires Three.js and the encounter canvas.");

  const canonical = await waitForCanonical();
  canonical.seal();

  const compact = window.matchMedia("(max-width: 720px), (pointer: coarse)");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 2400);
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: !compact.matches,
    canvas,
    powerPreference: "high-performance",
    premultipliedAlpha: false,
  });
  renderer.setClearColor(0x000000, 0);
  renderer.outputEncoding = THREE.sRGBEncoding;

  scene.add(new THREE.AmbientLight(0x315064, 0.8));
  const keyLight = new THREE.DirectionalLight(0xffc36b, 1.2);
  keyLight.position.set(120, 90, 180);
  scene.add(keyLight);

  const worldView = new EventwakeWorldView({
    THREE,
    camera,
    canonicalCanvas: canonical.renderer.domElement,
    compact,
    scene,
  });

  let engine;
  let frameHandle = 0;
  let lastFrameAt = performance.now();
  let lastTelemetryAt = -Infinity;
  let hiddenWasPlaying = false;
  let contextWasPlaying = false;
  let contextLost = false;
  let input = { ...EMPTY_INPUT };
  let mode = "live";
  let playing = false;
  let qualityScale = 1;
  let renderElapsed = 0;
  let renderFrames = 0;
  let renderRate = 60;
  let replayTarget = null;
  let replayVerified = null;
  let speed = 1;
  const repository = new BrowserSessionRepository();
  let restoreCandidate = repository.loadActive();
  let lastSavedTick = -Infinity;

  function readLiveInput() {
    input = window.MobleyFlightInput?.read() || { ...EMPTY_INPUT, source: "unavailable" };
    return input;
  }

  function createLiveEngine() {
    mode = "live";
    replayTarget = null;
    replayVerified = null;
    input = { ...EMPTY_INPUT };
    let nextEngine;
    try {
      nextEngine = new FixedStepEngine({ inputProvider: readLiveInput, session: restoreCandidate });
    } catch (error) {
      console.warn("EVENTWAKE could not restore its active session:", error);
      nextEngine = new FixedStepEngine({ inputProvider: readLiveInput });
    }
    restoreCandidate = null;
    return nextEngine;
  }

  engine = createLiveEngine();

  function resize() {
    const cap = compact.matches ? 1.2 : 1.6;
    const ratio = reducedMotion.matches ? 1 : Math.min(devicePixelRatio || 1, cap) * qualityScale;
    renderer.setPixelRatio(Math.max(0.7, ratio));
    renderer.setSize(innerWidth, innerHeight, false);
  }

  function syncCamera() {
    const source = canonical.camera;
    camera.position.copy(source.position);
    camera.quaternion.copy(source.quaternion);
    camera.scale.copy(source.scale);
    camera.projectionMatrix.copy(source.projectionMatrix);
    if (camera.projectionMatrixInverse && source.projectionMatrixInverse) {
      camera.projectionMatrixInverse.copy(source.projectionMatrixInverse);
    }
    camera.updateMatrixWorld(true);
  }

  function renderState(alpha, delta) {
    const previous = engine.previousState || engine.state;
    syncCamera();
    worldView.render(previous, engine.state, alpha, delta, input);
    const interior = playing && (engine.state.scene === "interior" || engine.state.scene === "forking");
    document.body.classList.toggle("eventwake-interior", interior);
    document.body.classList.toggle("eventwake-crossing", playing && engine.state.scene === "crossing");
    document.body.dataset.eventwakeScene = engine.state.scene;
    renderer.render(scene, camera);
  }

  function updatePerformance(delta) {
    renderElapsed += delta;
    renderFrames += 1;
    if (renderElapsed < 2) return;
    renderRate = renderFrames / renderElapsed;
    const previousQuality = qualityScale;
    if (renderRate < 38) qualityScale = Math.max(0.58, qualityScale - 0.12);
    else if (renderRate > 56) qualityScale = Math.min(1, qualityScale + 0.05);
    renderElapsed = 0;
    renderFrames = 0;
    if (qualityScale !== previousQuality) resize();
  }

  function stateDetail() {
    return {
      elapsed: engine.state.time,
      mode,
      playing,
      release: RELEASE,
      replayVerified,
      speed,
      tick: engine.state.tick,
    };
  }

  function telemetryDetail() {
    const metrics = engine.state.metrics;
    return {
      contextLost,
      distance: metrics.distance,
      droppedTime: engine.droppedTime,
      flightState: metrics.flightState,
      fps: renderRate,
      inputSource: mode === "replay" ? "replay" : input.source,
      observation: engine.state.scan.lastObservation,
      objective: engine.state.mission.objective,
      phaseLock: metrics.phaseLock,
      quality: qualityScale,
      radialVelocity: metrics.radialVelocity,
      branchCount: engine.state.timeline.branches.length,
      replayVerified,
      scanDiscoveries: engine.state.scan.discoveries.length,
      scanTotal: engine.content.scan.discoveries.length,
      scene: engine.state.scene,
      tangentialSpeed: metrics.tangentialSpeed,
      temporalOffset: metrics.temporalOffset,
      throttle: input.thrust ? 1 : (input.reverse ? -1 : 0),
      tick: engine.state.tick,
      velocity: metrics.speed,
    };
  }

  function emitState() {
    emit("mobley:blackhole-state", stateDetail());
  }

  function emitTelemetry(force = false) {
    if (!force && engine.state.time - lastTelemetryAt < 0.15) return;
    lastTelemetryAt = engine.state.time;
    emit("mobley:flight-telemetry", telemetryDetail());
  }

  function persist(active = true) {
    try {
      const session = engine.exportSession();
      const fingerprint = fingerprintSimulationState(engine.state);
      if (active && engine.state.mission.status === "active") repository.saveActive(session);
      else repository.archive(session, fingerprint);
      lastSavedTick = engine.state.tick;
    } catch (error) {
      console.warn("EVENTWAKE persistence is unavailable:", error);
    }
  }

  function finishReplay() {
    if (!replayTarget || engine.state.tick < replayTarget.tick) return false;
    replayVerified = fingerprintSimulationState(engine.state) === replayTarget.fingerprint;
    playing = false;
    window.MobleyFlightInput?.setActive(false);
    canvas.classList.remove("is-active");
    document.body.classList.remove("eventwake-crossing", "eventwake-interior");
    emitState();
    emitTelemetry(true);
    return true;
  }

  function frame(timestamp) {
    if (!playing || contextLost) return;
    const wallDelta = Math.min(0.2, Math.max(0, (timestamp - lastFrameAt) / 1000));
    lastFrameAt = timestamp;
    const result = engine.advance(wallDelta * speed);
    worldView.handleEvents(result.events, engine.state);
    result.events.forEach((event) => {
      if (mode !== "live") return;
      if (event.type === "mission-complete" || event.type === "mission-failed") persist(false);
      else if ((event.type === "branch-created" || event.type === "persistence-requested")
        && engine.state.mission.status === "active") persist();
    });
    if (mode === "live" && engine.state.mission.status === "active" && engine.state.tick - lastSavedTick >= 300) persist();
    updatePerformance(wallDelta);
    renderState(result.alpha, wallDelta);
    emitTelemetry();
    if (mode === "replay" && finishReplay()) return;
    frameHandle = requestAnimationFrame(frame);
  }

  function play() {
    if (playing || contextLost) return;
    if (mode === "replay" && replayTarget && engine.state.tick >= replayTarget.tick) {
      mode = "live";
      engine.inputProvider = readLiveInput;
    }
    playing = true;
    lastFrameAt = performance.now();
    canvas.classList.add("is-active");
    window.MobleyFlightInput?.setActive(mode === "live");
    frameHandle = requestAnimationFrame(frame);
    emitState();
    emitTelemetry(true);
  }

  function pause() {
    if (!playing) return;
    playing = false;
    cancelAnimationFrame(frameHandle);
    window.MobleyFlightInput?.setActive(false);
    canvas.classList.remove("is-active");
    document.body.classList.remove("eventwake-crossing", "eventwake-interior");
    emitState();
    emitTelemetry(true);
    if (mode === "live" && engine.state.tick > 0) persist(engine.state.mission.status === "active");
  }

  function restart() {
    const shouldResume = playing;
    playing = false;
    cancelAnimationFrame(frameHandle);
    worldView.clearTransient();
    repository.clearActive();
    restoreCandidate = null;
    engine = createLiveEngine();
    lastTelemetryAt = -Infinity;
    renderElapsed = 0;
    renderFrames = 0;
    emitState();
    emitTelemetry(true);
    if (shouldResume) play();
  }

  function replay() {
    const entries = engine.recorder.export();
    if (engine.state.tick === 0 || entries.length === 0) {
      restart();
      play();
      return;
    }
    const recorded = new InputRecorder().load(entries);
    replayTarget = {
      fingerprint: fingerprintSimulationState(engine.state),
      tick: engine.state.tick,
    };
    engine = new FixedStepEngine({ inputProvider: (state) => recorded.inputAt(state.tick) });
    input = { ...EMPTY_INPUT, source: "replay" };
    mode = "replay";
    replayVerified = null;
    lastTelemetryAt = -Infinity;
    worldView.clearTransient();
    playing = false;
    play();
  }

  function toggle() {
    if (playing) pause();
    else play();
  }

  function setSpeed(nextSpeed) {
    speed = Math.max(0.25, Math.min(2, Number(nextSpeed) || 1));
    emitState();
  }

  addEventListener("resize", resize, { passive: true });
  window.visualViewport?.addEventListener("resize", resize, { passive: true });
  addEventListener("orientationchange", () => window.setTimeout(resize, 120), { passive: true });
  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    contextWasPlaying = playing;
    contextLost = true;
    document.body.classList.add("webgl-context-lost");
    pause();
    emitTelemetry(true);
  });
  canvas.addEventListener("webglcontextrestored", () => {
    contextLost = false;
    document.body.classList.remove("webgl-context-lost");
    resize();
    if (contextWasPlaying) {
      contextWasPlaying = false;
      play();
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      hiddenWasPlaying = playing;
      pause();
    } else if (hiddenWasPlaying) {
      hiddenWasPlaying = false;
      play();
    }
  });
  addEventListener("pagehide", () => {
    if (mode === "live" && engine.state.tick > 0) persist(engine.state.mission.status === "active");
    pause();
  }, { passive: true });

  window.MobleyBlackhole = Object.freeze({
    fire: () => false,
    getDiagnostics: () => ({
      ...telemetryDetail(),
      canonicalHash: canonical.canonicalHash,
      canonicalReady: canonical.ready,
      craft: {
        attitude: { ...engine.state.craft.attitude },
        position: [...engine.state.craft.position],
        velocity: [...engine.state.craft.velocity],
      },
      fixedStep: engine.fixedStep,
      input: window.MobleyFlightInput?.diagnostics() || null,
      inputEvents: engine.recorder.export().length,
      mission: { ...engine.state.mission },
      persistence: repository.diagnostics(),
      rendererSeparated: canonical.renderer !== renderer,
      scene: engine.state.scene,
      scan: structuredClone(engine.state.scan),
      stateFingerprint: fingerprintSimulationState(engine.state),
      timeline: structuredClone(engine.state.timeline),
    }),
    getState: stateDetail,
    pause,
    play,
    release: RELEASE,
    replay,
    restart,
    setSpeed,
    toggle,
  });

  resize();
  syncCamera();
  renderState(0, 0);
  emit("mobley:blackhole-ready", {
    canonicalHash: canonical.canonicalHash,
    release: RELEASE,
    rendererSeparated: canonical.renderer !== renderer,
  });
}

initialize().catch((error) => {
  console.error("EVENTWAKE engine failed:", error);
  emit("mobley:blackhole-error", { message: error.message, release: RELEASE });
});

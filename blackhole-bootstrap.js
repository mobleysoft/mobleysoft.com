(() => {
  "use strict";

  // Runtime compatibility belongs outside the immutable canonical renderer.
  window.isMobile = window.matchMedia("(max-width: 720px), (pointer: coarse)").matches;

  const THREE = window.THREE;
  if (!THREE) return;

  const originals = new Map();
  let readyQueued = false;

  const bridge = {
    camera: null,
    canonicalHash: "417b9edc4e6e4c9c8857d96bbebb6ad305a516421b92e034b43a9c3627fe9f6d",
    release: "blackhole-a-20260522",
    renderer: null,
    scene: null,
    sealed: false,
    get ready() {
      return Boolean(this.camera && this.renderer && this.scene);
    },
    seal() {
      if (this.sealed) return;
      originals.forEach((Original, name) => {
        THREE[name] = Original;
      });
      this.sealed = true;
    },
  };

  function publishWhenReady() {
    if (!bridge.ready || readyQueued) return;
    readyQueued = true;
    const publish = () => {
      bridge.seal();
      window.dispatchEvent(new CustomEvent("mobley:canonical-ready", {
        detail: { hash: bridge.canonicalHash, release: bridge.release },
      }));
    };
    if (typeof queueMicrotask === "function") queueMicrotask(publish);
    else Promise.resolve().then(publish);
  }

  function observeConstructor(name, key) {
    const Original = THREE[name];
    if (typeof Original !== "function") return;
    function ObservedConstructor(...args) {
      const instance = Reflect.construct(Original, args, Original);
      if (!bridge[key]) bridge[key] = instance;
      publishWhenReady();
      return instance;
    }
    Object.setPrototypeOf(ObservedConstructor, Original);
    ObservedConstructor.prototype = Original.prototype;
    originals.set(name, Original);
    THREE[name] = ObservedConstructor;
  }

  observeConstructor("Scene", "scene");
  observeConstructor("PerspectiveCamera", "camera");
  observeConstructor("WebGLRenderer", "renderer");
  window.MobleyCanonicalBridge = bridge;
})();

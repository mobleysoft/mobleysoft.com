(() => {
  "use strict";

  const state = {
    manifest: null,
    selected: -1,
    activated: 0,
    verified: new Set(),
    running: false,
    timer: 0,
  };

  const elements = {
    run: document.getElementById("run-chain"),
    advance: document.getElementById("advance-stage"),
    track: document.getElementById("stage-track"),
    activationCount: document.getElementById("activation-count"),
    activationMessage: document.getElementById("activation-message"),
    position: document.getElementById("artifact-position"),
    title: document.getElementById("artifact-title"),
    raw: document.getElementById("raw-artifact"),
    canvas: document.getElementById("artifact-canvas"),
    contract: document.getElementById("lineage-contract"),
    input: document.getElementById("lineage-input"),
    inputHash: document.getElementById("lineage-input-hash"),
    output: document.getElementById("lineage-output"),
    outputHash: document.getElementById("lineage-output-hash"),
    integrityCount: document.getElementById("integrity-count"),
    integrityStatus: document.getElementById("integrity-status"),
    dial: document.querySelector(".proof-dial"),
    boundary: document.getElementById("claim-boundary"),
    runtime: document.getElementById("runtime-status"),
    playMaster: document.getElementById("play-master"),
    masterFrame: document.getElementById("master-frame"),
    masterNumber: document.getElementById("master-number"),
    masterStage: document.getElementById("master-stage"),
    masterProduct: document.getElementById("master-product"),
    masterProgress: document.getElementById("master-progress"),
    audio: document.getElementById("master-audio"),
  };

  function shortHash(value) {
    return value ? `${value.slice(0, 10)}...${value.slice(-8)}` : "Not available";
  }

  function basename(path) {
    return path.split("/").filter(Boolean).pop() || path;
  }

  async function digest(buffer) {
    const value = await crypto.subtle.digest("SHA-256", buffer);
    return [...new Uint8Array(value)].map(byte => byte.toString(16).padStart(2, "0")).join("");
  }

  async function fetchBytes(path) {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) throw new Error(`${path} returned ${response.status}`);
    return response.arrayBuffer();
  }

  function artifactList(manifest) {
    return [
      manifest.source,
      ...manifest.stages.flatMap(stage => [stage.output, ...stage.supplemental_outputs]),
    ];
  }

  async function verifyArtifacts() {
    const artifacts = artifactList(state.manifest);
    let passed = 0;
    await Promise.all(artifacts.map(async artifact => {
      const actual = await digest(await fetchBytes(artifact.path));
      if (actual !== artifact.sha256) throw new Error(`Hash mismatch: ${artifact.path}`);
      state.verified.add(artifact.path);
      passed += 1;
      elements.integrityCount.textContent = `${passed}/${artifacts.length}`;
    }));
    elements.integrityStatus.textContent = "Edge bytes match lineage manifest";
    elements.dial.classList.add("is-verified");
    elements.runtime.textContent = "Canary verified";
    [...elements.track.children].forEach((node, index) => {
      node.classList.toggle("is-integrity-verified", state.verified.has(state.manifest.stages[index].output.path));
    });
  }

  function renderTrack() {
    elements.track.replaceChildren();
    state.manifest.stages.forEach((stage, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "stage-node";
      button.dataset.index = String(index);
      const number = document.createElement("b");
      const label = document.createElement("span");
      const domain = document.createElement("small");
      number.textContent = String(stage.position).padStart(2, "0");
      label.textContent = stage.stage;
      domain.textContent = stage.domain;
      button.append(number, label, domain);
      button.addEventListener("click", () => inspectStage(index));
      elements.track.appendChild(button);
    });
  }

  function summarizeObject(payload) {
    const candidates = [
      ["Status", payload.status],
      ["Artifact", payload.artifact_kind || payload.title || payload.event],
      ["Purpose", payload.logline || payload.purpose || payload.objective || payload.message],
      ["Delivery", payload.landing_page || payload.play_url || payload.delivery?.url || payload.format],
    ].filter(([, value]) => value);
    const summary = document.createElement("div");
    summary.className = "artifact-summary";
    candidates.slice(0, 4).forEach(([label, value]) => {
      const cell = document.createElement("div");
      const key = document.createElement("span");
      const content = document.createElement("strong");
      key.textContent = label;
      content.textContent = typeof value === "string" ? value : JSON.stringify(value);
      cell.append(key, content);
      summary.appendChild(cell);
    });
    const raw = document.createElement("pre");
    raw.textContent = JSON.stringify(payload, null, 2);
    summary.appendChild(raw);
    return summary;
  }

  async function renderArtifact(path) {
    elements.canvas.replaceChildren();
    const loading = document.createElement("p");
    loading.className = "loading";
    loading.textContent = "Reading artifact from the edge...";
    elements.canvas.appendChild(loading);
    try {
      if (path.endsWith(".svg")) {
        const image = document.createElement("img");
        image.src = path;
        image.alt = path.includes("storyboard") ? "Nine-frame storyboard for The Handoff" : "Nine-station spatial production layout";
        await image.decode();
        elements.canvas.replaceChildren(image);
        return;
      }
      const response = await fetch(path, { cache: "no-store" });
      if (!response.ok) throw new Error(`artifact returned ${response.status}`);
      const text = await response.text();
      if (path.endsWith(".json")) {
        elements.canvas.replaceChildren(summarizeObject(JSON.parse(text)));
      } else {
        const pre = document.createElement("pre");
        pre.textContent = text;
        elements.canvas.replaceChildren(pre);
      }
    } catch (error) {
      loading.textContent = `Artifact unavailable: ${error.message}`;
    }
  }

  function updateNodeStates() {
    [...elements.track.children].forEach((node, index) => {
      node.classList.toggle("is-selected", index === state.selected);
      node.classList.toggle("is-activated", index < state.activated);
    });
    elements.activationCount.textContent = `${state.activated} / ${state.manifest.stage_count}`;
    elements.advance.disabled = state.activated >= state.manifest.stage_count;
    elements.advance.innerHTML = state.activated >= state.manifest.stage_count
      ? "Chain complete <span aria-hidden=\"true\">&#10003;</span>"
      : "Activate next handoff <span aria-hidden=\"true\">&rarr;</span>";
  }

  function inspectStage(index) {
    if (!state.manifest) return;
    state.selected = Math.max(0, Math.min(index, state.manifest.stages.length - 1));
    const stage = state.manifest.stages[state.selected];
    elements.position.textContent = `${String(stage.position).padStart(2, "0")} / ${stage.stage.toUpperCase()}`;
    elements.title.textContent = `${stage.product}: ${basename(stage.output.path)}`;
    elements.raw.href = stage.output.path;
    elements.contract.textContent = stage.domain;
    elements.input.textContent = basename(stage.input.path);
    elements.inputHash.textContent = shortHash(stage.input.sha256);
    elements.output.textContent = basename(stage.output.path);
    elements.outputHash.textContent = shortHash(stage.output.sha256);
    updateNodeStates();
    renderArtifact(stage.output.path);
  }

  function activateNext() {
    if (!state.manifest || state.activated >= state.manifest.stage_count) return false;
    const stage = state.manifest.stages[state.activated];
    state.activated += 1;
    inspectStage(state.activated - 1);
    elements.activationMessage.textContent = state.activated === state.manifest.stage_count
      ? `Chain complete. Final campaign hash ${shortHash(state.manifest.final_output_sha256)}.`
      : `${stage.domain} produced ${basename(stage.output.path)}. ${state.manifest.stages[state.activated].domain} is unlocked.`;
    return true;
  }

  function stopRun() {
    window.clearInterval(state.timer);
    state.timer = 0;
    state.running = false;
    elements.run.textContent = "Run all nine handoffs";
  }

  function runChain() {
    if (!state.manifest) return;
    if (state.running) return stopRun();
    state.activated = 0;
    state.selected = -1;
    updateNodeStates();
    state.running = true;
    elements.run.textContent = "Pause handoff run";
    document.getElementById("play").scrollIntoView({ behavior: "smooth", block: "start" });
    activateNext();
    state.timer = window.setInterval(() => {
      if (!activateNext()) stopRun();
    }, 900);
  }

  function setMasterFrame(index) {
    const stage = state.manifest.stages[Math.max(0, Math.min(index, 8))];
    elements.masterNumber.textContent = String(stage.position).padStart(2, "0");
    elements.masterStage.textContent = stage.stage;
    elements.masterProduct.textContent = stage.product;
  }

  function updateMaster() {
    if (elements.audio.paused) return;
    const progress = Math.min(1, elements.audio.currentTime / 12);
    const index = Math.min(8, Math.floor(progress * 9));
    setMasterFrame(index);
    elements.masterProgress.style.width = `${progress * 100}%`;
    requestAnimationFrame(updateMaster);
  }

  async function toggleMaster() {
    if (!state.manifest) return;
    if (!elements.audio.paused) {
      elements.audio.pause();
      elements.masterFrame.classList.remove("is-playing");
      elements.playMaster.textContent = "Resume 12-second master";
      return;
    }
    if (elements.audio.ended || elements.audio.currentTime >= 11.95) elements.audio.currentTime = 0;
    await elements.audio.play();
    elements.masterFrame.classList.add("is-playing");
    elements.playMaster.textContent = "Pause master";
    requestAnimationFrame(updateMaster);
  }

  async function initialize() {
    const response = await fetch("/showbiz/canary/manifest.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`manifest returned ${response.status}`);
    const manifest = await response.json();
    if (manifest.stage_count !== 9 || manifest.stages.length !== 9) throw new Error("manifest stage contract failed");
    state.manifest = manifest;
    elements.boundary.textContent = manifest.claim_boundary;
    renderTrack();
    updateNodeStates();
    elements.runtime.textContent = "Verifying edge artifacts";
    elements.integrityStatus.textContent = `Checking ${artifactList(manifest).length} edge artifacts`;
    const source = await (await fetch(manifest.source.path, { cache: "no-store" })).json();
    elements.canvas.replaceChildren(summarizeObject(source));
    elements.inputHash.textContent = shortHash(manifest.source.private_evidence_sha256);
    elements.outputHash.textContent = shortHash(manifest.source.sha256);
    await verifyArtifacts();
    window.__SHOWBIZ_CANARY_READY__ = true;
  }

  elements.run.addEventListener("click", runChain);
  elements.advance.addEventListener("click", activateNext);
  elements.playMaster.addEventListener("click", () => toggleMaster().catch(error => {
    elements.runtime.textContent = `Audio unavailable: ${error.message}`;
  }));
  elements.audio.addEventListener("ended", () => {
    elements.masterFrame.classList.remove("is-playing");
    elements.playMaster.textContent = "Replay 12-second master";
    elements.masterProgress.style.width = "100%";
  });

  document.addEventListener("keydown", event => {
    if (event.target instanceof HTMLButtonElement || event.target instanceof HTMLAnchorElement) return;
    if (["Space", "ArrowRight"].includes(event.code)) {
      event.preventDefault();
      activateNext();
    } else if (event.code === "ArrowLeft" && state.manifest) {
      event.preventDefault();
      inspectStage(Math.max(0, state.selected - 1));
    }
  });

  initialize().catch(error => {
    elements.integrityStatus.textContent = error.message;
    elements.runtime.textContent = "Canary verification failed";
    document.documentElement.dataset.canary = "failed";
  });
})();

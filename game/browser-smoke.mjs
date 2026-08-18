import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const TARGET = "https://mobleysoft.com/?encounter=eventwake";

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function waitForTarget(port, timeout = 10000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json`);
      const targets = await response.json();
      const page = targets.find((target) => target.type === "page");
      if (page) return page;
    } catch {
      // Chrome may not have opened its debugging socket yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Chrome did not expose the EVENTWAKE page in time.");
}

class CdpClient {
  constructor(url) {
    this.nextId = 0;
    this.pending = new Map();
    this.socket = new WebSocket(url);
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (!message.id || !this.pending.has(message.id)) return;
      const { reject, resolve } = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result || {});
    });
  }

  ready() {
    if (this.socket.readyState === WebSocket.OPEN) return Promise.resolve();
    return new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
  }

  call(method, params = {}) {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { reject, resolve });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const result = await this.call("Runtime.evaluate", {
      awaitPromise: true,
      expression,
      returnByValue: true,
    });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  }

  close() {
    this.socket.close();
  }
}

async function key(client, type, code, keyValue, virtualKey) {
  await client.call("Input.dispatchKeyEvent", {
    code,
    key: keyValue,
    nativeVirtualKeyCode: virtualKey,
    type,
    windowsVirtualKeyCode: virtualKey,
  });
}

async function touch(client, type, points = []) {
  await client.call("Input.dispatchTouchEvent", {
    touchPoints: points.map((point, index) => ({
      id: point.id ?? index,
      radiusX: 5,
      radiusY: 5,
      x: point.x,
      y: point.y,
    })),
    type,
  });
}

async function run() {
  const port = await freePort();
  const profile = await mkdtemp(path.join(os.tmpdir(), "eventwake-smoke-"));
  const chrome = spawn(CHROME, [
    "--headless=new",
    "--disable-background-networking",
    "--disable-breakpad",
    "--disable-component-update",
    "--disable-default-apps",
    "--disable-extensions",
    "--disable-sync",
    "--enable-unsafe-swiftshader",
    "--ignore-certificate-errors",
    "--no-first-run",
    "--no-proxy-server",
    "--host-resolver-rules=MAP mobleysoft.com 127.0.0.1",
    "--remote-allow-origins=*",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    "--window-size=1440,1000",
    TARGET,
  ], { stdio: "ignore" });
  let client;

  try {
    const target = await waitForTarget(port);
    client = new CdpClient(target.webSocketDebuggerUrl);
    await client.ready();
    await client.call("Runtime.enable");
    await client.call("Page.enable");
    await new Promise((resolve) => setTimeout(resolve, 2500));

    const before = await client.evaluate("window.MobleyBlackhole && window.MobleyBlackhole.getDiagnostics()");
    assert.ok(before, "engine API must initialize");
    assert.equal(before.canonicalReady, true);
    assert.equal(before.rendererSeparated, true);
    assert.equal(before.fixedStep, 1 / 60);

    await key(client, "keyDown", "KeyE", "e", 69);
    const desktopScan = await client.evaluate("window.MobleyFlightInput.read()");
    assert.equal(desktopScan.scan, true);
    assert.equal(desktopScan.source, "keyboard");
    await key(client, "keyUp", "KeyE", "e", 69);

    await key(client, "keyDown", "Space", " ", 32);
    await new Promise((resolve) => setTimeout(resolve, 750));
    const thrust = await client.evaluate("window.MobleyBlackhole.getDiagnostics()");
    assert.ok(thrust.velocity > before.velocity + 10, "held thrust must materially increase speed");
    assert.equal(thrust.inputSource, "keyboard");

    await key(client, "keyDown", "KeyW", "w", 87);
    await key(client, "keyDown", "KeyA", "a", 65);
    await new Promise((resolve) => setTimeout(resolve, 550));
    const turn = await client.evaluate("window.MobleyBlackhole.getDiagnostics()");
    assert.ok(turn.craft.attitude.pitch < before.craft.attitude.pitch - 0.2);
    assert.ok(turn.craft.attitude.roll < before.craft.attitude.roll - 0.2);
    if (process.env.EVENTWAKE_SCREENSHOT) {
      const flightFrame = await client.call("Page.captureScreenshot", { format: "png" });
      assert.ok(flightFrame.data.length > 100000, "flight screenshot must contain substantial image data");
      await writeFile(process.env.EVENTWAKE_SCREENSHOT, Buffer.from(flightFrame.data, "base64"));
    }
    await key(client, "keyUp", "KeyA", "a", 65);
    await key(client, "keyUp", "KeyW", "w", 87);
    await key(client, "keyUp", "Space", " ", 32);

    await client.evaluate("window.MobleyBlackhole.pause()");
    const pausedTick = await client.evaluate("window.MobleyBlackhole.getState().tick");
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.equal(await client.evaluate("window.MobleyBlackhole.getState().tick"), pausedTick);

    await client.evaluate("window.MobleyBlackhole.replay()");
    const deadline = Date.now() + 8000;
    let replay;
    while (Date.now() < deadline) {
      replay = await client.evaluate("window.MobleyBlackhole.getState()");
      if (replay.replayVerified !== null) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.equal(replay?.replayVerified, true);
    assert.equal(await client.evaluate("document.getElementById('background-status').textContent"), "REPLAY VERIFIED");

    const screenshot = await client.call("Page.captureScreenshot", { format: "png" });
    assert.ok(screenshot.data.length > 100000, "rendered page screenshot must contain substantial image data");

    await client.call("Emulation.setDeviceMetricsOverride", {
      deviceScaleFactor: 3,
      height: 844,
      mobile: true,
      screenHeight: 844,
      screenWidth: 390,
      width: 390,
    });
    await client.call("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    await client.call("Page.reload", { ignoreCache: true });
    await new Promise((resolve) => setTimeout(resolve, 2500));

    const mobileBefore = await client.evaluate("window.MobleyBlackhole && window.MobleyBlackhole.getDiagnostics()");
    const mobileLayout = await client.evaluate(`(() => {
      const controls = document.getElementById("flight-controls");
      const shell = document.getElementById("site-shell");
      const thrust = document.querySelector('[data-flight-hold="thrust"]');
      const scan = document.querySelector('[data-flight-hold="scan"]');
      const rect = thrust.getBoundingClientRect();
      const scanRect = scan.getBoundingClientRect();
      return {
        controlsDisplay: getComputedStyle(controls).display,
        shellVisibility: getComputedStyle(shell).visibility,
        thrust: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
        scan: { x: scanRect.left + scanRect.width / 2, y: scanRect.top + scanRect.height / 2 },
        widthFits: document.documentElement.scrollWidth <= innerWidth + 1,
      };
    })()`);
    assert.ok(mobileBefore, "mobile engine API must initialize");
    assert.equal(mobileLayout.controlsDisplay, "flex");
    assert.equal(mobileLayout.shellVisibility, "hidden");
    assert.equal(mobileLayout.widthFits, true);

    await touch(client, "touchStart", [{ id: 2, ...mobileLayout.scan }]);
    const mobileScan = await client.evaluate("window.MobleyFlightInput.read()");
    await touch(client, "touchEnd");
    assert.equal(mobileScan.scan, true);
    assert.equal(mobileScan.source, "touch");

    await touch(client, "touchStart", [{ id: 1, ...mobileLayout.thrust }]);
    await new Promise((resolve) => setTimeout(resolve, 700));
    const mobileThrust = await client.evaluate("window.MobleyBlackhole.getDiagnostics()");
    await touch(client, "touchEnd");
    assert.equal(mobileThrust.inputSource, "touch");
    assert.ok(mobileThrust.velocity > mobileBefore.velocity + 8, "mobile held thrust must increase speed");
    if (process.env.EVENTWAKE_MOBILE_SCREENSHOT) {
      const mobileFrame = await client.call("Page.captureScreenshot", { format: "png" });
      await writeFile(process.env.EVENTWAKE_MOBILE_SCREENSHOT, Buffer.from(mobileFrame.data, "base64"));
    }
    await client.evaluate("window.MobleyBlackhole.pause()");

    return {
      canonicalReady: before.canonicalReady,
      fixedStep: before.fixedStep,
      pauseTick: pausedTick,
      rendererSeparated: before.rendererSeparated,
      replayVerified: replay.replayVerified,
      mobileInputSource: mobileThrust.inputSource,
      mobileScan: mobileScan.scan,
      mobileSpeedBefore: Number(mobileBefore.velocity.toFixed(3)),
      mobileSpeedUnderThrust: Number(mobileThrust.velocity.toFixed(3)),
      speedBefore: Number(before.velocity.toFixed(3)),
      speedUnderThrust: Number(thrust.velocity.toFixed(3)),
      desktopScan: desktopScan.scan,
    };
  } finally {
    client?.close();
    chrome.kill("SIGTERM");
    await Promise.race([
      new Promise((resolve) => chrome.once("exit", resolve)),
      new Promise((resolve) => setTimeout(resolve, 1500)),
    ]);
    if (chrome.exitCode === null) chrome.kill("SIGKILL");
    await rm(profile, { force: true, recursive: true });
  }
}

run()
  .then((result) => process.stdout.write(`${JSON.stringify(result, null, 2)}\n`))
  .catch((error) => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  });

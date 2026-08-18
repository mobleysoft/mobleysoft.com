import { forwardFromAttitude, lerp, lerpVector } from "../engine/math.mjs";
import { predictTrajectory } from "../engine/simulation.mjs";

function createWingGeometry(THREE) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array([
    0, 0, -7, -11, 0, 7, -2, 0, 5,
    0, 0, -7, 11, 0, 7, 2, 0, 5,
    -2, 0, 3, -6, 4, 8, -2, 0, 8,
    2, 0, 3, 6, 4, 8, 2, 0, 8,
  ]), 3));
  geometry.computeVertexNormals();
  return geometry;
}

function createShip(THREE, ghost = false) {
  const ship = new THREE.Group();
  const hullMaterial = new THREE.MeshPhongMaterial({
    color: ghost ? 0x17343a : 0x15242d,
    flatShading: true,
    opacity: ghost ? 0.72 : 1,
    shininess: 18,
    side: THREE.DoubleSide,
    transparent: ghost,
  });
  const edgeMaterial = new THREE.LineBasicMaterial({
    color: ghost ? 0x68e8ef : 0xf3c66c,
    opacity: ghost ? 0.72 : 0.86,
    transparent: true,
  });
  const body = new THREE.Mesh(new THREE.ConeGeometry(3.2, 20, 4, 1, false), hullMaterial);
  body.rotation.x = -Math.PI / 2;
  ship.add(body);

  const wings = createWingGeometry(THREE);
  ship.add(new THREE.Mesh(wings, hullMaterial));
  ship.add(new THREE.LineSegments(new THREE.EdgesGeometry(wings, 18), edgeMaterial));
  const cockpit = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.7, 1),
    new THREE.MeshBasicMaterial({ color: 0x68e8ef, opacity: ghost ? 0.5 : 0.82, transparent: true }),
  );
  cockpit.scale.set(0.78, 0.5, 1.7);
  cockpit.position.set(0, 1.5, -2.2);
  ship.add(cockpit);

  const engineMaterial = new THREE.MeshBasicMaterial({
    blending: THREE.AdditiveBlending,
    color: ghost ? 0x68e8ef : 0x5eead4,
    depthWrite: false,
    opacity: ghost ? 0.42 : 0.76,
    transparent: true,
  });
  ship.userData.engines = [-1.35, 1.35].map((x) => {
    const engine = new THREE.Mesh(new THREE.ConeGeometry(1.15, 7, 5), engineMaterial.clone());
    engine.rotation.x = Math.PI / 2;
    engine.position.set(x, -0.25, 11.2);
    ship.add(engine);
    return engine;
  });
  ship.rotation.order = "YXZ";
  ship.scale.setScalar(ghost ? 1.08 : 1.15);
  return ship;
}

function createTrajectory(THREE) {
  return new THREE.Line(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({
      blending: THREE.AdditiveBlending,
      color: 0x5eead4,
      depthWrite: false,
      opacity: 0.38,
      transparent: true,
    }),
  );
}

function createInteriorSkies(THREE, camera, canonicalCanvas) {
  const group = new THREE.Group();
  const texture = new THREE.CanvasTexture(canonicalCanvas);
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  const placements = [
    [[0, 0, -180], [0, 0, 0], 0.24],
    [[-115, 10, -230], [0, 0.52, 0.04], 0.16],
    [[115, -5, -235], [0, -0.52, -0.03], 0.18],
    [[0, 82, -220], [0.4, 0, 0.08], 0.13],
    [[0, -82, -225], [-0.4, 0, -0.08], 0.15],
    [[0, 0, 115], [0, Math.PI, 0], 0.1],
  ];
  for (const [position, rotation, opacity] of placements) {
    const material = new THREE.MeshBasicMaterial({
      blending: THREE.AdditiveBlending,
      color: 0xb9e6e8,
      depthWrite: false,
      map: texture,
      opacity,
      side: THREE.DoubleSide,
      transparent: true,
    });
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(132, 82, 1, 1), material);
    sky.position.set(...position);
    sky.rotation.set(...rotation);
    group.add(sky);
  }
  group.visible = false;
  camera.add(group);
  return { group, texture };
}

export class EventwakeWorldView {
  constructor({ THREE, camera, canonicalCanvas, compact, scene }) {
    this.THREE = THREE;
    this.camera = camera;
    this.compact = compact;
    this.scene = scene;
    this.player = createShip(THREE);
    this.trajectory = createTrajectory(THREE);
    this.echoes = new Map();
    this.projections = new Map();
    this.effects = [];
    this.lastTrajectoryTick = -Infinity;
    this.scanHalo = new THREE.Mesh(
      new THREE.RingGeometry(8, 8.7, 48),
      new THREE.MeshBasicMaterial({
        blending: THREE.AdditiveBlending,
        color: 0x68e8ef,
        depthWrite: false,
        opacity: 0.42,
        side: THREE.DoubleSide,
        transparent: true,
      }),
    );
    this.scanLink = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineDashedMaterial({ color: 0x68e8ef, dashSize: 6, gapSize: 3, opacity: 0.62, transparent: true }),
    );
    this.interior = createInteriorSkies(THREE, camera, canonicalCanvas);
    this.scanHalo.visible = false;
    this.scanLink.visible = false;
    scene.add(camera, this.player, this.trajectory, this.scanHalo, this.scanLink);
  }

  syncShip(mesh, craft, input = {}) {
    mesh.position.set(...craft.position);
    mesh.rotation.set(craft.attitude.pitch, craft.attitude.yaw, -craft.attitude.roll, "YXZ");
    const engineScale = input.thrust ? 1.8 : (input.reverse ? 0.45 : 0.78);
    mesh.userData.engines.forEach((flame) => {
      flame.scale.y += (engineScale - flame.scale.y) * 0.18;
      flame.material.color.setHex(input.reverse ? 0xf3c66c : 0x5eead4);
    });
  }

  syncEchoes(state) {
    const active = new Set();
    for (const echo of state.echoes) {
      active.add(echo.id);
      let mesh = this.echoes.get(echo.id);
      if (!mesh) {
        mesh = createShip(this.THREE, true);
        this.echoes.set(echo.id, mesh);
        this.scene.add(mesh);
      }
      this.syncShip(mesh, echo.craft);
      mesh.visible = true;
    }
    for (const [id, mesh] of this.echoes) {
      if (active.has(id)) continue;
      mesh.visible = false;
    }
  }

  syncProjections(state) {
    const active = new Set();
    const visible = state.scene === "exterior";
    for (const projection of state.scan.projections || []) {
      active.add(projection.id);
      let mesh = this.projections.get(projection.id);
      if (!mesh) {
        mesh = createShip(this.THREE, true);
        mesh.traverse((child) => {
          if (!child.material?.color) return;
          child.material = child.material.clone();
          child.material.color.setHex(0xff6644);
          child.material.opacity = 0.34;
          child.material.transparent = true;
          child.material.depthWrite = false;
        });
        this.projections.set(projection.id, mesh);
        this.scene.add(mesh);
      }
      mesh.position.set(...projection.position);
      mesh.rotation.set(0.8, state.tick * 0.002, 1.1, "YXZ");
      mesh.visible = visible;
    }
    for (const [id, mesh] of this.projections) {
      if (!active.has(id) || !visible) mesh.visible = false;
    }
  }

  updateTrajectory(state) {
    const visible = ["exterior", "past-exterior"].includes(state.scene);
    this.trajectory.visible = visible;
    if (!visible || state.tick - this.lastTrajectoryTick < 18) return;
    const points = predictTrajectory(state, this.compact.matches ? 90 : 180)
      .map((point) => new this.THREE.Vector3(...point));
    this.trajectory.geometry.dispose();
    this.trajectory.geometry = new this.THREE.BufferGeometry().setFromPoints(points);
    this.lastTrajectoryTick = state.tick;
  }

  updateScan(state) {
    this.scanHalo.visible = state.scan.active;
    if (state.scan.active) {
      this.scanHalo.position.set(...state.craft.position);
      this.scanHalo.quaternion.copy(this.camera.quaternion);
      const pulse = 1 + Math.sin(state.tick * 0.24) * 0.12;
      this.scanHalo.scale.setScalar(pulse);
    }
    const echo = state.echoes[0];
    this.scanLink.visible = Boolean(state.scan.active && echo);
    if (this.scanLink.visible) {
      this.scanLink.geometry.dispose();
      this.scanLink.geometry = new this.THREE.BufferGeometry().setFromPoints([
        new this.THREE.Vector3(...state.craft.position),
        new this.THREE.Vector3(...echo.craft.position),
      ]);
      this.scanLink.computeLineDistances();
    }
  }

  updateInterior(state) {
    const visible = state.scene === "interior" || state.scene === "forking";
    this.interior.group.visible = visible;
    if (!visible) return;
    this.interior.texture.needsUpdate = true;
    this.interior.group.rotation.z = (state.metrics.temporalOffset || 0) * 0.0008;
    this.interior.group.scale.setScalar(1 + Math.min(0.35, Math.abs(state.interior.velocity) / 180));
  }

  createPulse(craft) {
    if (!craft) return;
    const origin = new this.THREE.Vector3(...craft.position);
    const direction = new this.THREE.Vector3(...forwardFromAttitude(craft.attitude));
    const geometry = new this.THREE.BufferGeometry().setFromPoints([
      origin,
      origin.clone().add(direction.multiplyScalar(110)),
    ]);
    const material = new this.THREE.LineBasicMaterial({
      blending: this.THREE.AdditiveBlending,
      color: 0x76f6ff,
      depthWrite: false,
      opacity: 0.95,
      transparent: true,
    });
    const line = new this.THREE.Line(geometry, material);
    this.scene.add(line);
    this.effects.push({ geometry, life: 0.18, line, material });
  }

  handleEvents(events, state) {
    for (const event of events) {
      if (event.type !== "fire") continue;
      const echo = state.echoes.find((entry) => entry.id === event.actorId);
      this.createPulse(echo?.craft || state.craft);
    }
  }

  updateEffects(delta) {
    for (let index = this.effects.length - 1; index >= 0; index -= 1) {
      const effect = this.effects[index];
      effect.life -= delta;
      effect.material.opacity = Math.max(0, effect.life / 0.18);
      if (effect.life > 0) continue;
      this.scene.remove(effect.line);
      effect.geometry.dispose();
      effect.material.dispose();
      this.effects.splice(index, 1);
    }
  }

  render(previous, state, alpha, delta, input) {
    const interpolated = {
      ...state.craft,
      attitude: {
        pitch: lerp(previous.craft.attitude.pitch, state.craft.attitude.pitch, alpha),
        roll: lerp(previous.craft.attitude.roll, state.craft.attitude.roll, alpha),
        yaw: lerp(previous.craft.attitude.yaw, state.craft.attitude.yaw, alpha),
      },
      position: lerpVector(previous.craft.position, state.craft.position, alpha),
    };
    this.syncShip(this.player, interpolated, input);
    this.syncEchoes(state);
    this.syncProjections(state);
    this.updateTrajectory(state);
    this.updateScan(state);
    this.updateInterior(state);
    this.updateEffects(delta);
  }

  clearTransient() {
    for (const effect of this.effects.splice(0)) {
      this.scene.remove(effect.line);
      effect.geometry.dispose();
      effect.material.dispose();
    }
    this.lastTrajectoryTick = -Infinity;
  }
}

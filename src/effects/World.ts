import * as THREE from 'three';
import type { Bands, SceneParams } from '../types';
import type { QualityConfig } from '../utils/device';
import { clamp, damp, mulberry32 } from '../utils/math';
import { makeGlowTexture, makeSmokeTexture } from './textures';
import {
  DUST_FRAG, DUST_VERT, FOG_FRAG, FOG_VERT, ORB_FRAG, ORB_VERT,
  RAIN_FRAG, RAIN_VERT, RING_FRAG, RING_VERT,
} from './shaders';

export interface WorldOptions {
  canvas: HTMLCanvasElement;
  quality: QualityConfig;
  reducedMotion: boolean;
  onContextLost?: () => void;
}

interface SmokeSprite {
  sprite: THREE.Sprite;
  base: number;
  drift: number;
  rot: number;
}

/** The whole 3D scene: volumetric-style fog shader, smoke sprites, eclipse orb, particle ring, dust and glowing rain. */
export class World {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(55, 1, 0.1, 80);
  private time = 0;
  private pr: number;
  private width = 1;
  private height = 1;
  private lost = false;
  private reduced: boolean;
  private q: QualityConfig;
  private px = 0;
  private py = 0;
  private perfTime = 0;
  private perfFrames = 0;
  private goodWindows = 0;
  private disposables: { dispose: () => void }[] = [];

  private U = {
    uTime: { value: 0 },
    uBass: { value: 0 },
    uMid: { value: 0 },
    uHigh: { value: 0 },
    uEnergy: { value: 0 },
    uPR: { value: 1 },
  };

  private fogMat!: THREE.ShaderMaterial;
  private orb!: THREE.Mesh;
  private orbMat!: THREE.ShaderMaterial;
  private halo!: THREE.Sprite;
  private ring!: THREE.Points;
  private ringMat!: THREE.ShaderMaterial;
  private dustMat!: THREE.ShaderMaterial;
  private rainMat!: THREE.ShaderMaterial;
  private rain!: THREE.LineSegments;
  private smoke: SmokeSprite[] = [];
  private tmpDir = new THREE.Vector3();
  private onLost = (e: Event) => {
    e.preventDefault();
    this.lost = true;
    this.opts.onContextLost?.();
  };

  constructor(private opts: WorldOptions) {
    this.q = opts.quality;
    this.reduced = opts.reducedMotion;
    this.renderer = new THREE.WebGLRenderer({
      canvas: opts.canvas,
      antialias: this.q.antialias,
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.setClearColor(0x000000, 1);
    this.pr = this.q.maxPixelRatio;
    this.renderer.setPixelRatio(this.pr);
    this.U.uPR.value = this.pr;
    opts.canvas.addEventListener('webglcontextlost', this.onLost);

    this.buildFog();
    this.buildSmoke();
    this.buildOrb();
    this.buildRing();
    this.buildDust();
    this.buildRain();
    this.camera.position.set(0, 0.2, 9);
  }

  private track<T extends { dispose: () => void }>(o: T): T {
    this.disposables.push(o);
    return o;
  }

  private buildFog() {
    this.fogMat = this.track(
      new THREE.ShaderMaterial({
        vertexShader: FOG_VERT,
        fragmentShader: FOG_FRAG,
        defines: { OCT: this.q.fogOctaves },
        uniforms: {
          uTime: this.U.uTime, uBass: this.U.uBass, uMid: this.U.uMid, uHigh: this.U.uHigh,
          uAspect: { value: 1 }, uFog: { value: 0.6 }, uSpeed: { value: 0.07 }, uLight: { value: 0.5 },
          uFlash: { value: 0 }, uLightPos: { value: new THREE.Vector2(0, 0.2) }, uCam: { value: new THREE.Vector2() },
        },
        depthTest: false,
        depthWrite: false,
      }),
    );
    const geo = this.track(new THREE.PlaneGeometry(2, 2));
    const mesh = new THREE.Mesh(geo, this.fogMat);
    mesh.frustumCulled = false;
    mesh.renderOrder = -100;
    this.scene.add(mesh);
  }

  private buildSmoke() {
    const tex = this.track(makeSmokeTexture());
    const rnd = mulberry32(42);
    for (let i = 0; i < this.q.sprites; i++) {
      const mat = this.track(
        new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, color: 0xffffff }),
      );
      const s = new THREE.Sprite(mat);
      const size = 9 + rnd() * 10;
      s.scale.set(size, size, 1);
      s.position.set((rnd() - 0.5) * 32, (rnd() - 0.5) * 11, -1 - rnd() * 17);
      s.material.rotation = rnd() * Math.PI * 2;
      this.scene.add(s);
      this.smoke.push({ sprite: s, base: 0.05 + rnd() * 0.08, drift: 0.12 + rnd() * 0.3, rot: (rnd() - 0.5) * 0.04 });
    }
  }

  private buildOrb() {
    const geo = this.track(new THREE.SphereGeometry(1, this.q.tier === 'low' ? 40 : 72, this.q.tier === 'low' ? 40 : 72));
    this.orbMat = this.track(
      new THREE.ShaderMaterial({
        vertexShader: ORB_VERT,
        fragmentShader: ORB_FRAG,
        uniforms: { uTime: this.U.uTime, uBass: this.U.uBass, uMid: this.U.uMid, uGlow: { value: 0.8 }, uEnergy: this.U.uEnergy },
      }),
    );
    this.orb = new THREE.Mesh(geo, this.orbMat);
    this.scene.add(this.orb);

    const glowTex = this.track(makeGlowTexture());
    const hm = this.track(
      new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    this.halo = new THREE.Sprite(hm);
    this.scene.add(this.halo);
  }

  private buildRing() {
    const n = this.q.ring;
    const rnd = mulberry32(9);
    const pos = new Float32Array(n * 3);
    const ang = new Float32Array(n);
    const rad = new Float32Array(n);
    const seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      ang[i] = rnd() * Math.PI * 2;
      rad[i] = 1.55 + Math.pow(rnd(), 1.6) * 1.5;
      seed[i] = rnd();
    }
    const geo = this.track(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aAngle', new THREE.BufferAttribute(ang, 1));
    geo.setAttribute('aRad', new THREE.BufferAttribute(rad, 1));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    this.ringMat = this.track(
      new THREE.ShaderMaterial({
        vertexShader: RING_VERT,
        fragmentShader: RING_FRAG,
        uniforms: {
          uTime: this.U.uTime, uBass: this.U.uBass, uMid: this.U.uMid, uHigh: this.U.uHigh, uPR: this.U.uPR,
          uScale: { value: 1 }, uOpacity: { value: 0 },
        },
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      }),
    );
    this.ring = new THREE.Points(geo, this.ringMat);
    this.ring.frustumCulled = false;
    this.scene.add(this.ring);
  }

  private buildDust() {
    const n = this.q.dust;
    const rnd = mulberry32(21);
    const pos = new Float32Array(n * 3);
    const seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (rnd() - 0.5) * 32;
      pos[i * 3 + 1] = (rnd() - 0.5) * 18;
      pos[i * 3 + 2] = -14 + rnd() * 18;
      seed[i] = rnd();
    }
    const geo = this.track(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    this.dustMat = this.track(
      new THREE.ShaderMaterial({
        vertexShader: DUST_VERT,
        fragmentShader: DUST_FRAG,
        uniforms: { uTime: this.U.uTime, uHigh: this.U.uHigh, uPR: this.U.uPR, uAmount: { value: 0.3 }, uBurst: { value: 0 } },
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      }),
    );
    const pts = new THREE.Points(geo, this.dustMat);
    pts.frustumCulled = false;
    this.scene.add(pts);
  }

  private buildRain() {
    const n = this.q.rain;
    const rnd = mulberry32(77);
    const pos = new Float32Array(n * 2 * 3);
    const end = new Float32Array(n * 2);
    const seed = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      const x = (rnd() - 0.5) * 36;
      const y = rnd() * 22;
      const z = -14 + rnd() * 19;
      const s = rnd();
      for (let k = 0; k < 2; k++) {
        const o = (i * 2 + k) * 3;
        pos[o] = x; pos[o + 1] = y; pos[o + 2] = z;
        end[i * 2 + k] = k;
        seed[i * 2 + k] = s;
      }
    }
    const geo = this.track(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    this.rainMat = this.track(
      new THREE.ShaderMaterial({
        vertexShader: RAIN_VERT,
        fragmentShader: RAIN_FRAG,
        uniforms: { uTime: this.U.uTime, uBass: this.U.uBass, uAmount: { value: 0 }, uOpacity: { value: 0.55 } },
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      }),
    );
    this.rain = new THREE.LineSegments(geo, this.rainMat);
    this.rain.frustumCulled = false;
    this.scene.add(this.rain);
  }

  resize(w: number, h: number) {
    this.width = Math.max(1, w);
    this.height = Math.max(1, h);
    this.renderer.setPixelRatio(this.pr);
    this.renderer.setSize(this.width, this.height, false);
    this.camera.aspect = this.width / this.height;
    // keep portrait screens from looking too narrow
    this.camera.fov = this.camera.aspect < 0.8 ? 68 : 55;
    this.camera.updateProjectionMatrix();
    this.fogMat.uniforms.uAspect.value = this.camera.aspect;
    this.U.uPR.value = this.pr;
  }

  update(rawDt: number, bands: Bands, p: SceneParams, flash: number, pointer: { x: number; y: number }) {
    if (this.lost) return;
    const dt = Math.min(0.1, rawDt);
    const red = this.reduced;
    this.time += dt * (red ? 0.5 : 1);
    const react = p.react * (red ? 0.5 : 1);
    const B = clamp(bands.bass * react, 0, 1.6);
    const M = clamp(bands.mid * react, 0, 1.6);
    const H = clamp(bands.high * react, 0, 1.6);
    const E = clamp(bands.energy * react, 0, 1.6);
    const K = red ? 0 : bands.kick * react;

    const U = this.U;
    U.uTime.value = this.time;
    U.uBass.value = B; U.uMid.value = M; U.uHigh.value = H; U.uEnergy.value = E;

    // fog
    const f = this.fogMat.uniforms;
    f.uFog.value = p.fog;
    f.uSpeed.value = p.speed * (red ? 0.4 : 1);
    f.uLight.value = p.light * (1 + E * 0.35);
    f.uFlash.value = flash;
    (f.uLightPos.value as THREE.Vector2).set(p.lightX, p.lightY);

    // camera: scene position + slow sway + pointer parallax + gentle bass dolly
    this.px = damp(this.px, pointer.x, 3, dt);
    this.py = damp(this.py, pointer.y, 3, dt);
    const sway = red ? 0 : p.sway;
    const par = red ? 0 : 1;
    const cx = p.cx + Math.sin(this.time * 0.11) * 0.6 * sway + this.px * 0.5 * par;
    const cy = p.cy + Math.cos(this.time * 0.09) * 0.35 * sway + this.py * 0.3 * par;
    const cz = p.cz - B * 0.3 * par;
    this.camera.position.set(cx, cy, cz);
    this.camera.lookAt(p.lx, p.ly, p.lz);
    (f.uCam.value as THREE.Vector2).set(cx * 0.06 + p.lx * 0.03, cy * 0.06);

    // orb + halo
    const visible = p.orb > 0.03;
    this.orb.visible = visible;
    this.halo.visible = visible;
    this.orb.position.set(p.orbX, p.orbY, p.orbZ);
    this.orb.scale.setScalar(Math.max(0.001, p.orb * (1 + B * 0.05)));
    this.orbMat.uniforms.uGlow.value = p.glow * (0.8 + E * 0.6);
    this.tmpDir.set(p.orbX - cx, p.orbY - cy, p.orbZ - cz).normalize();
    this.halo.position.set(p.orbX + this.tmpDir.x * 0.9, p.orbY + this.tmpDir.y * 0.9, p.orbZ + this.tmpDir.z * 0.9);
    this.halo.scale.setScalar(Math.max(0.001, p.orb * (4.2 + E * 2.2)));
    this.halo.material.opacity = clamp(p.glow * 0.5 * (0.7 + E * 0.8), 0, 1);

    // ring
    this.ring.visible = p.ring > 0.03;
    this.ring.position.set(p.orbX, p.orbY, p.orbZ);
    this.ring.rotation.set(1.15 + Math.sin(this.time * 0.2) * 0.1, 0, this.time * 0.03);
    this.ringMat.uniforms.uScale.value = Math.max(0.01, p.orb * 0.95);
    this.ringMat.uniforms.uOpacity.value = clamp(p.ring * (0.45 + E * 0.6), 0, 1.4);

    // dust & rain
    this.dustMat.uniforms.uAmount.value = p.dust * (red ? 0.4 : 1);
    this.dustMat.uniforms.uBurst.value = K * 0.9;
    this.rainMat.uniforms.uAmount.value = p.rain * (red ? 0.3 : 1);
    this.rainMat.uniforms.uOpacity.value = 0.45 + E * 0.5;
    this.rain.visible = p.rain > 0.02;

    // smoke sprites drift horizontally and breathe with the music
    const flow = 0.15 + p.speed * 2.2;
    for (const s of this.smoke) {
      const sp = s.sprite;
      sp.position.x += dt * s.drift * flow * (red ? 0.4 : 1);
      if (sp.position.x > 18) sp.position.x = -18;
      sp.material.rotation += dt * s.rot * (red ? 0.3 : 1);
      sp.material.opacity = clamp(s.base * p.fog * (1 + E * 0.4) * 0.65, 0, 0.35);
    }

    this.renderer.render(this.scene, this.camera);
    this.adaptQuality(rawDt);
  }

  /** Lowers (and cautiously restores) the render resolution to hold the frame rate. */
  private adaptQuality(rawDt: number) {
    if (rawDt > 0.25 || document.visibilityState !== 'visible') return;
    this.perfTime += rawDt;
    this.perfFrames++;
    if (this.perfFrames < 90) return;
    const fps = this.perfFrames / this.perfTime;
    this.perfTime = 0;
    this.perfFrames = 0;
    if (fps < 42 && this.pr > this.q.minPixelRatio) {
      this.pr = Math.max(this.q.minPixelRatio, this.pr - 0.2);
      this.goodWindows = 0;
      this.resize(this.width, this.height);
    } else if (fps > 57 && this.pr < this.q.maxPixelRatio) {
      if (++this.goodWindows >= 3) {
        this.pr = Math.min(this.q.maxPixelRatio, this.pr + 0.1);
        this.goodWindows = 0;
        this.resize(this.width, this.height);
      }
    } else this.goodWindows = 0;
  }

  dispose() {
    this.opts.canvas.removeEventListener('webglcontextlost', this.onLost);
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
    this.scene.clear();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}

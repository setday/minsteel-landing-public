/**
 * 3D-разрез футеровки (PLAN.md §6). Процедурная геометрия, без внешних моделей.
 * Слои снаружи внутрь: кожух → теплоизоляция → анкеры → бетон → огнеупорный кирпич → жар.
 * Прогресс p ∈ [0..1] (скролл) разводит слои (exploded view) и показывает подписи.
 */
import * as THREE from 'three';

export type LayerId = 'shell' | 'insulation' | 'anchors' | 'castable' | 'bricks' | 'raw';

type Options = {
  canvas: HTMLCanvasElement;
  /** Элементы подписей: data-layer="…" */
  labels: HTMLElement[];
  getProgress: () => number;
  reducedMotion: boolean;
};

const R = { hot: 4.0, bricks: 4.5, castable: 5.0, insul: 5.25, shell: 5.34 };
const H = 2.6;
const THETA = 0.95; // угол сегмента, рад
const T0 = -THETA / 2;

/** Сектор кольца (вид сверху) с выдавливанием по высоте. */
function sector(rIn: number, rOut: number, t0: number, dt: number, h: number, segs = 48) {
  const s = new THREE.Shape();
  s.absarc(0, 0, rOut, t0, t0 + dt, false);
  s.absarc(0, 0, rIn, t0 + dt, t0, true);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: segs });
  g.rotateX(-Math.PI / 2); // форма в XZ, высота по +Y
  return g;
}

/** Смещение слоя вдоль радиуса (центр сегмента смотрит в +X). */
const radial = new THREE.Vector3(1, 0, 0);

function mulberry(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createLining(opts: Options) {
  const { canvas, labels, getProgress, reducedMotion } = opts;
  const rnd = mulberry(42);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);

  // Корневая группа: центр сегмента в начале координат
  const root = new THREE.Group();
  const pivot = new THREE.Group();
  pivot.add(root);
  scene.add(pivot);
  root.position.set(-(R.hot + R.shell) / 2, -H / 2, 0);

  const layers: Record<Exclude<LayerId, 'raw'>, { obj: THREE.Object3D; off: number }> = {
    bricks: { obj: new THREE.Group(), off: 0 },
    castable: { obj: new THREE.Group(), off: 0.85 },
    anchors: { obj: new THREE.Group(), off: 1.9 },
    insulation: { obj: new THREE.Group(), off: 2.85 },
    shell: { obj: new THREE.Group(), off: 3.6 },
  };
  Object.values(layers).forEach((l) => root.add(l.obj));

  // --- Кожух: сталь
  const steel = new THREE.MeshStandardMaterial({ color: 0x5b5a58, metalness: 0.9, roughness: 0.42 });
  layers.shell.obj.add(new THREE.Mesh(sector(R.insul, R.shell, T0, THETA, H), steel));

  // --- Теплоизоляция: светлая волокнистая плита
  const insulMat = new THREE.MeshStandardMaterial({ color: 0xcfc6b8, roughness: 1, metalness: 0 });
  layers.insulation.obj.add(new THREE.Mesh(sector(R.castable, R.insul, T0, THETA, H), insulMat));

  // --- Бетон: серый монолит
  const castMat = new THREE.MeshStandardMaterial({ color: 0x8d8984, roughness: 0.95, metalness: 0 });
  layers.castable.obj.add(new THREE.Mesh(sector(R.bricks, R.castable, T0, THETA, H), castMat));

  // --- Анкеры: V-образные, нержавеющая сталь
  const anchorMat = new THREE.MeshStandardMaterial({ color: 0xd9d6d0, metalness: 1, roughness: 0.25 });
  const rows = 3;
  const cols = 4;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const t = T0 + ((i + 0.5) / cols) * THETA;
      const y = ((j + 0.5) / rows) * H;
      const dir = new THREE.Vector3(Math.cos(t), 0, Math.sin(t));
      const at = (r: number, dy: number) => dir.clone().multiplyScalar(r).add(new THREE.Vector3(0, y + dy, 0));
      const pts = [at(R.insul + 0.02, 0), at(R.castable - 0.05, 0), at(R.bricks + 0.08, 0.2), at(R.castable - 0.05, 0), at(R.bricks + 0.08, -0.2)];
      const path = new THREE.CurvePath<THREE.Vector3>();
      path.add(new THREE.LineCurve3(pts[0], pts[1]));
      path.add(new THREE.LineCurve3(pts[1], pts[2]));
      const path2 = new THREE.CurvePath<THREE.Vector3>();
      path2.add(new THREE.LineCurve3(pts[3], pts[4]));
      layers.anchors.obj.add(new THREE.Mesh(new THREE.TubeGeometry(path, 8, 0.026, 8), anchorMat));
      layers.anchors.obj.add(new THREE.Mesh(new THREE.TubeGeometry(path2, 4, 0.026, 8), anchorMat));
      // Пластина приварки
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.14, 0.14), anchorMat);
      plate.position.copy(at(R.insul + 0.01, 0));
      plate.rotation.y = -t;
      layers.anchors.obj.add(plate);
    }
  }

  // --- Кирпичная кладка рабочего слоя
  const brickRows = 8;
  const brickCols = 7;
  const gap = 0.012;
  const brickColors = [0xd9c19c, 0xcdb18a, 0xe2cda9, 0xc9a97f];
  const brickMats = brickColors.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, emissive: 0xff5a10, emissiveIntensity: 0 }));
  const rowH = H / brickRows;
  for (let j = 0; j < brickRows; j++) {
    const shift = j % 2 ? 0.5 : 0;
    for (let i = -1; i < brickCols + 1; i++) {
      let a0 = T0 + ((i + shift) / brickCols) * THETA;
      let a1 = a0 + THETA / brickCols;
      a0 = Math.max(a0, T0);
      a1 = Math.min(a1, T0 + THETA);
      if (a1 - a0 < 0.01) continue;
      const g = sector(R.hot, R.bricks, a0 + gap / R.bricks, a1 - a0 - (2 * gap) / R.bricks, rowH - gap * 2, 6);
      const m = new THREE.Mesh(g, brickMats[Math.floor(rnd() * brickMats.length)]);
      m.position.y = j * rowH + gap;
      layers.bricks.obj.add(m);
    }
  }

  // --- Жар: светящаяся поверхность внутри агрегата
  const heatMat = new THREE.MeshBasicMaterial({ color: 0xff3d00, transparent: true, opacity: 0.85, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
  const heat = new THREE.Mesh(sector(R.hot - 0.03, R.hot - 0.01, T0, THETA, H), heatMat);
  layers.bricks.obj.add(heat);

  const hotLight = new THREE.PointLight(0xff4a12, 60, 9, 1.4);
  hotLight.position.set(R.hot - 1.6, H / 2, 0);
  root.add(hotLight);

  // Мягкое свечение-ореол (спрайт с радиальным градиентом)
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = glowCanvas.height = 128;
  const gctx = glowCanvas.getContext('2d')!;
  const grad = gctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,170,60,0.9)');
  grad.addColorStop(0.35, 'rgba(255,106,26,0.35)');
  grad.addColorStop(1, 'rgba(255,60,10,0)');
  gctx.fillStyle = grad;
  gctx.fillRect(0, 0, 128, 128);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(glowCanvas), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  glow.position.set(R.hot - 0.9, H / 2, 0);
  glow.scale.set(3.2, 3.2, 1);
  (glow.material as THREE.SpriteMaterial).opacity = 0.55;
  root.add(glow);

  // --- Сырьё: зёрна (боксит, андалузит, муллит, пек) — облако частиц у бетона
  const N = 900;
  const pos = new Float32Array(N * 3);
  const base = new Float32Array(N * 3);
  const col = new Float32Array(N * 3);
  const palette = [new THREE.Color(0xb59a7a), new THREE.Color(0x7a7266), new THREE.Color(0xe8e0d0), new THREE.Color(0xc9b28e)];
  for (let k = 0; k < N; k++) {
    const t = T0 + rnd() * THETA;
    const r = R.bricks + 0.1 + rnd() * 0.8;
    base[k * 3] = Math.cos(t) * r;
    base[k * 3 + 1] = rnd() * H;
    base[k * 3 + 2] = Math.sin(t) * r;
    const c = palette[Math.floor(rnd() * palette.length)];
    col.set([c.r, c.g, c.b], k * 3);
  }
  pos.set(base);
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  pg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const grains = new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.045, vertexColors: true, transparent: true, opacity: 0, depthWrite: false }));
  root.add(grains);

  // --- Свет
  scene.add(new THREE.HemisphereLight(0xfff1e2, 0x2a2420, 1.6));
  const key = new THREE.DirectionalLight(0xffe8d0, 2.2);
  key.position.set(6, 8, 7);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xff8a3a, 1.1);
  rim.position.set(-6, 3, -6);
  scene.add(rim);

  // Точки привязки подписей (в координатах root) для каждого слоя
  const mid = (r0: number, r1: number) => (r0 + r1) / 2;
  // Видимый торец сегмента (со стороны камеры) — подписи на разной высоте, чтобы не налезали
  const te = T0 + THETA * 0.995;
  const onEdge = (r: number, y: number) => new THREE.Vector3(Math.cos(te) * r, y, Math.sin(te) * r);
  const anchorPoint: Record<string, THREE.Vector3> = {
    bricks: onEdge(mid(R.hot, R.bricks), H * 0.12),
    castable: onEdge(mid(R.bricks, R.castable), H * 0.38),
    anchors: onEdge(R.castable - 0.15, H * 0.64),
    insulation: onEdge(mid(R.castable, R.insul), H * 0.86),
    shell: onEdge(R.shell, H * 1.02),
    raw: new THREE.Vector3(Math.cos(T0 + THETA * 0.25) * (R.bricks + 0.45), -0.35, Math.sin(T0 + THETA * 0.25) * (R.bricks + 0.45)),
  };

  // --- Камера и взаимодействие
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const onPointer = (e: PointerEvent) => {
    pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
  };
  if (!reducedMotion) window.addEventListener('pointermove', onPointer, { passive: true });

  let w = 0;
  let h = 0;
  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    w = Math.max(1, rect.width);
    h = Math.max(1, rect.height);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  const ease = (x: number) => 1 - Math.pow(1 - x, 3);
  const v = new THREE.Vector3();
  let smoothP = getProgress();
  let running = false;
  let raf = 0;
  const clock = new THREE.Clock();

  const frame = () => {
    const t = clock.getElapsedTime();
    const target = getProgress();
    smoothP += (target - smoothP) * (reducedMotion ? 1 : 0.08);
    const p = ease(Math.min(1, Math.max(0, smoothP)));

    // Разлёт слоёв
    for (const l of Object.values(layers)) l.obj.position.copy(radial).multiplyScalar(l.off * p);

    const spread = 0.85 * p;
    if (p > 0.001) {
    // Частицы сырья: появляются и «вылетают» наружу
    const pa = pg.getAttribute('position') as THREE.BufferAttribute;
    for (let k = 0; k < N; k++) {
      const bx = base[k * 3];
      const bz = base[k * 3 + 2];
      const wob = reducedMotion ? 0 : Math.sin(t * 0.7 + k) * 0.03;
      pa.array[k * 3] = bx + bx * 0.08 * p + spread * 0.35;
      pa.array[k * 3 + 1] = base[k * 3 + 1] + wob - p * 0.6 * ((k % 5) / 5);
      pa.array[k * 3 + 2] = bz * (1 + 0.08 * p);
    }
    pa.needsUpdate = true;
    (grains.material as THREE.PointsMaterial).opacity = Math.min(1, p * 1.6) * 0.95;
    }
    grains.visible = p > 0.001;

    // Жар: мерцание
    const flick = reducedMotion ? 1 : 0.92 + Math.sin(t * 3.1) * 0.04 + Math.sin(t * 7.3) * 0.03;
    hotLight.intensity = 14 * flick;
    heatMat.opacity = 0.22 * flick;
    brickMats.forEach((m) => (m.emissiveIntensity = 0.015 * flick));

    // Камера: три четверти, при разлёте отъезжает и смещает центр
    pointer.x += (pointer.tx - pointer.x) * 0.05;
    pointer.y += (pointer.ty - pointer.y) * 0.05;
    const narrow = w / h < 0.9;
    const dist = (narrow ? 10.5 : 9.2) + p * 3.4;
    // Камера изнутри агрегата: видны раскалённая поверхность и торец со слоями
    // Плавное покачивание сегмента — без привязки к скроллу
    const az = Math.PI - 0.95 + p * 0.45 + pointer.x * 0.08 + (reducedMotion ? 0 : Math.sin(t * 0.22) * 0.22);
    const el = 0.34 + p * 0.24 - pointer.y * 0.04 + (reducedMotion ? 0 : Math.sin(t * 0.17) * 0.04);
    const lookX = 1.9 * p;
    camera.position.set(lookX + Math.cos(az) * Math.cos(el) * dist, Math.sin(el) * dist, Math.sin(az) * Math.cos(el) * dist);
    camera.lookAt(lookX, 0.15 - p * 0.25, 0);
    // Сдвиг кадра: на широких экранах объект справа от текста, на узких — ниже
    camera.clearViewOffset();

    renderer.render(scene, camera);

    // Подписи
    const show = p > 0.85;
    for (const el of labels) {
      const id = el.dataset.layer as LayerId;
      const ap = anchorPoint[id];
      if (!ap) continue;
      v.copy(ap);
      if (id !== 'raw') v.add(layers[id as Exclude<LayerId, 'raw'>].obj.position);
      else v.add(new THREE.Vector3(spread * 0.35, 0, 0));
      root.localToWorld(v);
      v.project(camera);
      const x = (v.x * 0.5 + 0.5) * w;
      const y = (-v.y * 0.5 + 0.5) * h;
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      el.dataset.visible = String(show && v.z < 1);
    }

    if (running) raf = requestAnimationFrame(frame);
  };

  const start = () => {
    if (running) return;
    running = true;
    clock.start();
    raf = requestAnimationFrame(frame);
  };
  const stop = () => {
    running = false;
    cancelAnimationFrame(raf);
  };

  return {
    start,
    stop,
    renderOnce: () => frame(),
    dispose: () => {
      stop();
      ro.disconnect();
      window.removeEventListener('pointermove', onPointer);
      renderer.dispose();
    },
  };
}

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch {
    return false;
  }
}

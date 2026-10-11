import { useEffect, useRef } from 'react';

/**
 * Background 3D scene drawn on a plain canvas with a hand-rolled perspective
 * projection (no extra dependencies):
 *   - a wireframe trefoil-knot tube that spins and reacts to the mouse
 *   - a perspective floor grid that streams toward you as you scroll
 *   - drifting dust that stretches into streaks when you scroll fast
 * `energy` (0..1) speeds everything up while a site is being generated.
 */

type V3 = [number, number, number];

const N = 150; // samples along the knot
const M = 8; // sides of the tube
const BUCKETS = 6;

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function knotPoint(u: number): V3 {
  return [Math.sin(u) + 2 * Math.sin(2 * u), Math.cos(u) - 2 * Math.cos(2 * u), -Math.sin(3 * u)];
}
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const unit = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

// Pre-compute the tube frame once.
const CENTER: V3[] = [];
const NORMAL: V3[] = [];
const BINORMAL: V3[] = [];
for (let i = 0; i < N; i++) {
  const u = (i / N) * Math.PI * 2;
  const e = 0.002;
  const p = knotPoint(u);
  const tangent = unit(sub(knotPoint(u + e), knotPoint(u - e)));
  const a = knotPoint(u + e);
  const b = knotPoint(u - e);
  let nrm: V3 = [a[0] - 2 * p[0] + b[0], a[1] - 2 * p[1] + b[1], a[2] - 2 * p[2] + b[2]];
  const d = dot(nrm, tangent);
  nrm = unit([nrm[0] - tangent[0] * d, nrm[1] - tangent[1] * d, nrm[2] - tangent[2] * d]);
  CENTER.push(p);
  NORMAL.push(nrm);
  BINORMAL.push(cross(tangent, nrm));
}

// Dust particles
const DUST = 170;
const dustX = new Float32Array(DUST);
const dustY = new Float32Array(DUST);
const dustZ = new Float32Array(DUST);
for (let i = 0; i < DUST; i++) {
  dustX[i] = (Math.random() - 0.5) * 30;
  dustY[i] = (Math.random() - 0.5) * 18;
  dustZ[i] = 1 + Math.random() * 34;
}

export default function Scene3D({ energy }: { energy: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const energyRef = useRef(energy);
  energyRef.current = energy;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let W = 0;
    let H = 0;
    let dpr = 1;
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    const onMove = (e: PointerEvent) => {
      mouse.tx = (e.clientX / W - 0.5) * 2;
      mouse.ty = (e.clientY / H - 0.5) * 2;
    };

    const px = new Float32Array(N * M);
    const py = new Float32Array(N * M);
    const pz = new Float32Array(N * M);

    let phase = 0;
    let e = energyRef.current;
    let lastScroll = window.scrollY;
    let scrollVel = 0;
    let last = performance.now();
    let raf = 0;

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      e += (energyRef.current - e) * 0.05;
      mouse.x += (mouse.tx - mouse.x) * 0.06;
      mouse.y += (mouse.ty - mouse.y) * 0.06;

      const sy = window.scrollY;
      scrollVel += ((sy - lastScroll) / Math.max(dt, 0.001) / 1500 - scrollVel) * 0.15;
      lastScroll = sy;
      const sp = sy / Math.max(H, 1); // scroll progress, 1 = one screen

      ctx.clearRect(0, 0, W, H);
      if (sp > 1.4) {
        if (!reduce) raf = requestAnimationFrame(frame);
        return; // workspace fully covers the scene
      }

      phase += reduce ? 0 : dt * 0.22 * (1 + e * 3);
      const fade = 1 - clamp((sp - 0.7) / 0.6);
      ctx.globalAlpha = fade;

      const focal = Math.min(H, W * 1.3);
      const cx0 = W / 2;
      const cy0 = H * 0.5;
      const proj = (x: number, y: number, z: number): [number, number] => {
        const s = focal / z;
        return [cx0 + x * s, cy0 - y * s];
      };

      // ---- floor grid ----
      const floorY = -2.5;
      const spacing = 1.25;
      const off = ((sy * 0.006 + (reduce ? 0 : performance.now() / 1000) * 0.5 * (1 + e * 3)) % spacing + spacing) % spacing;
      const COLS = 15;
      const slabs = 30;
      for (let k = 0; k < slabs; k++) {
        const z0 = 1 + k * spacing - off;
        const z1 = z0 + spacing;
        if (z0 < 0.6) continue;
        const mid = (z0 + z1) / 2;
        const a = Math.pow(clamp(1 - mid / 38), 1.6) * 0.32;
        if (a < 0.01) continue;
        ctx.strokeStyle = `rgba(109,40,217,${a})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let c = -COLS; c <= COLS; c++) {
          const [ax, ay] = proj(c * spacing, floorY, z0);
          const [bx, by] = proj(c * spacing, floorY, z1);
          ctx.moveTo(ax, ay);
          ctx.lineTo(bx, by);
        }
        // cross line at z0
        const [lx, ly] = proj(-COLS * spacing, floorY, z0);
        const [rx, ry2] = proj(COLS * spacing, floorY, z0);
        ctx.moveTo(lx, ly);
        ctx.lineTo(rx, ry2);
        ctx.stroke();
      }

      // ---- dust ----
      const speed = (reduce ? 0 : 0.012 + e * 0.12) + Math.abs(scrollVel) * 0.5;
      for (let i = 0; i < DUST; i++) {
        dustZ[i] -= speed;
        if (dustZ[i] < 0.8) {
          dustZ[i] += 34;
          dustX[i] = (Math.random() - 0.5) * 30;
          dustY[i] = (Math.random() - 0.5) * 18;
        }
        const [sx, sy2] = proj(dustX[i], dustY[i], dustZ[i]);
        if (sx < -20 || sx > W + 20 || sy2 < -20 || sy2 > H + 20) continue;
        const a = clamp(1 - dustZ[i] / 34) * 0.55;
        ctx.strokeStyle = `rgba(124,58,237,${a})`;
        ctx.lineWidth = clamp(1.8 - dustZ[i] / 20, 0.6, 1.8);
        const streak = Math.min(dustZ[i] * 0.4, speed * 6);
        ctx.beginPath();
        if (streak > 0.05) {
          const [tx, ty] = proj(dustX[i], dustY[i], dustZ[i] + streak);
          ctx.moveTo(sx, sy2);
          ctx.lineTo(tx, ty);
        } else {
          ctx.moveTo(sx, sy2);
          ctx.lineTo(sx + 0.6, sy2 + 0.6);
        }
        ctx.stroke();
      }

      // ---- knot ----
      const wide = W > 900;
      const ox = lerp(wide ? 2.9 : 0, 0, clamp(sp));
      const oy = 0.25 + sp * 1.6;
      const oz = 9.5 + sp * 7;
      const ry = phase + sp * 2.4 + mouse.x * 0.5;
      const rx = 0.35 + sp * 0.8 + mouse.y * 0.25;
      const cyw = Math.cos(ry);
      const syw = Math.sin(ry);
      const cxw = Math.cos(rx);
      const sxw = Math.sin(rx);
      const K = 0.8;
      const t = now / 1000;

      let zmin = Infinity;
      let zmax = -Infinity;
      for (let i = 0; i < N; i++) {
        const c = CENTER[i];
        const nn = NORMAL[i];
        const bb = BINORMAL[i];
        const rad = 0.34 * (1 + e * 0.45 * Math.sin(i * 0.35 + t * 5));
        for (let j = 0; j < M; j++) {
          const ang = (j / M) * Math.PI * 2;
          const ca = Math.cos(ang) * rad;
          const sa = Math.sin(ang) * rad;
          const x = (c[0] + nn[0] * ca + bb[0] * sa) * K;
          const y = (c[1] + nn[1] * ca + bb[1] * sa) * K;
          const z = (c[2] + nn[2] * ca + bb[2] * sa) * K;
          // rotate Y then X
          const X = x * cyw + z * syw;
          let Z = -x * syw + z * cyw;
          const Y = y * cxw - Z * sxw;
          Z = y * sxw + Z * cxw;
          const zz = Z + oz;
          const s = focal / zz;
          const idx = i * M + j;
          px[idx] = cx0 + (X + ox) * s;
          py[idx] = cy0 - (Y + oy) * s;
          pz[idx] = zz;
          if (zz < zmin) zmin = zz;
          if (zz > zmax) zmax = zz;
        }
      }

      const span = Math.max(zmax - zmin, 0.001);
      const paths: Path2D[] = [];
      for (let b = 0; b < BUCKETS; b++) paths.push(new Path2D());
      const addSeg = (a: number, b: number) => {
        const d = (pz[a] + pz[b]) / 2;
        const bi = Math.min(BUCKETS - 1, Math.floor(((d - zmin) / span) * BUCKETS));
        const p = paths[bi];
        p.moveTo(px[a], py[a]);
        p.lineTo(px[b], py[b]);
      };
      for (let i = 0; i < N; i++) {
        const i2 = (i + 1) % N;
        for (let j = 0; j < M; j++) {
          addSeg(i * M + j, i2 * M + j);
          if (i % 3 === 0) addSeg(i * M + j, i * M + ((j + 1) % M));
        }
      }
      ctx.lineWidth = 1.1;
      for (let b = 0; b < BUCKETS; b++) {
        const nearness = 1 - b / (BUCKETS - 1); // bucket 0 = nearest
        const a = (0.16 + nearness * 0.74) * fade;
        const r = Math.round(lerp(167, 76, nearness));
        const g = Math.round(lerp(139, 29, nearness));
        const bl = Math.round(lerp(250, 149, nearness));
        ctx.strokeStyle = `rgba(${r},${g},${bl},${a})`;
        ctx.stroke(paths[b]);
      }

      // ---- gimbal rings ----
      ctx.lineWidth = 1;
      ctx.strokeStyle = `rgba(14,12,22,${0.16 * fade})`;
      const rings = [3.6, 4.2, 4.8];
      rings.forEach((R, ri) => {
        const tilt = phase * (0.6 + ri * 0.25) + ri * 1.2 + mouse.x * 0.3;
        const ct = Math.cos(tilt);
        const st = Math.sin(tilt);
        ctx.beginPath();
        for (let s = 0; s <= 72; s++) {
          const a = (s / 72) * Math.PI * 2;
          let x = Math.cos(a) * R;
          let y = Math.sin(a) * R;
          let z = 0;
          // tilt around X by `tilt`, then around Y by ring offset
          const y1 = y * ct - z * st;
          const z1 = y * st + z * ct;
          y = y1;
          z = z1;
          const x2 = x * Math.cos(ri * 0.9) + z * Math.sin(ri * 0.9);
          const z2 = -x * Math.sin(ri * 0.9) + z * Math.cos(ri * 0.9);
          x = x2;
          z = z2;
          // apply the same world rotation as the knot, softened
          const X = x * cyw + z * syw;
          let Z = -x * syw + z * cyw;
          const Y = y * cxw - Z * sxw;
          Z = y * sxw + Z * cxw;
          const zz = Z + oz;
          if (zz < 0.5) continue;
          const sc = focal / zz;
          const sx = cx0 + (X + ox) * sc;
          const sy3 = cy0 - (Y + oy) * sc;
          if (s === 0) ctx.moveTo(sx, sy3);
          else ctx.lineTo(sx, sy3);
        }
        ctx.stroke();
      });

      ctx.globalAlpha = 1;
      if (!reduce) raf = requestAnimationFrame(frame);
    };

    const redraw = () => frame(performance.now());

    if (reduce) {
      window.addEventListener('scroll', redraw, { passive: true });
      redraw();
    } else {
      raf = requestAnimationFrame(frame);
    }

    const onResize = () => {
      resize();
      if (reduce) redraw();
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('pointermove', onMove, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('scroll', redraw);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0"
    />
  );
}

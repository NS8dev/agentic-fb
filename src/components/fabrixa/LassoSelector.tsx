// 3D lasso selection.
//
// Two pieces:
//  - <LassoOverlay/> — DOM overlay (must live next to the R3F <Canvas/>).
//    Captures pointer events when enabled and draws an SVG polygon.
//  - <LassoComputer/> — R3F child inside <Canvas/>. Uses scene+camera to
//    raycast triangles of the *active part's* meshes that fall inside the
//    drawn polygon, then rasterizes those triangles into a UV-space mask
//    canvas and returns the data URL.
//
// Communication between the two halves uses a tiny module-level event bus
// so we don't have to thread refs through R3F.

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

type Pt = { x: number; y: number };
export type LassoMode = "freehand" | "polygon" | "brush";

interface LassoRequest {
  id: number;
  points: Pt[];
  rect: { width: number; height: number };
  mode: LassoMode;
  brushSize: number;
}

const store = {
  request: null as LassoRequest | null,
  listeners: new Set<() => void>(),
};

function notify() {
  store.listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  store.listeners.add(l);
  return () => store.listeners.delete(l);
}

function getSnapshot() {
  return store.request;
}

let reqSeq = 0;
function emitRequest(
  points: Pt[],
  rect: { width: number; height: number },
  mode: LassoMode,
  brushSize: number = 20,
) {
  store.request = { id: ++reqSeq, points, rect, mode, brushSize };
  notify();
}

/* ============================================================
 * DOM overlay — sits over the WebGL canvas.
 * ============================================================ */
export function LassoOverlay({
  enabled,
  onCancel,
  mode = "freehand",
  brushSize = 20,
}: {
  enabled: boolean;
  onCancel?: () => void;
  mode?: LassoMode;
  brushSize?: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const drawingRef = useRef(false);
  const pointsRef = useRef<Pt[]>([]);
  const [points, setPoints] = useState<Pt[]>([]);

  if (!enabled) return null;

  const getRect = () => wrapRef.current!.getBoundingClientRect();

  const onDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const r = getRect();
    const p = { x: e.clientX - r.left, y: e.clientY - r.top };
    if (mode === "polygon") {
      if (e.button === 2) {
        setPoints([]);
        return;
      }
      setPoints((prev) => [...prev, p]);
      return;
    }
    drawingRef.current = true;
    const start = [p];
    pointsRef.current = start;
    setPoints(start);
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (mode === "polygon") return;
    if (!drawingRef.current) return;
    const r = getRect();
    const p = { x: e.clientX - r.left, y: e.clientY - r.top };
    const prev = pointsRef.current;
    const last = prev[prev.length - 1];
    if (last && Math.hypot(last.x - p.x, last.y - p.y) < 2) return;
    const next = [...prev, p];
    pointsRef.current = next;
    setPoints(next);
  };
  const onUp = () => {
    if (mode === "polygon") return;
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const pts = pointsRef.current;
    if ((mode === "brush" && pts.length > 0) || pts.length >= 3) {
      const r = getRect();
      emitRequest(pts, { width: r.width, height: r.height }, mode, brushSize);
    }
    pointsRef.current = [];
    setPoints([]);
  };

  const closePolygon = () => {
    if (mode !== "polygon") return;
    if (points.length >= 3) {
      const r = getRect();
      emitRequest(points, { width: r.width, height: r.height }, mode, brushSize);
    }
    setPoints([]);
  };

  const isBrush = mode === "brush";
  const d =
    points.length > 0
      ? "M " +
        points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L ") +
        (isBrush ? "" : " Z")
      : "";

  return (
    <div
      ref={wrapRef}
      className="absolute inset-0 z-20 cursor-crosshair touch-none select-none"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onDoubleClick={closePolygon}
      onContextMenu={(e) => {
        e.preventDefault();
        if (mode === "polygon") setPoints([]);
      }}
    >
      {points.length > 0 && (
        <svg className="pointer-events-none absolute inset-0 h-full w-full">
          {isBrush ? (
            <path
              d={d}
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth={brushSize}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.5}
            />
          ) : (
            <path
              d={d}
              fill="hsl(var(--primary) / 0.15)"
              stroke="hsl(var(--primary))"
              strokeWidth={1.5}
              strokeDasharray="6 4"
            />
          )}
          {mode === "polygon" &&
            points.map((p, i) => (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={4}
                fill="hsl(var(--primary))"
                stroke="white"
                strokeWidth={1.5}
              />
            ))}
        </svg>
      )}
      <div className="pointer-events-none absolute left-1/2 top-2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground shadow-lg">
        {mode === "polygon"
          ? "Click to add points · Double-click or Close to finish · Scroll to rotate model"
          : mode === "brush"
            ? `Drag to paint selection (brush ${brushSize}px)`
            : "Drag to freehand-lasso a region on the model"}
        {mode === "polygon" && points.length >= 3 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              closePolygon();
            }}
            className="pointer-events-auto ml-1 rounded-full bg-primary-foreground/20 px-2 py-0.5 text-[10px] hover:bg-primary-foreground/30"
          >
            Close
          </button>
        )}
        {onCancel && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCancel();
            }}
            className="pointer-events-auto ml-1 rounded-full bg-primary-foreground/20 px-2 py-0.5 text-[10px] hover:bg-primary-foreground/30"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

/* ============================================================
 * R3F computer — runs inside <Canvas/>.
 * ============================================================ */

interface ComputerProps {
  activePart: string;
  onMask: (partKey: string, dataUrl: string, triangleCount: number) => void;
  maskSize?: number;
}

function distToSegmentSq(p: Pt, v: Pt, w: Pt) {
  const l2 = (w.x - v.x) ** 2 + (w.y - v.y) ** 2;
  if (l2 === 0) return (p.x - v.x) ** 2 + (p.y - v.y) ** 2;
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return (p.x - (v.x + t * (w.x - v.x))) ** 2 + (p.y - (v.y + t * (w.y - v.y))) ** 2;
}

/** Rasterize a UV triangle into the mask canvas (full fill, not sparse dots). */
function rasterizeUvTriangle(
  ctx: CanvasRenderingContext2D,
  u0: number,
  v0: number,
  u1: number,
  v1: number,
  u2: number,
  v2: number,
  size: number,
) {
  ctx.beginPath();
  ctx.moveTo(u0 * size, v0 * size);
  ctx.lineTo(u1 * size, v1 * size);
  ctx.lineTo(u2 * size, v2 * size);
  ctx.closePath();
  ctx.fill();
}

/** True if screen triangle overlaps the selection region. */
function screenTriOverlapsSelection(p0: Pt, p1: Pt, p2: Pt, inPoly: (pt: Pt) => boolean): boolean {
  const cx = (p0.x + p1.x + p2.x) / 3;
  const cy = (p0.y + p1.y + p2.y) / 3;
  if (inPoly({ x: cx, y: cy })) return true;
  if (inPoly(p0) || inPoly(p1) || inPoly(p2)) return true;
  // Edge midpoints catch thin selections
  if (inPoly({ x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 })) return true;
  if (inPoly({ x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 })) return true;
  if (inPoly({ x: (p2.x + p0.x) / 2, y: (p2.y + p0.y) / 2 })) return true;
  return false;
}

export function LassoComputer({ activePart, onMask, maskSize = 1024 }: ComputerProps) {
  const { camera, scene } = useThree();
  const request = useSyncExternalStore(subscribe, getSnapshot, () => null);
  const handledRef = useRef<number>(-1);
  const raycaster = useRef(new THREE.Raycaster()).current;
  const ndc = useRef(new THREE.Vector2()).current;

  useEffect(() => {
    if (!request || request.id === handledRef.current) return;
    handledRef.current = request.id;

    const { points, rect, mode, brushSize } = request;
    if (points.length < 1) return;

    const meshes: THREE.Mesh[] = [];
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !m.visible) return;
      const k = (m.userData as { partKey?: string }).partKey;
      if (k === activePart) meshes.push(m);
    });

    if (!meshes.length) {
      onMask(activePart, "", 0);
      return;
    }

    const W = rect.width;
    const H = rect.height;

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    const isBrush = mode === "brush";
    const padding = isBrush ? brushSize / 2 : 0;

    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;

    const bRadSq = (brushSize / 2) ** 2;

    function inPoly(pt: Pt): boolean {
      if (pt.x < minX || pt.x > maxX || pt.y < minY || pt.y > maxY) return false;

      if (isBrush) {
        if (points.length === 1) {
          return (pt.x - points[0].x) ** 2 + (pt.y - points[0].y) ** 2 <= bRadSq;
        }
        for (let i = 0; i < points.length - 1; i++) {
          if (distToSegmentSq(pt, points[i], points[i + 1]) <= bRadSq) return true;
        }
        return false;
      }

      let inside = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const a = points[i];
        const b = points[j];
        if (
          a.y > pt.y !== b.y > pt.y &&
          pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y + 1e-9) + a.x
        ) {
          inside = !inside;
        }
      }
      return inside;
    }

    const v = new THREE.Vector3();
    const proj = new THREE.Vector3();
    const camPos = new THREE.Vector3();
    camera.getWorldPosition(camPos);

    function project(out: Pt, world: THREE.Vector3) {
      proj.copy(world).project(camera);
      out.x = ((proj.x + 1) / 2) * W;
      out.y = ((1 - proj.y) / 2) * H;
    }

    /** Depth-aware: only accept triangle if raycast at centroid hits this mesh first. */
    function isFrontFacing(
      mesh: THREE.Mesh,
      w0: THREE.Vector3,
      w1: THREE.Vector3,
      w2: THREE.Vector3,
      sp0: Pt,
      sp1: Pt,
      sp2: Pt,
    ): boolean {
      const cx = (sp0.x + sp1.x + sp2.x) / 3;
      const cy = (sp0.y + sp1.y + sp2.y) / 3;
      ndc.x = (cx / W) * 2 - 1;
      ndc.y = -(cy / H) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(meshes, false);
      if (!hits.length) return false;
      return hits[0].object === mesh;
    }

    const mc = document.createElement("canvas");
    mc.width = maskSize;
    mc.height = maskSize;
    const mctx = mc.getContext("2d")!;
    mctx.clearRect(0, 0, maskSize, maskSize);
    mctx.fillStyle = "rgba(255,255,255,1)";

    const p0: Pt = { x: 0, y: 0 };
    const p1: Pt = { x: 0, y: 0 };
    const p2: Pt = { x: 0, y: 0 };
    const w0 = new THREE.Vector3();
    const w1 = new THREE.Vector3();
    const w2 = new THREE.Vector3();
    const triNormal = new THREE.Vector3();
    const edge1 = new THREE.Vector3();
    const edge2 = new THREE.Vector3();
    const toCam = new THREE.Vector3();

    let triCount = 0;

    for (const mesh of meshes) {
      const geom = mesh.geometry as THREE.BufferGeometry;
      const pos = geom.attributes.position as THREE.BufferAttribute | undefined;
      const uv = geom.attributes.uv as THREE.BufferAttribute | undefined;
      if (!pos || !uv) continue;
      mesh.updateWorldMatrix(true, false);
      const mWorld = mesh.matrixWorld;
      const index = geom.index;
      const triLen = index ? index.count : pos.count;

      for (let t = 0; t < triLen; t += 3) {
        const a = index ? index.getX(t) : t;
        const b = index ? index.getX(t + 1) : t + 1;
        const c = index ? index.getX(t + 2) : t + 2;

        v.fromBufferAttribute(pos, a);
        w0.copy(v).applyMatrix4(mWorld);
        v.fromBufferAttribute(pos, b);
        w1.copy(v).applyMatrix4(mWorld);
        v.fromBufferAttribute(pos, c);
        w2.copy(v).applyMatrix4(mWorld);

        edge1.subVectors(w1, w0);
        edge2.subVectors(w2, w0);
        triNormal.crossVectors(edge1, edge2).normalize();
        toCam.subVectors(camPos, w0).normalize();
        if (triNormal.dot(toCam) < 0.05) continue;

        project(p0, w0);
        project(p1, w1);
        project(p2, w2);

        if (!screenTriOverlapsSelection(p0, p1, p2, inPoly)) continue;
        if (!isFrontFacing(mesh, w0, w1, w2, p0, p1, p2)) continue;

        const u0x = uv.getX(a);
        const u0y = uv.getY(a);
        const u1x = uv.getX(b);
        const u1y = uv.getY(b);
        const u2x = uv.getX(c);
        const u2y = uv.getY(c);

        rasterizeUvTriangle(mctx, u0x, u0y, u1x, u1y, u2x, u2y, maskSize);
        triCount++;
      }
    }

    if (triCount === 0) {
      onMask(activePart, "", 0);
      return;
    }

    const out = document.createElement("canvas");
    out.width = maskSize;
    out.height = maskSize;
    const octx = out.getContext("2d")!;
    octx.clearRect(0, 0, maskSize, maskSize);
    octx.filter = "blur(1px)";
    octx.drawImage(mc, 0, 0);
    onMask(activePart, out.toDataURL("image/png"), triCount);
  }, [request, activePart, camera, scene, onMask, maskSize, raycaster, ndc]);

  return null;
}

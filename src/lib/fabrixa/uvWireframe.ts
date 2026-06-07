import * as THREE from "three";

/**
 * Extracts the UV mapping from a THREE.Mesh and renders it as a 2D wireframe
 * on a canvas. This is used in the FabricEditor as a visual guide for the user
 * to align patterns perfectly with the 3D model's seams.
 *
 * @param mesh The 3D mesh to extract UVs from.
 * @param size Resolution of the output canvas.
 * @returns A data URL of the rendered wireframe.
 */
export function generateUvWireframe(mesh: THREE.Mesh, size = 1024): string {
  const geom = mesh.geometry;
  const pos = geom.attributes.position;
  const uv = geom.attributes.uv;
  if (!pos || !uv) return "";

  const index = geom.index;
  const triLen = index ? index.count : pos.count;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.clearRect(0, 0, size, size);

  ctx.strokeStyle = "rgba(126, 60, 140, 0.4)"; // Primary color, partially transparent
  ctx.lineWidth = 1;
  ctx.lineJoin = "round";

  ctx.beginPath();
  for (let t = 0; t < triLen; t += 3) {
    const a = index ? index.getX(t) : t;
    const b = index ? index.getX(t + 1) : t + 1;
    const c = index ? index.getX(t + 2) : t + 2;

    // We don't invert Y because we enforce flipY = false on the texture cache.
    // WebGL Y=0 matches Fabric.js Canvas Y=0 for these glTF models.
    const u0x = uv.getX(a) * size;
    const u0y = uv.getY(a) * size;
    const u1x = uv.getX(b) * size;
    const u1y = uv.getY(b) * size;
    const u2x = uv.getX(c) * size;
    const u2y = uv.getY(c) * size;

    ctx.moveTo(u0x, u0y);
    ctx.lineTo(u1x, u1y);
    ctx.lineTo(u2x, u2y);
    ctx.lineTo(u0x, u0y);
  }
  ctx.stroke();

  return canvas.toDataURL("image/png");
}

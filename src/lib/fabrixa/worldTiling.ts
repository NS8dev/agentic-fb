// World-space (triplanar) tiling + Localized UV Layer blending for fabric materials.
//
// Refactored to act as a unified material patcher for Garment materials.
// - Provides triplanar sampling for the base fabric (seamless).
// - Provides a secondary UV-sampled overlay map for decals/designs.

import * as THREE from "three";
import { APP_DATA_0 } from "./APP_DATA_0";

const FLAG = "__fabrixa_material_patch";

interface MaterialPatchState {
  patched: boolean;
  uniforms: {
    uWorldTileScale: { value: number };
    uTriplanarBlend: { value: number };
    uTextureRotation: { value: number };
    uTextureOffset: { value: THREE.Vector2 };
    uUseWorldTiling: { value: boolean };
    uLayerMap: { value: THREE.Texture | null };
    uHasLayerMap: { value: boolean };
  };
}

function getState(mat: THREE.Material): MaterialPatchState {
  const ud = mat.userData as Record<string, unknown>;
  let s = ud[FLAG] as MaterialPatchState | undefined;
  if (!s) {
    s = {
      patched: false,
      uniforms: {
        uWorldTileScale: { value: APP_DATA_0.tiling.defaultWorldScale },
        uTriplanarBlend: { value: APP_DATA_0.tiling.triplanarBlend },
        uTextureRotation: { value: 0 },
        uTextureOffset: { value: new THREE.Vector2(0, 0) },
        uUseWorldTiling: { value: false },
        uLayerMap: { value: null },
        uHasLayerMap: { value: false },
      },
    };
    ud[FLAG] = s;
  }
  return s;
}

function ensurePatch(material: THREE.Material) {
  const mat = material as THREE.MeshStandardMaterial;
  const state = getState(mat);
  if (state.patched) return;
  state.patched = true;

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uWorldTileScale = state.uniforms.uWorldTileScale;
    shader.uniforms.uTriplanarBlend = state.uniforms.uTriplanarBlend;
    shader.uniforms.uTextureRotation = state.uniforms.uTextureRotation;
    shader.uniforms.uTextureOffset = state.uniforms.uTextureOffset;
    shader.uniforms.uUseWorldTiling = state.uniforms.uUseWorldTiling;
    shader.uniforms.uLayerMap = state.uniforms.uLayerMap;
    shader.uniforms.uHasLayerMap = state.uniforms.uHasLayerMap;

    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec3 vFx_worldPos;
varying vec3 vFx_worldNormal;`,
      )
      .replace(
        "#include <worldpos_vertex>",
        `#include <worldpos_vertex>
#ifdef USE_INSTANCING
  vFx_worldPos = ( modelMatrix * instanceMatrix * vec4( transformed, 1.0 ) ).xyz;
#else
  vFx_worldPos = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;
#endif
vFx_worldNormal = normalize( ( modelMatrix * vec4( objectNormal, 0.0 ) ).xyz );`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec3 vFx_worldPos;
varying vec3 vFx_worldNormal;
uniform float uWorldTileScale;
uniform float uTriplanarBlend;
uniform float uTextureRotation;
uniform vec2 uTextureOffset;
uniform bool uUseWorldTiling;
uniform sampler2D uLayerMap;
uniform bool uHasLayerMap;

vec2 fx_rotateUV( vec2 uv, float a ) {
  float c = cos(a); float s = sin(a);
  return vec2( c*uv.x - s*uv.y, s*uv.x + c*uv.y );
}

vec4 fx_triplanar( sampler2D tex, vec3 worldPos, vec3 worldNormal, float scale ) {
  // Sharpen the normal blend slightly for better seams
  vec3 n = normalize( worldNormal );
  vec3 p = worldPos / max(scale, 0.0001);
  
  // Determine sign of normal to prevent texture mirroring on opposite sides
  float signX = n.x >= 0.0 ? 1.0 : -1.0;
  float signY = n.y >= 0.0 ? 1.0 : -1.0;
  float signZ = n.z >= 0.0 ? -1.0 : 1.0; // Z faces camera when positive, so U flows right-to-left unless flipped
  
  // Align Y consistently so patterns wrap horizontally around the body like a single loom.
  vec2 rawUvX = vec2( p.z * signX, p.y );
  vec2 rawUvY = vec2( p.x, p.z * signY );
  vec2 rawUvZ = vec2( p.x * signZ, p.y );

  vec2 uvX = fx_rotateUV( rawUvX + uTextureOffset, uTextureRotation );
  vec2 uvY = fx_rotateUV( rawUvY + uTextureOffset, uTextureRotation );
  vec2 uvZ = fx_rotateUV( rawUvZ + uTextureOffset, uTextureRotation );
  
  vec4 cX = texture2D( tex, uvX );
  vec4 cY = texture2D( tex, uvY );
  vec4 cZ = texture2D( tex, uvZ );
  vec3 w = pow( abs(n), vec3(uTriplanarBlend * 1.5) );
  w /= max( w.x + w.y + w.z, 0.0001 );
  return cX * w.x + cY * w.y + cZ * w.z;
}`,
      )
      .replace(
        "#include <normalmap_pars_fragment>",
        `#include <normalmap_pars_fragment>
#ifdef USE_NORMALMAP
vec3 fx_triplanar_normal( sampler2D normalMapTex, vec3 worldPos, vec3 worldNormal, float scale ) {
  vec3 n = normalize( worldNormal );
  vec3 p = worldPos / max(scale, 0.0001);
  
  float signX = n.x >= 0.0 ? 1.0 : -1.0;
  float signY = n.y >= 0.0 ? 1.0 : -1.0;
  float signZ = n.z >= 0.0 ? -1.0 : 1.0;

  vec2 rawUvX = vec2( p.z * signX, p.y );
  vec2 rawUvY = vec2( p.x, p.z * signY );
  vec2 rawUvZ = vec2( p.x * signZ, p.y );

  vec2 uvX = fx_rotateUV( rawUvX + uTextureOffset, uTextureRotation );
  vec2 uvY = fx_rotateUV( rawUvY + uTextureOffset, uTextureRotation );
  vec2 uvZ = fx_rotateUV( rawUvZ + uTextureOffset, uTextureRotation );

  vec3 tX = texture2D( normalMapTex, uvX ).xyz * 2.0 - 1.0;
  vec3 tY = texture2D( normalMapTex, uvY ).xyz * 2.0 - 1.0;
  vec3 tZ = texture2D( normalMapTex, uvZ ).xyz * 2.0 - 1.0;

  tX.xy *= normalScale;
  tY.xy *= normalScale;
  tZ.xy *= normalScale;

  tX.z = sqrt( max( 0.0, 1.0 - dot( tX.xy, tX.xy ) ) );
  tY.z = sqrt( max( 0.0, 1.0 - dot( tY.xy, tY.xy ) ) );
  tZ.z = sqrt( max( 0.0, 1.0 - dot( tZ.xy, tZ.xy ) ) );

  vec3 nX = vec3( tX.z * signX, tX.y, tX.x * signX );
  vec3 nY = vec3( tY.x, tY.z * signY, tY.y * signY );
  vec3 nZ = vec3( tZ.x * signZ, tZ.y, tZ.z * signZ );

  vec3 w = pow( abs(n), vec3(uTriplanarBlend * 1.5) );
  w /= max( w.x + w.y + w.z, 0.0001 );

  return normalize( nX * w.x + nY * w.y + nZ * w.z );
}
#endif`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#if defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN;
	if (uUseWorldTiling) {
		vec3 normalWorld = fx_triplanar_normal( normalMap, vFx_worldPos, vFx_worldNormal, uWorldTileScale );
		normal = normalize( ( viewMatrix * vec4( normalWorld, 0.0 ) ).xyz );
	} else {
		mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
		#if defined( USE_PACKED_NORMALMAP )
			mapN = vec3( mapN.xy, sqrt( saturate( 1.0 - dot( mapN.xy, mapN.xy ) ) ) );
		#endif
		mapN.xy *= normalScale;
		normal = normalize( tbn * mapN );
	}
#elif defined( USE_NORMALMAP_OBJECTSPACE )
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,
      )
      .replace(
        "#include <map_fragment>",
        `#ifdef USE_MAP
  vec4 sampledDiffuseColor;
  if (uUseWorldTiling) {
    sampledDiffuseColor = fx_triplanar( map, vFx_worldPos, vFx_worldNormal, uWorldTileScale );
  } else {
    sampledDiffuseColor = texture2D( map, vMapUv );
  }
  #ifdef DECODE_VIDEO_TEXTURE
    sampledDiffuseColor = sRGBTransferOETF( sampledDiffuseColor );
  #endif
  diffuseColor *= sampledDiffuseColor;
#endif

// Design layers: UV-mapped decals (clamp, no repeat — independent from base fabric tiling)
if (uHasLayerMap) {
  #ifdef USE_UV
    vec2 layerUv = clamp(vUv, 0.0, 1.0);
    vec4 layerTexel = texture2D(uLayerMap, layerUv);
    diffuseColor.rgb = mix(diffuseColor.rgb, layerTexel.rgb, layerTexel.a);
  #endif
}`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#ifdef USE_EMISSIVEMAP
  vec4 emissiveColor;
  if (uUseWorldTiling) {
    emissiveColor = fx_triplanar( emissiveMap, vFx_worldPos, vFx_worldNormal, uWorldTileScale );
  } else {
    emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
  }
  #ifdef DECODE_VIDEO_TEXTURE
    emissiveColor = sRGBTransferOETF( emissiveColor );
  #endif
  totalEmissiveRadiance *= emissiveColor.rgb;
#endif

// Fix ghosting: Overwrite emissive radiance with layer decal so base pattern doesn't shine through
if (uHasLayerMap) {
  #ifdef USE_UV
    vec2 layerUv = clamp(vUv, 0.0, 1.0);
    vec4 layerTexel = texture2D(uLayerMap, layerUv);
    #ifdef USE_EMISSIVEMAP
      totalEmissiveRadiance = mix(totalEmissiveRadiance, emissive * layerTexel.rgb, layerTexel.a);
    #endif
  #endif
}`,
      );
  };

  mat.customProgramCacheKey = () => "fabrixa_advanced_material_v4";
  mat.needsUpdate = true;
}

export function enableWorldTiling(
  material: THREE.Material,
  opts: { worldScale: number; rotationDeg: number; offsetX: number; offsetY: number },
) {
  ensurePatch(material);
  const state = getState(material);
  state.uniforms.uUseWorldTiling.value = true;
  state.uniforms.uWorldTileScale.value = Math.max(0.01, opts.worldScale);
  state.uniforms.uTextureRotation.value = (opts.rotationDeg * Math.PI) / 180;
  state.uniforms.uTextureOffset.value.set(opts.offsetX, opts.offsetY);
}

export function disableWorldTiling(material: THREE.Material) {
  ensurePatch(material);
  getState(material).uniforms.uUseWorldTiling.value = false;
}

export function updateWorldTilingUniforms(
  material: THREE.Material,
  opts: { worldScale: number; rotationDeg: number; offsetX: number; offsetY: number },
) {
  const state = getState(material);
  state.uniforms.uWorldTileScale.value = Math.max(0.01, opts.worldScale);
  state.uniforms.uTextureRotation.value = (opts.rotationDeg * Math.PI) / 180;
  state.uniforms.uTextureOffset.value.set(opts.offsetX, opts.offsetY);
}

export function setLayerMap(material: THREE.Material, map: THREE.Texture | null) {
  ensurePatch(material);
  const state = getState(material);
  state.uniforms.uLayerMap.value = map;
  state.uniforms.uHasLayerMap.value = !!map;
}

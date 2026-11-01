import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import {
  ThemeId,
  LightingMode,
  PitchBendDirection,
  computeFadeIntensity,
  computeStrobeIntensity,
  computeEffectiveBpm,
  stepBeatPhase,
  computeBeatPulse,
} from '../utils/stageEngine';

export interface StageCanvasProps {
  activeTheme: ThemeId;
  lightingMode: LightingMode;
  baseBpm: number;
  pitchBend: PitchBendDirection;
  pitchBendRangePercent: number;
  autoBpm: boolean;
  strobeHeld: boolean;
  strobeRateHz: number;
  fadeTrigger: { id: number; durationMs: number; key: string; timestamp: number } | null;
  syncTrigger: number;
  onBeatTelemetry?: (beatIndex: number, phase: number, lightLevel: number) => void;
}

// Pre-allocated math helpers outside the render loop (Zero GC)
const _dummy = new THREE.Object3D();
const _targetCamPos = new THREE.Vector3();
const _targetLookAt = new THREE.Vector3();
const _bgColor = new THREE.Color(0x010102);

export const StageCanvas: React.FC<StageCanvasProps> = ({
  activeTheme,
  lightingMode,
  baseBpm,
  pitchBend,
  pitchBendRangePercent,
  autoBpm,
  strobeHeld,
  strobeRateHz,
  fadeTrigger,
  syncTrigger,
  onBeatTelemetry,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const blinderOverlayRef = useRef<HTMLDivElement | null>(null);

  const propsRef = useRef({
    activeTheme,
    lightingMode,
    baseBpm,
    pitchBend,
    pitchBendRangePercent,
    autoBpm,
    strobeHeld,
    strobeRateHz,
    onBeatTelemetry,
  });

  useEffect(() => {
    propsRef.current = {
      activeTheme,
      lightingMode,
      baseBpm,
      pitchBend,
      pitchBendRangePercent,
      autoBpm,
      strobeHeld,
      strobeRateHz,
      onBeatTelemetry,
    };
  }, [
    activeTheme,
    lightingMode,
    baseBpm,
    pitchBend,
    pitchBendRangePercent,
    autoBpm,
    strobeHeld,
    strobeRateHz,
    onBeatTelemetry,
  ]);

  const runtimeRef = useRef({
    lastFrameTime: performance.now(),
    elapsedSec: 0,
    cameraOrbitTime: 0,
    beatPhase: 0,
    beatCount: 0,
    fadeStartPerf: -99999,
    fadeDurationMs: 0,
    pendingFade: false,
    strobeStartPerf: 0,
    wasStrobeHeld: false,
    lastTelemetrySent: 0,
  });

  useEffect(() => {
    if (fadeTrigger && fadeTrigger.id > 0) {
      runtimeRef.current.pendingFade = true;
      runtimeRef.current.fadeStartPerf = performance.now();
      runtimeRef.current.fadeDurationMs = fadeTrigger.durationMs;
    }
  }, [fadeTrigger]);

  useEffect(() => {
    if (syncTrigger > 0) {
      runtimeRef.current.beatPhase = 0;
      runtimeRef.current.beatCount = Math.floor(runtimeRef.current.beatCount / 4) * 4;
    }
  }, [syncTrigger]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Detect Software WebGL (SwiftShader / llvmpipe) per Three.js skill
    const isSoftwareGl = (() => {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);

    // High-contrast real-time Shadow Map configuration
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    renderer.domElement.setAttribute('data-testid', 'stage-canvas');
    renderer.domElement.className = 'block w-full h-full pointer-events-none';
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x010102);
    // Deep atmospheric exponential fog so distant geometry dissolves into pitch black
    scene.fog = new THREE.FogExp2(0x010102, 0.046);

    // Subtle Studio Environment Map for razor-sharp specular highlights on obsidian
    // Kept very low (0.08) so shadows remain pitch black instead of washed-out gray
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;
    scene.environmentIntensity = 0.08;
    pmremGenerator.dispose();

    const initAspect = window.innerWidth / window.innerHeight;
    const camera = new THREE.PerspectiveCamera(
      initAspect < 1 ? 68 : 46,
      initAspect,
      0.1,
      140
    );
    camera.position.set(0, 0.55, 8.8);
    camera.lookAt(0, 0.4, -12);

    // =========================================================================
    // POST-PROCESSING: REAL OPTICAL BLOOM + ACES FILMIC OUTPUT
    // =========================================================================
    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(
        isSoftwareGl ? Math.floor(window.innerWidth / 2) : window.innerWidth,
        isSoftwareGl ? Math.floor(window.innerHeight / 2) : window.innerHeight
      ),
      0.38, // strength — tight, realistic optical halo in baseline state
      0.32, // radius — crisp glow around neon strips without washing out dark space
      0.88  // threshold — only pure white emissives (>0.88) & sharp glints bloom
    );
    composer.addPass(bloomPass);

    const outputPass = new OutputPass();
    composer.addPass(outputPass);

    // =========================================================================
    // HIGH-CONTRAST CHIAROSCURO LIGHTING & SHADOW RIG
    // (Near-zero ambient fill + strong directional & spot shadow casters)
    // =========================================================================
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.015);
    scene.add(ambientLight);

    // Dramatic raking DirectionalLight casting crisp diagonal pillar & shard shadows
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.45);
    keyLight.position.set(8.5, 11.0, 5.5);
    keyLight.castShadow = true;
    const shadowRes = isSoftwareGl ? 1024 : 2048;
    keyLight.shadow.mapSize.set(shadowRes, shadowRes);
    keyLight.shadow.camera.near = 1.0;
    keyLight.shadow.camera.far = 42;
    keyLight.shadow.camera.left = -13;
    keyLight.shadow.camera.right = 13;
    keyLight.shadow.camera.top = 13;
    keyLight.shadow.camera.bottom = -13;
    keyLight.shadow.bias = -0.0004;
    keyLight.shadow.normalBias = 0.015;
    keyLight.shadow.radius = 1.8;
    scene.add(keyLight);

    // Overhead high-contrast SpotLight carving a pool of light in the center stage
    // while leaving the outer perimeter in deep shadow
    const mainStageSpot = new THREE.SpotLight(0xffffff, 16, 34, Math.PI / 3.8, 0.68, 1.6);
    mainStageSpot.position.set(-3.2, 10.5, 2.0);
    mainStageSpot.target.position.set(0, -2.2, -9.5);
    mainStageSpot.castShadow = true;
    mainStageSpot.shadow.mapSize.set(shadowRes, shadowRes);
    mainStageSpot.shadow.camera.near = 2.0;
    mainStageSpot.shadow.camera.far = 32;
    mainStageSpot.shadow.bias = -0.0003;
    mainStageSpot.shadow.radius = 2.0;
    scene.add(mainStageSpot);
    scene.add(mainStageSpot.target);

    // Dynamic Stage Blinder Lights (driven by Q~P Fade & Space Strobe)
    const centerStageLight = new THREE.PointLight(0xffffff, 0.25, 42, 1.6);
    centerStageLight.position.set(0, 2.4, -5);
    scene.add(centerStageLight);

    const frontWashLight = new THREE.SpotLight(0xffffff, 0, 52, Math.PI / 2.5, 0.75, 1.5);
    frontWashLight.position.set(0, 6.5, 12.5);
    frontWashLight.target.position.set(0, -0.5, -10);
    scene.add(frontWashLight);
    scene.add(frontWashLight.target);

    // =========================================================================
    // HIGH-CONTRAST MONOCHROME PBR MATERIALS
    // =========================================================================
    // Pitch-black volcanic glass with ultra-sharp clearcoat specular reflections
    const obsidianGlossMat = new THREE.MeshPhysicalMaterial({
      color: 0x020203,
      roughness: 0.09,
      metalness: 0.9,
      clearcoat: 1.0,
      clearcoatRoughness: 0.07,
      reflectivity: 1.0,
      envMapIntensity: 0.55,
    });

    // Dark architectural floor that catches dramatic shadows and subtle light pools
    const darkMirrorFloorMat = new THREE.MeshStandardMaterial({
      color: 0x060608,
      roughness: 0.52,
      metalness: 0.25,
      envMapIntensity: 0.06,
    });

    // Inner polished runway slab inside the glowing white floor frame
    const runwayMirrorMat = new THREE.MeshPhysicalMaterial({
      color: 0x030305,
      roughness: 0.16,
      metalness: 0.75,
      clearcoat: 0.85,
      clearcoatRoughness: 0.12,
      envMapIntensity: 0.2,
    });

    // Deep charcoal brutalist concrete (unlit faces fall to near-black, lit edges show crisp shadow steps)
    const architecturalConcreteMat = new THREE.MeshStandardMaterial({
      color: 0x0b0b0e,
      roughness: 0.76,
      metalness: 0.15,
      envMapIntensity: 0.06,
    });

    // Precision dark graphite for beveled tiles & portal frames
    const graphiteBevelMat = new THREE.MeshPhysicalMaterial({
      color: 0x0a0a0e,
      roughness: 0.24,
      metalness: 0.82,
      clearcoat: 0.65,
      clearcoatRoughness: 0.2,
      envMapIntensity: 0.25,
    });

    // High-emissive pure white neon/architectural light material (drives UnrealBloomPass)
    const emissiveWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 1.45,
      roughness: 0.05,
      metalness: 0.0,
    });

    const wireframeLineMat = new THREE.LineBasicMaterial({
      color: 0xe4e4e7,
      transparent: true,
      opacity: 0.72,
    });

    const roomCageLineMat = new THREE.LineBasicMaterial({
      color: 0x27272a,
      transparent: true,
      opacity: 0.32,
    });

    // Store theme groups (0..8)
    const themeGroups: Record<number, THREE.Group> = {};
    for (let i = 0; i <= 8; i++) {
      const g = new THREE.Group();
      g.visible = i === propsRef.current.activeTheme;
      scene.add(g);
      themeGroups[i] = g;
    }

    // =========================================================================
    // THEME 0: BLACKOUT (Stealth 3D Concert Blinder & Anamorphic Horizon Rig —
    // 100% Pitch Black at rest; ignites with 3D Stage Blinders & Mirror Runway on Q~P / Space)
    // =========================================================================
    const blackoutNeonMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 0,
      roughness: 0.08,
      metalness: 0.0,
    });
    let blackoutSpotLight: THREE.SpotLight | null = null;
    let blackoutHorizonLight: THREE.PointLight | null = null;
    let blackoutApertureGroup: THREE.Group | null = null;
    {
      const g0 = themeGroups[0];

      // Dark mirror floor & central runway that stay pitch-black until Q~P or Space fires
      const floor0 = new THREE.Mesh(new THREE.PlaneGeometry(40, 60), darkMirrorFloorMat);
      floor0.rotation.x = -Math.PI / 2;
      floor0.position.set(0, -2.2, -12);
      floor0.receiveShadow = true;
      g0.add(floor0);

      const runway0 = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 22), runwayMirrorMat);
      runway0.rotation.x = -Math.PI / 2;
      runway0.position.set(0, -2.18, -10.5);
      runway0.receiveShadow = true;
      g0.add(runway0);

      // Flanking dark brutalist monoliths that catch raking rim light & cast shadows during flash
      const monoGeo0 = new THREE.BoxGeometry(1.6, 14, 1.6);
      const slitGeo0 = new THREE.BoxGeometry(0.038, 12.5, 0.038);
      for (let i = 0; i < 4; i++) {
        const z = -3.4 - i * 4.2;
        [-5.4, 5.4].forEach((x) => {
          const m = new THREE.Mesh(monoGeo0, architecturalConcreteMat);
          m.position.set(x, 4.6, z);
          m.castShadow = true;
          m.receiveShadow = true;
          g0.add(m);

          // Place glowing vertical slits on alternate pillars (i % 2 === 1) so foreground
          // pillars remain dark silhouettes casting crisp shadows
          if (i % 2 === 1) {
            const inwardX = x > 0 ? x - 0.82 : x + 0.82;
            const slit = new THREE.Mesh(slitGeo0, blackoutNeonMat);
            slit.position.set(inwardX, 4.0, z + 0.82);
            g0.add(slit);
          }
        });
      }

      // Converging runway floor light blades
      const floorBladeGeo = new THREE.BoxGeometry(0.055, 0.035, 18.0);
      [-2.6, 2.6].forEach((x) => {
        const fb = new THREE.Mesh(floorBladeGeo, blackoutNeonMat);
        fb.position.set(x, -2.15, -10.5);
        g0.add(fb);
      });

      // Anamorphic Horizon Light Blade & Geometric Stage Blinder Aperture at back of stage
      blackoutApertureGroup = new THREE.Group();
      blackoutApertureGroup.position.set(0, 1.35, -13.5);

      const horizonBar = new THREE.Mesh(
        new THREE.BoxGeometry(10.4, 0.045, 0.045),
        blackoutNeonMat
      );
      blackoutApertureGroup.add(horizonBar);

      // Precision 3D Diamond & Square Concert Blinder Frames
      const blinderRadii = [1.25, 2.35, 3.55];
      blinderRadii.forEach((r, idx) => {
        const frameGroup = new THREE.Group();
        const barLen = r * 2;
        const thick = idx === 0 ? 0.048 : 0.036;
        const hGeo = new THREE.BoxGeometry(barLen + thick, thick, thick);
        const vGeo = new THREE.BoxGeometry(thick, barLen - thick, thick);

        const top = new THREE.Mesh(hGeo, blackoutNeonMat);
        top.position.y = r;
        const bot = new THREE.Mesh(hGeo, blackoutNeonMat);
        bot.position.y = -r;
        const left = new THREE.Mesh(vGeo, blackoutNeonMat);
        left.position.x = -r;
        const right = new THREE.Mesh(vGeo, blackoutNeonMat);
        right.position.x = r;

        frameGroup.add(top, bot, left, right);
        frameGroup.rotation.z = idx % 2 === 0 ? Math.PI / 4 : 0;
        frameGroup.position.z = idx * 0.9;
        blackoutApertureGroup!.add(frameGroup);
      });
      g0.add(blackoutApertureGroup);

      // Dedicated Blackout 3D Stage Spot & Horizon Point Light (0 intensity at rest)
      blackoutSpotLight = new THREE.SpotLight(0xffffff, 0, 36, Math.PI / 3.6, 0.68, 1.6);
      blackoutSpotLight.position.set(0, 9.5, 1.5);
      blackoutSpotLight.target.position.set(0, -2.2, -10.5);
      g0.add(blackoutSpotLight);
      g0.add(blackoutSpotLight.target);

      blackoutHorizonLight = new THREE.PointLight(0xffffff, 0, 24, 1.7);
      blackoutHorizonLight.position.set(0, 1.35, -11.5);
      g0.add(blackoutHorizonLight);
    }

    // =========================================================================
    // THEME 1: OBSIDIAN CATHEDRAL HALL (Reference Image 2 — High-Contrast
    // Monolithic Hall, Vertical Blooming Light Slits, Double Luminous Floor
    // Frame, Deep Pillar Shadows & Glossy Faceted Black Ceiling Shards)
    // =========================================================================
    {
      const g1 = themeGroups[1];

      // Focused grazing point lights tucked near the upper obsidian shards so their
      // angled black facets catch sharp white specular streaks while their shadow
      // faces remain pitch black (matching Reference Image 2)
      const shardGlintLight1 = new THREE.PointLight(0xffffff, 5.2, 8.5, 1.9);
      shardGlintLight1.position.set(-1.6, 3.6, -6.8);
      g1.add(shardGlintLight1);

      const shardGlintLight2 = new THREE.PointLight(0xffffff, 4.8, 9.0, 1.9);
      shardGlintLight2.position.set(1.6, 3.3, -10.5);
      g1.add(shardGlintLight2);

      // Deep dark architectural floor receiving crisp pillar & shard shadows
      const floorGeo = new THREE.PlaneGeometry(42, 64);
      const floorMesh = new THREE.Mesh(floorGeo, darkMirrorFloorMat);
      floorMesh.rotation.x = -Math.PI / 2;
      floorMesh.position.set(0, -2.2, -14);
      floorMesh.receiveShadow = true;
      g1.add(floorMesh);

      // Inner dark polished obsidian runway slab inside the glowing white border
      const runwaySlab = new THREE.Mesh(
        new THREE.PlaneGeometry(5.5, 20.0),
        runwayMirrorMat
      );
      runwaySlab.rotation.x = -Math.PI / 2;
      runwaySlab.position.set(0, -2.18, -10.5);
      runwaySlab.receiveShadow = true;
      g1.add(runwaySlab);

      // Double Rectangular White Light Frame on the Runway Floor (drives optical Bloom!)
      const createFloorFrame = (width: number, length: number, thickness: number, y: number) => {
        const frameGroup = new THREE.Group();
        const sideGeo = new THREE.BoxGeometry(thickness, 0.045, length);
        const endGeo = new THREE.BoxGeometry(width + thickness, 0.045, thickness);

        const left = new THREE.Mesh(sideGeo, emissiveWhiteMat);
        left.position.set(-width / 2, y, -10.5);

        const right = new THREE.Mesh(sideGeo, emissiveWhiteMat);
        right.position.set(width / 2, y, -10.5);

        const front = new THREE.Mesh(endGeo, emissiveWhiteMat);
        front.position.set(0, y, -10.5 + length / 2);

        const back = new THREE.Mesh(endGeo, emissiveWhiteMat);
        back.position.set(0, y, -10.5 - length / 2);

        frameGroup.add(left, right, front, back);
        return frameGroup;
      };

      g1.add(createFloorFrame(5.6, 20.0, 0.18, -2.15));
      g1.add(createFloorFrame(4.9, 19.2, 0.05, -2.15));

      // Monolithic Concrete Columns with Razor-Thin Vertical White Light Slits (Left & Right)
      const colGeo = new THREE.BoxGeometry(1.75, 16, 1.75);
      const stripGeo = new THREE.BoxGeometry(0.045, 15.6, 0.045);

      for (let i = 0; i < 5; i++) {
        const z = -2.2 - i * 4.6;
        [-5.5, 5.5].forEach((x) => {
          const colGroup = new THREE.Group();
          const colMesh = new THREE.Mesh(colGeo, architecturalConcreteMat);
          colMesh.position.set(x, 5.6, z);
          colMesh.castShadow = true;
          colMesh.receiveShadow = true;
          colGroup.add(colMesh);

          // Razor-thin glowing vertical light strip on the inner front corner
          const inwardX = x > 0 ? x - 0.89 : x + 0.89;
          const stripMesh = new THREE.Mesh(stripGeo, emissiveWhiteMat);
          stripMesh.position.set(inwardX, 5.6, z + 0.89);
          colGroup.add(stripMesh);

          g1.add(colGroup);
        });
      }

      // Hanging Jagged Glossy Black Obsidian Shards suspended from the ceiling
      const shardCount = 52;
      const shardGeo = new THREE.ConeGeometry(0.72, 4.9, 3);
      shardGeo.rotateX(Math.PI); // Razor-sharp tip points DOWN (-Y)
      shardGeo.translate(0, -2.45, 0); // Pivot at ceiling
      shardGeo.computeVertexNormals();

      const shardInstanced = new THREE.InstancedMesh(shardGeo, obsidianGlossMat, shardCount);
      shardInstanced.frustumCulled = false;
      shardInstanced.castShadow = true;
      shardInstanced.receiveShadow = true;

      for (let i = 0; i < shardCount; i++) {
        const sx = Math.sin(i * 19.3) * 3.2;
        const sz = -4.8 - (i / shardCount) * 14.5;
        const sy = 5.8 + Math.cos(i * 7.1) * 0.35;
        _dummy.position.set(sx, sy, sz);
        _dummy.rotation.set(
          Math.sin(i * 3.1) * 0.22,
          i * 1.35,
          Math.cos(i * 2.7) * 0.24
        );
        const centerFactor = Math.max(0, 1 - Math.abs(sx) / 3.4);
        const scaleY = (0.52 + (i % 4) * 0.14) * (0.65 + centerFactor * 0.6);
        const scaleX = 0.5 + (i % 3) * 0.3;
        const scaleZ = 0.2 + (i % 2) * 0.16;
        _dummy.scale.set(scaleX, scaleY, scaleZ);
        _dummy.updateMatrix();
        shardInstanced.setMatrixAt(i, _dummy.matrix);
      }
      shardInstanced.instanceMatrix.needsUpdate = true;
      g1.add(shardInstanced);
      g1.userData.shardInstanced = shardInstanced;
    }

    // =========================================================================
    // THEME 2: WIREFRAME TOPOGRAPHY ROOM (Reference Image 3 — Full 3D Architectural
    // Perspective Grid Room, Luminous Structural Ribs & Undulating Vertex Terrain)
    // =========================================================================
    let terrainPosAttr: THREE.BufferAttribute | null = null;
    let terrainDotsAttr: THREE.BufferAttribute | null = null;
    let terrainWireGeo: THREE.PlaneGeometry | null = null;
    {
      const g2 = themeGroups[2];

      const createGridWall = (w: number, h: number, segW: number, segH: number) => {
        const plane = new THREE.PlaneGeometry(w, h, segW, segH);
        const wire = new THREE.WireframeGeometry(plane);
        return new THREE.LineSegments(wire, roomCageLineMat);
      };

      const leftWall = createGridWall(36, 14, 24, 12);
      leftWall.rotation.y = Math.PI / 2;
      leftWall.position.set(-10.8, 3.0, -10);
      g2.add(leftWall);

      const rightWall = createGridWall(36, 14, 24, 12);
      rightWall.rotation.y = -Math.PI / 2;
      rightWall.position.set(10.8, 3.0, -10);
      g2.add(rightWall);

      const ceilingGrid = createGridWall(21.6, 36, 18, 24);
      ceilingGrid.rotation.x = Math.PI / 2;
      ceilingGrid.position.set(0, 7.2, -10);
      g2.add(ceilingGrid);

      const backWall = createGridWall(21.6, 14, 18, 12);
      backWall.position.set(0, 3.0, -26);
      g2.add(backWall);

      // Luminous architectural ceiling & wall ribs so the upper chamber has crisp 3D depth
      const ribHorizGeo = new THREE.BoxGeometry(21.6, 0.04, 0.04);
      const ribVertGeo = new THREE.BoxGeometry(0.04, 9.8, 0.04);
      for (let i = 0; i < 5; i++) {
        const z = -2.5 - i * 4.8;
        const ceilRib = new THREE.Mesh(ribHorizGeo, emissiveWhiteMat);
        ceilRib.position.set(0, 7.15, z);
        g2.add(ceilRib);

        [-10.75, 10.75].forEach((x) => {
          const wallRib = new THREE.Mesh(ribVertGeo, emissiveWhiteMat);
          wallRib.position.set(x, 2.25, z);
          g2.add(wallRib);
        });
      }

      const segX = 46;
      const segZ = 38;
      terrainWireGeo = new THREE.PlaneGeometry(21.6, 30, segX, segZ);
      terrainWireGeo.rotateX(-Math.PI / 2);

      const solidTerrainMat = new THREE.MeshBasicMaterial({
        color: 0x010102,
        polygonOffset: true,
        polygonOffsetFactor: 2,
        polygonOffsetUnits: 2,
      });
      const solidTerrainMesh = new THREE.Mesh(terrainWireGeo, solidTerrainMat);
      solidTerrainMesh.position.set(0, -2.5, -9);
      g2.add(solidTerrainMesh);

      const wireTerrainMat = new THREE.MeshBasicMaterial({
        color: 0xd4d4d8,
        wireframe: true,
        transparent: true,
        opacity: 0.56,
      });
      const wireTerrainMesh = new THREE.Mesh(terrainWireGeo, wireTerrainMat);
      wireTerrainMesh.position.set(0, -2.49, -9);
      g2.add(wireTerrainMesh);

      // Bright white glowing vertex dots at every grid intersection
      const dotsGeo = new THREE.BufferGeometry();
      const vertexCount = terrainWireGeo.attributes.position.count;
      const dotPositions = new Float32Array(vertexCount * 3);
      dotsGeo.setAttribute('position', new THREE.BufferAttribute(dotPositions, 3));

      const dotsMat = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.145,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.98,
      });
      const terrainDots = new THREE.Points(dotsGeo, dotsMat);
      terrainDots.position.set(0, -2.47, -9);
      g2.add(terrainDots);

      terrainPosAttr = terrainWireGeo.attributes.position as THREE.BufferAttribute;
      terrainDotsAttr = dotsGeo.attributes.position as THREE.BufferAttribute;
    }

    // =========================================================================
    // THEME 3: CARBON TILE MATRIX VAULT (Reference Image 1 — Precision 3D
    // Beveled Dark Square Grid Tiles with High-Contrast Raking Spotlight & Shadows)
    // =========================================================================
    let tileWallInstanced: THREE.InstancedMesh | null = null;
    const tileCols = 38;
    const tileRows = 22;
    {
      const g3 = themeGroups[3];
      const totalTiles = tileCols * tileRows;

      const tileGeo = new THREE.BoxGeometry(0.55, 0.55, 0.32);
      tileWallInstanced = new THREE.InstancedMesh(tileGeo, graphiteBevelMat, totalTiles);
      tileWallInstanced.frustumCulled = false;
      tileWallInstanced.castShadow = true;
      tileWallInstanced.receiveShadow = true;

      // Focused bottom-center raking spotlight creating Reference 1's radial light falloff
      const matrixSpot = new THREE.PointLight(0xffffff, 20.0, 15, 1.75);
      matrixSpot.position.set(0, -2.6, 2.4);
      g3.add(matrixSpot);
      g3.userData.matrixSpot = matrixSpot;

      g3.add(tileWallInstanced);
    }

    // =========================================================================
    // THEME 4: BRUTALIST LIGHT COLONNADE (3D Dark Concrete Arch Portals,
    // Mirror Runway Walkway, Alternating Shadow Arches & Razor-Sharp White Portals)
    // =========================================================================
    const archNeonMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 0.98,
      roughness: 0.12,
      metalness: 0.0,
    });
    {
      const g4 = themeGroups[4];

      const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(34, 64), darkMirrorFloorMat);
      floorMesh.rotation.x = -Math.PI / 2;
      floorMesh.position.set(0, -2.4, -16);
      floorMesh.receiveShadow = true;
      g4.add(floorMesh);

      const mirrorWalkway = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 46), runwayMirrorMat);
      mirrorWalkway.rotation.x = -Math.PI / 2;
      mirrorWalkway.position.set(0, -2.38, -16);
      mirrorWalkway.receiveShadow = true;
      g4.add(mirrorWalkway);

      const archCount = 9;
      for (let i = 0; i < archCount; i++) {
        const z = -1 - i * 4.4;
        const archGroup = new THREE.Group();

        const pillarGeo = new THREE.BoxGeometry(1.45, 11, 1.3);
        const leftPillar = new THREE.Mesh(pillarGeo, architecturalConcreteMat);
        leftPillar.position.set(-5.2, 3.1, z);
        leftPillar.castShadow = true;
        leftPillar.receiveShadow = true;
        const rightPillar = new THREE.Mesh(pillarGeo, architecturalConcreteMat);
        rightPillar.position.set(5.2, 3.1, z);
        rightPillar.castShadow = true;
        rightPillar.receiveShadow = true;

        const lintelGeo = new THREE.BoxGeometry(11.9, 1.45, 1.3);
        const lintel = new THREE.Mesh(lintelGeo, architecturalConcreteMat);
        lintel.position.set(0, 8.2, z);
        lintel.castShadow = true;
        lintel.receiveShadow = true;

        archGroup.add(leftPillar, rightPillar, lintel);

        // Place razor-thin glowing white frames on alternate arches (i % 2 === 1)
        // so the foreground concrete arch frames the colonnade in deep shadow without whitewash
        if (i % 2 === 1) {
          const vLightGeo = new THREE.BoxGeometry(0.042, 9.8, 0.042);
          const leftLight = new THREE.Mesh(vLightGeo, archNeonMat);
          leftLight.position.set(-4.44, 2.6, z);
          const rightLight = new THREE.Mesh(vLightGeo, archNeonMat);
          rightLight.position.set(4.44, 2.6, z);

          const hLightGeo = new THREE.BoxGeometry(8.92, 0.042, 0.042);
          const topLight = new THREE.Mesh(hLightGeo, archNeonMat);
          topLight.position.set(0, 7.45, z);
          const bottomLight = new THREE.Mesh(hLightGeo, archNeonMat);
          bottomLight.position.set(0, -2.35, z);

          archGroup.add(leftLight, rightLight, topLight, bottomLight);
        }

        g4.add(archGroup);
      }
    }

    // =========================================================================
    // THEME 5: SUSPENDED OBSIDIAN SHARDS (3D Crystalline Obsidian Obelisk Vortex,
    // Luminous Octagonal Altar Floor & Suspended Monolith Light Blades)
    // =========================================================================
    let floatingShardsInstanced: THREE.InstancedMesh | null = null;
    let floatingWireGroup: THREE.Group | null = null;
    const shardFieldCount = 64;
    {
      const g5 = themeGroups[5];

      // Dark reflective floor beneath the swirling obsidian shard vortex
      const floor5 = new THREE.Mesh(new THREE.PlaneGeometry(40, 50), darkMirrorFloorMat);
      floor5.rotation.x = -Math.PI / 2;
      floor5.position.set(0, -2.5, -6);
      floor5.receiveShadow = true;
      g5.add(floor5);

      // Luminous concentric square/diamond altar frames on the floor
      [3.8, 6.4].forEach((size, idx) => {
        const ringGroup = new THREE.Group();
        const barT = idx === 0 ? 0.09 : 0.05;
        const hG = new THREE.BoxGeometry(size + barT, 0.04, barT);
        const vG = new THREE.BoxGeometry(barT, 0.04, size - barT);
        const f = new THREE.Mesh(hG, emissiveWhiteMat);
        f.position.set(0, -2.46, size / 2);
        const b = new THREE.Mesh(hG, emissiveWhiteMat);
        b.position.set(0, -2.46, -size / 2);
        const l = new THREE.Mesh(vG, emissiveWhiteMat);
        l.position.set(-size / 2, -2.46, 0);
        const r = new THREE.Mesh(vG, emissiveWhiteMat);
        r.position.set(size / 2, -2.46, 0);
        ringGroup.add(f, b, l, r);
        ringGroup.position.set(0, 0, -5.0);
        ringGroup.rotation.y = idx === 0 ? Math.PI / 4 : 0;
        g5.add(ringGroup);
      });

      // Central Suspended Glossy Black Monolith & Luminous White Vertical Core Slits
      const centralCoreGroup = new THREE.Group();
      centralCoreGroup.position.set(0, 0.85, -5.0);
      const coreObelisk = new THREE.Mesh(
        new THREE.ConeGeometry(1.15, 4.4, 4),
        obsidianGlossMat
      );
      coreObelisk.castShadow = true;
      coreObelisk.receiveShadow = true;
      centralCoreGroup.add(coreObelisk);

      const coreInvert = new THREE.Mesh(
        new THREE.ConeGeometry(1.15, 2.4, 4),
        obsidianGlossMat
      );
      coreInvert.rotation.x = Math.PI;
      coreInvert.position.y = -3.4;
      coreInvert.castShadow = true;
      centralCoreGroup.add(coreInvert);

      // Glowing white vertical & horizontal light blades piercing the central monolith
      const vBlade = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 6.2, 0.06),
        emissiveWhiteMat
      );
      vBlade.position.y = -0.5;
      const hBlade1 = new THREE.Mesh(
        new THREE.BoxGeometry(3.4, 0.055, 0.055),
        emissiveWhiteMat
      );
      hBlade1.position.y = -1.2;
      const hBlade2 = new THREE.Mesh(
        new THREE.BoxGeometry(0.055, 0.055, 3.4),
        emissiveWhiteMat
      );
      hBlade2.position.y = -1.2;
      centralCoreGroup.add(vBlade, hBlade1, hBlade2);
      g5.add(centralCoreGroup);

      // Grazing point lights to make the 64 orbiting obsidian crystal blades gleam
      const vortexLight1 = new THREE.PointLight(0xffffff, 16, 20, 1.7);
      vortexLight1.position.set(-3.5, 2.8, -2.5);
      g5.add(vortexLight1);

      const vortexLight2 = new THREE.PointLight(0xd4d4d8, 14, 20, 1.7);
      vortexLight2.position.set(3.5, 1.5, -7.5);
      g5.add(vortexLight2);

      // Sharp 4-sided faceted obsidian crystal blades
      const shardBladeGeo = new THREE.ConeGeometry(0.46, 2.8, 4);
      shardBladeGeo.computeVertexNormals();
      floatingShardsInstanced = new THREE.InstancedMesh(
        shardBladeGeo,
        obsidianGlossMat,
        shardFieldCount
      );
      floatingShardsInstanced.frustumCulled = false;
      floatingShardsInstanced.castShadow = true;
      floatingShardsInstanced.receiveShadow = true;
      g5.add(floatingShardsInstanced);

      // Sleek 3D luminous white light bars orbiting amidst the obsidian shards
      floatingWireGroup = new THREE.Group();
      const orbitBarGeo = new THREE.BoxGeometry(0.045, 1.65, 0.045);
      for (let i = 0; i < 16; i++) {
        const bar = new THREE.Mesh(orbitBarGeo, emissiveWhiteMat);
        floatingWireGroup.add(bar);
      }
      g5.add(floatingWireGroup);
    }

    // =========================================================================
    // THEME 6: GEODESIC WIREFRAME ATRIUM (3D Architectural Gyroscopic Gimbal
    // Rings, Faceted Obsidian Core & Nested Geodesic Truss Shells)
    // =========================================================================
    const geodesicRings: THREE.Object3D[] = [];
    {
      const g6 = themeGroups[6];

      // Dark reflective atrium floor
      const floor6 = new THREE.Mesh(new THREE.PlaneGeometry(42, 50), darkMirrorFloorMat);
      floor6.rotation.x = -Math.PI / 2;
      floor6.position.set(0, -3.4, -5);
      floor6.receiveShadow = true;
      g6.add(floor6);

      // Faceted glossy black obsidian polyhedron core (flat-shaded sharp facets!)
      const coreGeo = new THREE.IcosahedronGeometry(1.75, 0);
      coreGeo.computeVertexNormals();
      const coreMesh = new THREE.Mesh(coreGeo, obsidianGlossMat);
      coreMesh.position.set(0, 0.8, -4);
      coreMesh.castShadow = true;
      coreMesh.receiveShadow = true;
      g6.add(coreMesh);
      geodesicRings.push(coreMesh);

      // 3 Solid 3D Architectural Gyroscopic Gimbal Rings with Luminous White Inner Liners
      const gimbalRadii = [2.45, 3.65, 4.95];
      gimbalRadii.forEach((r, idx) => {
        const gimbalGroup = new THREE.Group();
        gimbalGroup.position.set(0, 0.8, -4);

        // Outer solid graphite bevel torus ring
        const outerRing = new THREE.Mesh(
          new THREE.TorusGeometry(r, 0.11, 4, 64),
          graphiteBevelMat
        );
        outerRing.castShadow = true;
        outerRing.receiveShadow = true;
        gimbalGroup.add(outerRing);

        // Inner razor-thin glowing white neon ring
        const innerNeonRing = new THREE.Mesh(
          new THREE.TorusGeometry(r - 0.12, 0.026, 8, 64),
          emissiveWhiteMat
        );
        gimbalGroup.add(innerNeonRing);

        // Nested geodesic wireframe truss & glowing vertex nodes
        const icoGeo = new THREE.IcosahedronGeometry(r + 0.35, idx === 2 ? 2 : 1);
        const edges = new THREE.EdgesGeometry(icoGeo);
        const wireShell = new THREE.LineSegments(edges, wireframeLineMat);
        gimbalGroup.add(wireShell);

        const pts = new THREE.Points(
          icoGeo,
          new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.13,
            transparent: true,
            opacity: 0.95,
          })
        );
        gimbalGroup.add(pts);

        g6.add(gimbalGroup);
        geodesicRings.push(gimbalGroup);
      });
    }

    // =========================================================================
    // THEME 7: KINETIC CARBON MONOLITHS (Full-Viewport Dual-Canopy 3D Obsidian
    // Columns — Floor & Ceiling Monolith Arrays with Luminous White Crown Caps)
    // =========================================================================
    let kineticSlabsInstanced: THREE.InstancedMesh | null = null;
    let kineticCapsInstanced: THREE.InstancedMesh | null = null;
    const slabCols = 16;
    const slabRows = 9;
    {
      const g7 = themeGroups[7];
      // Lower floor array + upper ceiling array (2x instances)
      const totalMonoliths = slabCols * slabRows * 2;

      // Tall 3D obsidian monolith pillar geometry
      const slabGeo = new THREE.BoxGeometry(0.76, 4.6, 0.76);
      kineticSlabsInstanced = new THREE.InstancedMesh(
        slabGeo,
        graphiteBevelMat,
        totalMonoliths
      );
      kineticSlabsInstanced.frustumCulled = false;
      kineticSlabsInstanced.castShadow = true;
      kineticSlabsInstanced.receiveShadow = true;
      g7.add(kineticSlabsInstanced);

      // Razor-thin glowing white crown rim mounted on each monolith tip
      const capGeo = new THREE.BoxGeometry(0.76, 0.045, 0.065);
      kineticCapsInstanced = new THREE.InstancedMesh(
        capGeo,
        emissiveWhiteMat,
        totalMonoliths
      );
      kineticCapsInstanced.frustumCulled = false;
      g7.add(kineticCapsInstanced);

      // Grazing point lights inside the kinetic monolith chamber
      const slabLightLeft = new THREE.PointLight(0xffffff, 20, 24, 1.7);
      slabLightLeft.position.set(-5.0, 0.4, -5.0);
      g7.add(slabLightLeft);

      const slabLightRight = new THREE.PointLight(0xd4d4d8, 18, 24, 1.7);
      slabLightRight.position.set(5.0, 0.4, -9.5);
      g7.add(slabLightRight);

      g7.userData.slabLightLeft = slabLightLeft;
      g7.userData.slabLightRight = slabLightRight;
    }

    // =========================================================================
    // THEME 8: INFINITY PORTAL CORRIDOR (Enclosed Brutalist Diamond Tunnel with
    // Deep-Baffle Shadow Frames & Unobstructed Front-Chamfer Luminous Portals)
    // =========================================================================
    const portalFrames: THREE.Group[] = [];
    const portalNeonMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 0.95,
      roughness: 0.15,
      metalness: 0.0,
    });
    const corridorBaffleMat = new THREE.MeshStandardMaterial({
      color: 0x0b0b0f,
      roughness: 0.65,
      metalness: 0.35,
    });
    {
      const g8 = themeGroups[8];

      // Centerline axial point lights inside the tunnel for smooth depth gradient
      const tunnelLight1 = new THREE.PointLight(0xffffff, 11, 22, 1.8);
      tunnelLight1.position.set(0, 0.4, -4);
      g8.add(tunnelLight1);

      const tunnelLight2 = new THREE.PointLight(0xd4d4d8, 10, 24, 1.8);
      tunnelLight2.position.set(0, 0.4, -16);
      g8.add(tunnelLight2);

      const portalCount = 18;
      const innerSize = 5.4;
      const bezelThick = 1.65;
      const bezelDepth = 1.85;

      // Flush-mitred deep baffle geometry so outside overhead lights never leak
      // blotches between frames, creating a true enclosed architectural tunnel
      const bezelHorizGeo = new THREE.BoxGeometry(
        innerSize + bezelThick * 2,
        bezelThick,
        bezelDepth
      );
      const bezelVertGeo = new THREE.BoxGeometry(
        bezelThick,
        innerSize,
        bezelDepth
      );

      // Unobstructed 4-sided front-inner chamfer light bars
      const lightBarThick = 0.055;
      const lightHorizGeo = new THREE.BoxGeometry(
        innerSize - lightBarThick,
        lightBarThick,
        0.06
      );
      const lightVertGeo = new THREE.BoxGeometry(
        lightBarThick,
        innerSize + lightBarThick,
        0.06
      );

      for (let i = 0; i < portalCount; i++) {
        const pGroup = new THREE.Group();
        const halfOffset = innerSize / 2 + bezelThick / 2;
        const frameMat = i % 2 === 0 ? corridorBaffleMat : architecturalConcreteMat;

        const topB = new THREE.Mesh(bezelHorizGeo, frameMat);
        topB.position.y = halfOffset;
        topB.receiveShadow = true;

        const botB = new THREE.Mesh(bezelHorizGeo, frameMat);
        botB.position.y = -halfOffset;
        botB.receiveShadow = true;

        const leftB = new THREE.Mesh(bezelVertGeo, frameMat);
        leftB.position.x = -halfOffset;
        leftB.receiveShadow = true;

        const rightB = new THREE.Mesh(bezelVertGeo, frameMat);
        rightB.position.x = halfOffset;
        rightB.receiveShadow = true;

        pGroup.add(topB, botB, leftB, rightB);

        // Place glowing white neon liners on every 3rd portal along the front-inner
        // chamfer so all 4 edges form a crisp, unbroken luminous square/diamond
        if (i % 3 === 0) {
          const innerLightOffset = innerSize / 2 - lightBarThick / 2;
          const frontZ = bezelDepth / 2 + 0.015;
          const topL = new THREE.Mesh(lightHorizGeo, portalNeonMat);
          topL.position.set(0, innerLightOffset, frontZ);
          const botL = new THREE.Mesh(lightHorizGeo, portalNeonMat);
          botL.position.set(0, -innerLightOffset, frontZ);
          const leftL = new THREE.Mesh(lightVertGeo, portalNeonMat);
          leftL.position.set(-innerLightOffset, 0, frontZ);
          const rightL = new THREE.Mesh(lightVertGeo, portalNeonMat);
          rightL.position.set(innerLightOffset, 0, frontZ);
          pGroup.add(topL, botL, leftL, rightL);
        }

        pGroup.position.set(0, 0.4, -i * 2.2);
        g8.add(pGroup);
        portalFrames.push(pGroup);
      }
    }

    // Pre-warm shaders on hardware GPUs
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      camera.fov = w < h ? 68 : 46;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      composer.setSize(w, h);
      bloomPass.resolution.set(
        isSoftwareGl ? Math.floor(w / 2) : w,
        isSoftwareGl ? Math.floor(h / 2) : h
      );
    };
    window.addEventListener('resize', handleResize);

    // =========================================================================
    // SOFTWARE-WEBGL SAFE PACING (`afterDraw`) + CONTINUOUS RENDER LOOP
    // =========================================================================
    let frameId = 0;
    let isCancelled = false;

    function afterDraw(cb: () => void) {
      if (isCancelled) return;
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (gl && typeof gl.fenceSync === 'function') {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (isCancelled) return;
          const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (state === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      } else {
        frameId = window.setTimeout(cb, 80);
      }
    }

    function tick() {
      if (isCancelled) return;
      const now = performance.now();
      const rt = runtimeRef.current;
      const p = propsRef.current;

      const dtMs = Math.min(100, Math.max(0, now - rt.lastFrameTime));
      const dtSec = dtMs / 1000;
      rt.lastFrameTime = now;

      // 1. BPM & Beat Phase Calculation
      const effectiveBpm = computeEffectiveBpm(
        p.baseBpm,
        p.pitchBend,
        p.pitchBendRangePercent
      );
      const step = stepBeatPhase(rt.beatPhase, rt.beatCount, dtMs, effectiveBpm);
      rt.beatPhase = step.phase;
      rt.beatCount = step.beatCount;

      const beatPulse = computeBeatPulse(rt.beatPhase, p.autoBpm);
      const motionSpeed = p.autoBpm ? (effectiveBpm / 120) * (0.45 + beatPulse * 0.55) : 0.35;
      rt.elapsedSec += dtSec * motionSpeed;
      // Ultra-slow cinematic drift within the active scene
      rt.cameraOrbitTime += dtSec * 0.16;

      // 2. QWERTY White Fade & Spacebar Strobe Lighting Intensity
      if (rt.pendingFade) {
        rt.pendingFade = false;
        rt.fadeStartPerf = now;
      }
      const fadeElapsed = now - rt.fadeStartPerf;
      const fadeIntensity = computeFadeIntensity(fadeElapsed, rt.fadeDurationMs);

      if (p.strobeHeld && !rt.wasStrobeHeld) {
        rt.strobeStartPerf = now;
      }
      rt.wasStrobeHeld = p.strobeHeld;

      const strobeElapsed = p.strobeHeld ? now - rt.strobeStartPerf : 0;
      const strobeIntensity = computeStrobeIntensity(
        p.strobeHeld,
        strobeElapsed,
        p.strobeRateHz
      );

      const totalLight = Math.min(1, Math.max(fadeIntensity, strobeIntensity));
      const isOverdrive = p.lightingMode === 'overdrive';

      // Throttle telemetry updates to ~10Hz
      if (p.onBeatTelemetry && (step.beatTriggered || now - rt.lastTelemetrySent > 100)) {
        rt.lastTelemetrySent = now;
        p.onBeatTelemetry(rt.beatCount % 4, rt.beatPhase, totalLight);
      }

      // 3. Toggle Active Theme Visibility
      for (let i = 0; i <= 8; i++) {
        themeGroups[i].visible = p.activeTheme === i;
      }

      // =======================================================================
      // THEME 9: FULL WHITEOUT
      // =======================================================================
      if (p.activeTheme === 9) {
        scene.background = _bgColor.setHex(0xffffff);
        if (scene.fog instanceof THREE.FogExp2) {
          scene.fog.color.setHex(0xffffff);
        }
        renderer.render(scene, camera);
        if (isSoftwareGl) afterDraw(tick);
        else frameId = requestAnimationFrame(tick);
        return;
      }

      // =======================================================================
      // THEME 0: IDLE PITCH-BLACK SHORT-CIRCUIT (100% Pure #000000 when no flash)
      // =======================================================================
      if (p.activeTheme === 0 && totalLight <= 0.002) {
        themeGroups[0].visible = false;
        scene.background = _bgColor.setHex(0x000000);
        if (scene.fog instanceof THREE.FogExp2) {
          scene.fog.color.setHex(0x000000);
        }
        renderer.render(scene, camera);
        if (isSoftwareGl) afterDraw(tick);
        else frameId = requestAnimationFrame(tick);
        return;
      }

      // =======================================================================
      // 3D LIGHTING, SHADOW & BLOOM RESPONSE (Stage Bloom vs Geometry Overdrive)
      // Keep the background void deep obsidian (no muddy gray washout!)
      // =======================================================================
      const subtleVoidLift =
        p.activeTheme === 0
          ? 0
          : isOverdrive
          ? totalLight * 0.006
          : totalLight * 0.014;

      if (p.activeTheme === 0) {
        _bgColor.setHex(0x000000);
      } else {
        _bgColor.setRGB(
          0.004 + subtleVoidLift,
          0.004 + subtleVoidLift,
          0.007 + subtleVoidLift
        );
      }
      scene.background = _bgColor;
      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.color.copy(_bgColor);
        scene.fog.density =
          p.activeTheme === 0
            ? 0.042
            : Math.max(0.024, 0.045 - totalLight * 0.014);
      }

      // Keep bloomPass.threshold high (0.86) so dark concrete & obsidian surfaces
      // NEVER bloom into blurry white fog; only pure white emissives & sharp glints bloom!
      const flashCurve = Math.pow(totalLight, 1.25);
      const lightMultiplier =
        1 + beatPulse * 0.25 + flashCurve * (isOverdrive ? 2.8 : 1.9);
      emissiveWhiteMat.emissiveIntensity = 1.45 * lightMultiplier;
      archNeonMat.emissiveIntensity =
        0.95 + beatPulse * 0.22 + flashCurve * (isOverdrive ? 2.4 : 1.6);

      bloomPass.threshold = 0.86;
      bloomPass.strength =
        p.activeTheme === 0
          ? flashCurve * (isOverdrive ? 0.72 : 0.46)
          : 0.38 + beatPulse * 0.1 + flashCurve * (isOverdrive ? 0.95 : 0.65);
      bloomPass.radius = 0.32 + flashCurve * 0.16;

      if (p.activeTheme === 0) {
        // In Blackout mode, only flash-driven 3D stage lights illuminate the dark rig
        ambientLight.intensity = flashCurve * 0.012;
        centerStageLight.intensity = flashCurve * 8.5;
        frontWashLight.intensity = flashCurve * (isOverdrive ? 5.0 : 10.0);
        keyLight.intensity = flashCurve * 1.65;
        mainStageSpot.intensity = flashCurve * 18.0;
      } else {
        ambientLight.intensity = 0.015 + flashCurve * 0.012;
        centerStageLight.intensity = 0.25 + beatPulse * 0.65 + flashCurve * 16.0;
        frontWashLight.intensity = flashCurve * (isOverdrive ? 7.5 : 18.0);
        keyLight.intensity = p.activeTheme === 8 ? 0.15 : 1.45 + flashCurve * 3.5;
        mainStageSpot.intensity =
          p.activeTheme === 8
            ? 0
            : 16.0 + beatPulse * 5.0 + flashCurve * 40.0;
      }

      const wireBrightness = Math.min(
        1,
        0.65 + beatPulse * 0.2 + flashCurve * (isOverdrive ? 0.35 : 0.28)
      );
      wireframeLineMat.opacity = wireBrightness;
      wireframeLineMat.color.setScalar(0.84 + flashCurve * 0.16);
      roomCageLineMat.opacity = 0.36 + flashCurve * 0.38;

      // =======================================================================
      // ULTRA-SLOW CINEMATIC 3D CAMERA DRIFT (Per Theme, Zero Scene-Switch Tween)
      // =======================================================================
      const camT = rt.cameraOrbitTime;
      const t = rt.elapsedSec;

      if (p.activeTheme === 0) {
        // Stealth 3D Concert Blinder & Anamorphic Horizon Rig (visible only during Q~P / Space)
        _targetCamPos.set(
          Math.sin(camT * 0.65) * 0.75,
          0.35 + Math.cos(camT * 0.45) * 0.2,
          8.6
        );
        _targetLookAt.set(0, 0.55, -12);

        blackoutNeonMat.color.setScalar(flashCurve);
        blackoutNeonMat.emissiveIntensity =
          0.88 + flashCurve * (isOverdrive ? 1.85 : 1.25);

        if (blackoutSpotLight) {
          blackoutSpotLight.intensity = flashCurve * 22.0;
        }
        if (blackoutHorizonLight) {
          blackoutHorizonLight.intensity = flashCurve * 14.0;
        }
        if (blackoutApertureGroup) {
          const apertureScale = 0.94 + flashCurve * 0.12;
          blackoutApertureGroup.scale.set(apertureScale, apertureScale, 1);
          blackoutApertureGroup.children.forEach((child, idx) => {
            if (idx > 0) {
              const dir = idx % 2 === 0 ? 1 : -1;
              child.rotation.z =
                (idx % 2 === 0 ? Math.PI / 4 : 0) +
                t * 0.18 * dir +
                (1 - totalLight) * 0.12 * dir;
            }
          });
        }
      } else if (p.activeTheme === 1) {
        // Slow majestic glide through the Obsidian Cathedral Hall
        _targetCamPos.set(
          Math.sin(camT * 0.75) * 1.25,
          0.35 + Math.cos(camT * 0.5) * 0.3,
          8.8 - Math.sin(camT * 0.4) * 1.6
        );
        _targetLookAt.set(Math.sin(camT * 0.4) * 0.3, 0.5, -12);

        const yShift = Math.sin(t * 0.9) * 0.1 + beatPulse * 0.08;
        const shardInst = themeGroups[1].userData.shardInstanced as THREE.InstancedMesh;
        if (shardInst) shardInst.position.y = yShift;
      } else if (p.activeTheme === 2) {
        // Slow aerial drift inside the Wireframe Topography Room
        _targetCamPos.set(
          Math.sin(camT * 0.65) * 2.1,
          1.35 + Math.cos(camT * 0.45) * 0.5,
          10.2 + Math.sin(camT * 0.35) * 1.4
        );
        _targetLookAt.set(0, -0.2, -10);

        if (terrainPosAttr && terrainDotsAttr && terrainWireGeo) {
          const count = terrainPosAttr.count;
          const waveAmp = 1 + beatPulse * 0.42 + (isOverdrive ? totalLight * 0.65 : 0);
          for (let i = 0; i < count; i++) {
            const vx = terrainPosAttr.getX(i);
            const vz = terrainPosAttr.getZ(i);
            const edgeLift = Math.pow(Math.abs(vx) / 10.8, 1.6) * 1.8;
            const ridge1 = Math.sin(vx * 0.38 + t * 0.85) * Math.cos(vz * 0.28 + t * 0.6);
            const ridge2 = Math.sin(vx * 0.75 - vz * 0.45 + t * 1.1) * 0.45;
            const vy = (ridge1 * 1.35 + ridge2 + edgeLift) * waveAmp;

            terrainPosAttr.setY(i, vy);
            terrainDotsAttr.setXYZ(i, vx, vy + 0.02, vz);
          }
          terrainPosAttr.needsUpdate = true;
          terrainDotsAttr.needsUpdate = true;
        }
      } else if (p.activeTheme === 3) {
        // Subtle panning angle across the 3D Beveled Dark Square Matrix Wall (Ref 1)
        _targetCamPos.set(
          Math.sin(camT * 0.7) * 1.8,
          Math.cos(camT * 0.5) * 0.75,
          8.6 + Math.sin(camT * 0.4) * 0.8
        );
        _targetLookAt.set(Math.sin(camT * 0.35) * 0.5, -0.2, 0);

        if (tileWallInstanced) {
          const spacing = 0.61;
          let idx = 0;
          for (let r = 0; r < tileRows; r++) {
            for (let c = 0; c < tileCols; c++) {
              const x = (c - (tileCols - 1) / 2) * spacing;
              const y = (r - (tileRows - 1) / 2) * spacing;
              const distFromSpot = Math.hypot(x, y + 2.4);
              const ripple =
                Math.sin(distFromSpot * 0.85 - t * 1.8) *
                (0.14 + beatPulse * 0.18 + totalLight * 0.32);
              _dummy.position.set(x, y, ripple);
              _dummy.rotation.set(
                Math.sin(x * 0.3 + t) * 0.05 * (1 + totalLight),
                Math.cos(y * 0.3 + t) * 0.05 * (1 + totalLight),
                0
              );
              _dummy.scale.set(1, 1, 1);
              _dummy.updateMatrix();
              tileWallInstanced.setMatrixAt(idx++, _dummy.matrix);
            }
          }
          tileWallInstanced.instanceMatrix.needsUpdate = true;
        }
        const matrixSpot = themeGroups[3].userData.matrixSpot as THREE.PointLight;
        if (matrixSpot) {
          matrixSpot.intensity = 20.0 + beatPulse * 8.0 + totalLight * 38.0;
          matrixSpot.position.x = Math.sin(camT * 0.9) * 1.6;
        }
      } else if (p.activeTheme === 4) {
        // Brutalist Light Colonnade slow camera dolly
        _targetCamPos.set(
          Math.sin(camT * 0.6) * 1.3,
          0.6 + Math.cos(camT * 0.45) * 0.4,
          9.0 - ((camT * 1.2) % 4.4)
        );
        _targetLookAt.set(0, 1.2, -18);
      } else if (p.activeTheme === 5) {
        // 3D Crystalline Obsidian Obelisk Vortex & Luminous Altar orbital camera
        _targetCamPos.set(
          Math.sin(camT * 0.65) * 2.6,
          0.65 + Math.cos(camT * 0.5) * 0.7,
          9.2
        );
        _targetLookAt.set(0, 0.3, -5.0);

        if (floatingShardsInstanced) {
          for (let i = 0; i < shardFieldCount; i++) {
            const ringIdx = i % 4;
            const angle = i * 0.48 + t * (0.24 - ringIdx * 0.03);
            const radius = 2.4 + ringIdx * 1.35 + Math.sin(i * 1.9 + t * 0.5) * 0.35;
            const x = Math.cos(angle) * radius;
            const z = -5.0 + Math.sin(angle) * radius * 0.85;
            const y =
              0.5 +
              Math.sin(i * 1.3 + t * 0.65) * 2.1 +
              (ringIdx - 1.5) * 0.45;

            _dummy.position.set(x, y, z);
            _dummy.rotation.set(
              Math.sin(t * 0.4 + i) * 0.32,
              -angle + Math.PI / 2,
              Math.cos(t * 0.35 + i) * 0.24
            );
            const s =
              (0.45 + (i % 3) * 0.22) *
              (1 + beatPulse * 0.16 + totalLight * 0.24);
            _dummy.scale.set(s * 0.65, s * 1.35, s * 0.65);
            _dummy.updateMatrix();
            floatingShardsInstanced.setMatrixAt(i, _dummy.matrix);
          }
          floatingShardsInstanced.instanceMatrix.needsUpdate = true;
        }
        if (floatingWireGroup) {
          floatingWireGroup.children.forEach((child, i) => {
            const angle = -i * ((Math.PI * 2) / 16) + t * 0.22;
            const radius = 3.1 + (i % 2) * 1.85;
            child.position.set(
              Math.cos(angle) * radius,
              0.45 + Math.sin(i * 1.5 + t * 0.7) * 1.65,
              -5.0 + Math.sin(angle) * radius * 0.85
            );
            child.rotation.set(
              Math.sin(t * 0.3 + i) * 0.18,
              -angle,
              Math.cos(t * 0.3 + i) * 0.18
            );
            const ws = 0.85 + beatPulse * 0.22 + totalLight * 0.35;
            child.scale.set(1, ws, 1);
          });
        }
      } else if (p.activeTheme === 6) {
        // 3D Architectural Gyroscopic Gimbal Atrium slow orbit
        _targetCamPos.set(
          Math.sin(camT * 0.7) * 3.1,
          0.95 + Math.cos(camT * 0.55) * 1.0,
          8.8 + Math.cos(camT * 0.4) * 0.9
        );
        _targetLookAt.set(0, 0.75, -4);

        geodesicRings.forEach((obj, idx) => {
          const dir = idx % 2 === 0 ? 1 : -1;
          if (idx === 0) {
            obj.rotation.x = t * 0.18;
            obj.rotation.y = -t * 0.28;
          } else {
            obj.rotation.x = t * (0.2 + idx * 0.04) * dir + idx * 0.55;
            obj.rotation.y = t * (0.26 - idx * 0.03) * dir;
            obj.rotation.z = Math.sin(t * 0.2 + idx) * 0.35;
          }
          const pulseScale = 1 + beatPulse * (0.015 + idx * 0.006) + totalLight * 0.05;
          obj.scale.setScalar(pulseScale);
        });
      } else if (p.activeTheme === 7) {
        // Full-Viewport Dual-Canopy Kinetic Carbon Monoliths (Floor + Ceiling Waves)
        _targetCamPos.set(
          Math.sin(camT * 0.6) * 2.2,
          0.35 + Math.cos(camT * 0.45) * 0.35,
          8.6
        );
        _targetLookAt.set(0, 0.25, -7.5);

        if (kineticSlabsInstanced && kineticCapsInstanced) {
          let idx = 0;
          for (let r = 0; r < slabRows; r++) {
            for (let c = 0; c < slabCols; c++) {
              const x = (c - (slabCols - 1) / 2) * 1.05;
              const z = -1.2 - r * 1.55;
              const canyonSpread = Math.pow(Math.abs(x) / 7.8, 1.4) * 0.85;
              const wave =
                Math.sin(c * 0.48 + t * 1.5) *
                Math.cos(r * 0.42 - t * 1.15) *
                (0.68 + beatPulse * 0.48 + totalLight * 0.72);

              // 1. Lower Floor Monolith
              const lowerY = -3.55 + canyonSpread + wave;
              _dummy.position.set(x, lowerY, z);
              _dummy.rotation.set(
                wave * 0.06,
                0,
                Math.cos(c * 0.35 + t) * 0.05
              );
              _dummy.scale.set(1, 1, 1);
              _dummy.updateMatrix();
              kineticSlabsInstanced.setMatrixAt(idx, _dummy.matrix);

              _dummy.position.set(x, lowerY + 2.31, z + 0.36);
              _dummy.updateMatrix();
              kineticCapsInstanced.setMatrixAt(idx, _dummy.matrix);
              idx++;

              // 2. Upper Inverted Ceiling Monolith
              const upperWave =
                Math.cos(c * 0.48 - t * 1.4) *
                Math.sin(r * 0.42 + t * 1.1) *
                (0.62 + beatPulse * 0.45 + totalLight * 0.68);
              const upperY = 4.15 - canyonSpread + upperWave;
              _dummy.position.set(x, upperY, z);
              _dummy.rotation.set(
                -upperWave * 0.06,
                0,
                -Math.sin(c * 0.35 + t) * 0.05
              );
              _dummy.scale.set(1, 1, 1);
              _dummy.updateMatrix();
              kineticSlabsInstanced.setMatrixAt(idx, _dummy.matrix);

              _dummy.position.set(x, upperY - 2.31, z + 0.36);
              _dummy.updateMatrix();
              kineticCapsInstanced.setMatrixAt(idx, _dummy.matrix);
              idx++;
            }
          }
          kineticSlabsInstanced.instanceMatrix.needsUpdate = true;
          kineticCapsInstanced.instanceMatrix.needsUpdate = true;
        }
      } else if (p.activeTheme === 8) {
        // Infinity Portal Corridor slow glide & twist
        _targetCamPos.set(
          Math.sin(camT * 0.65) * 0.55,
          0.4 + Math.cos(camT * 0.5) * 0.28,
          6.0
        );
        _targetLookAt.set(0, 0.4, -24);

        portalNeonMat.emissiveIntensity =
          0.95 + beatPulse * 0.25 + totalLight * (isOverdrive ? 2.6 : 1.75);

        const portalCount = portalFrames.length;
        const spacing = 2.2;
        const totalDepth = portalCount * spacing;

        portalFrames.forEach((pg, idx) => {
          const zTravel = ((t * 1.65 + idx * spacing) % totalDepth) - (totalDepth - 3.2);
          pg.position.z = zTravel;
          // Continuous helical twist based on Z depth so adjacent frames form a smooth vortex
          const depthFactor = Math.abs(zTravel - 3.5) * 0.042;
          pg.rotation.z =
            Math.PI / 4 +
            depthFactor +
            Math.sin(t * 0.28 + idx * 0.18) * 0.09;
          const s = 1 + beatPulse * 0.04 + totalLight * 0.08;
          pg.scale.set(s, s, 1);
        });
      }

      // Apply active scene camera position & lookAt directly so switching scenes
      // has zero cross-scene camera transition movement
      camera.position.copy(_targetCamPos);
      camera.lookAt(_targetLookAt);

      // Render with real optical UnrealBloomPass post-processing
      composer.render();

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    frameId = requestAnimationFrame(tick);

    return () => {
      isCancelled = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', handleResize);
      envTexture.dispose();
      composer.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div className="fixed inset-0 w-full h-full pointer-events-none z-0 overflow-hidden bg-[#000000]">
      <div ref={mountRef} className="w-full h-full" />
      {/* Zero-re-render Optical Anamorphic Stage Blinder Flare Layer */}
      <div
        ref={blinderOverlayRef}
        className="absolute inset-0 pointer-events-none mix-blend-screen opacity-0 bg-[radial-gradient(ellipse_72%_48%_at_50%_46%,rgba(255,255,255,0.72)_0%,rgba(255,255,255,0.22)_42%,rgba(255,255,255,0)_78%),linear-gradient(180deg,rgba(255,255,255,0)_47.5%,rgba(255,255,255,0.52)_50%,rgba(255,255,255,0)_52.5%)]"
      />
    </div>
  );
};

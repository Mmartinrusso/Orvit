'use client';

import { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';

interface OrvitLogoMotionProps {
  size?: number;
  speed?: number;
  stageHold?: number;
  className?: string;
  theme?: 'dark' | 'light';
}

// Smooth interpolation
function smootherstep(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number): number {
  return a + t * (b - a);
}

// Value noise with smooth interpolation for organic shapes
function smoothNoise3D(x: number, y: number, z: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);

  const xf = x - xi;
  const yf = y - yi;
  const zf = z - zi;

  // Smooth interpolation
  const u = smootherstep(xf);
  const v = smootherstep(yf);
  const w = smootherstep(zf);

  // Hash function for random values at integer coordinates
  const hash = (i: number, j: number, k: number) => {
    const n = Math.sin(i * 127.1 + j * 311.7 + k * 74.7) * 43758.5453;
    return (n - Math.floor(n)) * 2 - 1;
  };

  // Trilinear interpolation
  const c000 = hash(xi, yi, zi);
  const c100 = hash(xi + 1, yi, zi);
  const c010 = hash(xi, yi + 1, zi);
  const c110 = hash(xi + 1, yi + 1, zi);
  const c001 = hash(xi, yi, zi + 1);
  const c101 = hash(xi + 1, yi, zi + 1);
  const c011 = hash(xi, yi + 1, zi + 1);
  const c111 = hash(xi + 1, yi + 1, zi + 1);

  const x00 = lerp(c000, c100, u);
  const x10 = lerp(c010, c110, u);
  const x01 = lerp(c001, c101, u);
  const x11 = lerp(c011, c111, u);

  const y0 = lerp(x00, x10, v);
  const y1 = lerp(x01, x11, v);

  return lerp(y0, y1, w);
}

// Fractal noise with smooth base
function organicNoise(x: number, y: number, z: number, octaves: number = 4): number {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    value += amplitude * smoothNoise3D(x * frequency, y * frequency, z * frequency);
    maxValue += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }

  return value / maxValue;
}

// Smoothstep easing
function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

// Cubic in-out easing
function cubicInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export default function OrvitLogoMotion({
  size = 320,
  speed = 0.35,
  stageHold = 0.8,
  className = '',
  theme = 'light'
}: OrvitLogoMotionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const geometryRef = useRef<THREE.BufferGeometry | null>(null);
  const animationRef = useRef<number>(0);
  const timeRef = useRef(0);
  const isVisibleRef = useRef(true);

  // Mouse interaction for rotation
  const mouseRef = useRef({ x: 0, y: 0, isDragging: false, prevX: 0, prevY: 0 });
  const rotationRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

  // Camera position for smooth transitions
  const cameraPositionRef = useRef({ x: 0, y: 0, z: 4, targetX: 0, targetY: 0, targetZ: 4 });

  // Orbital particles
  const orbitParticlesRef = useRef<THREE.Points | null>(null);
  const orbitGeometryRef = useRef<THREE.BufferGeometry | null>(null);

  // Store position arrays for morphing
  const positionsRef = useRef<{
    sphere: Float32Array;
    brain: Float32Array;
    spiky: Float32Array;
    current: Float32Array;
    baseNormals: Float32Array; // Store normals for Siri animation
  } | null>(null);

  const initThree = useCallback(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const dpr = Math.min(window.devicePixelRatio, 2);

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera - starts with front view, will animate to top view for vortex
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    camera.position.set(0, 0, 4); // Start with front view
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(size, size);
    renderer.setPixelRatio(dpr);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    rendererRef.current = renderer;

    container.appendChild(renderer.domElement);

    // Geometry - high detail sphere
    const segments = 128;
    const geometry = new THREE.SphereGeometry(1, segments, segments);
    geometryRef.current = geometry;

    // Get base positions
    const basePositions = geometry.attributes.position.array as Float32Array;
    const vertexCount = basePositions.length;

    // Create position arrays for each morph state
    const spherePositions = new Float32Array(basePositions);
    const brainPositions = new Float32Array(vertexCount);
    const spikyPositions = new Float32Array(vertexCount);
    const currentPositions = new Float32Array(basePositions);
    const baseNormals = new Float32Array(vertexCount); // For Siri animation

    // Calculate and store base normals
    for (let i = 0; i < vertexCount; i += 3) {
      const x = basePositions[i];
      const y = basePositions[i + 1];
      const z = basePositions[i + 2];
      const length = Math.sqrt(x * x + y * y + z * z);
      baseNormals[i] = x / length;
      baseNormals[i + 1] = y / length;
      baseNormals[i + 2] = z / length;
    }

    // Generate brain - using layered noise for organic coral-like folds
    for (let i = 0; i < vertexCount; i += 3) {
      const x = basePositions[i];
      const y = basePositions[i + 1];
      const z = basePositions[i + 2];

      const length = Math.sqrt(x * x + y * y + z * z);
      const nx = x / length;
      const ny = y / length;
      const nz = z / length;

      // 1. VERY DEEP central fissure - THE KEY feature of a brain
      // This splits it into two hemispheres
      const centralFissure = Math.exp(-Math.pow(nx * 20, 2)) * 0.25;

      // 2. Use ORGANIC NOISE for irregular, coral-like bumps
      // Multiple layers at different scales create realistic folds
      const bumps1 = organicNoise(nx * 4, ny * 4, nz * 4, 4) * 0.12; // Large bumps
      const bumps2 = organicNoise(nx * 8, ny * 8, nz * 8, 3) * 0.08; // Medium bumps
      const bumps3 = organicNoise(nx * 12, ny * 12, nz * 12, 2) * 0.04; // Small detail

      // 3. Make the bumps more "brain-like" by sharpening negative values (grooves)
      let totalBumps = bumps1 + bumps2 + bumps3;
      if (totalBumps < 0) {
        totalBumps *= 1.5; // Grooves are deeper than bumps are tall
      }

      // 4. Brain shape - slightly wider than tall
      const brainShape = 1.0 + Math.abs(nx) * 0.05;

      // 5. Slight flattening at top and bottom
      const verticalShape = 1.0 - Math.abs(ny) * Math.abs(ny) * 0.08;

      // Combine
      let displacement = brainShape * verticalShape;
      displacement -= centralFissure;
      displacement += totalBumps;

      brainPositions[i] = nx * displacement;
      brainPositions[i + 1] = ny * displacement;
      brainPositions[i + 2] = nz * displacement;
    }

    // Generate Vortex Funnel - torus with visible depth
    for (let i = 0; i < vertexCount; i += 3) {
      const x = basePositions[i];
      const y = basePositions[i + 1];
      const z = basePositions[i + 2];

      const length = Math.sqrt(x * x + y * y + z * z);
      const nx = x / length;
      const ny = y / length;
      const nz = z / length;

      // Spherical coordinates
      const theta = Math.atan2(nz, nx);
      const phi = Math.acos(ny);

      // Torus with funnel depth
      const R = 0.75;  // Major radius
      const r = 0.28;  // Tube radius

      // Map phi to tube angle
      const tubeAngle = phi * 2 - Math.PI;

      // Torus coordinates
      const torusX = (R + r * Math.cos(tubeAngle)) * Math.cos(theta);
      const torusY = r * Math.sin(tubeAngle);
      const torusZ = (R + r * Math.cos(tubeAngle)) * Math.sin(theta);

      // Orbital textures - concentric rings spiraling inward
      const orbitRings = 10;
      const spiralTwist = 4;

      // Create spiral grooves
      const spiralAngle = theta * spiralTwist + tubeAngle * 2;
      const ringPattern = Math.sin(spiralAngle * orbitRings) * 0.025;

      // Radial rays/gleams toward center - sharp spikes
      const numRays = 8;
      const rayAngle = theta * numRays;
      const raySharpness = Math.pow(Math.abs(Math.cos(rayAngle)), 8); // Sharp peaks
      const rayStrength = raySharpness * 0.06 * (1 - Math.abs(Math.cos(tubeAngle))); // Stronger near edges

      // Combine orbital displacement with rays
      const orbitDisp = ringPattern + rayStrength;

      // Blocky texture
      const blockSize = 0.055;
      const blockX = Math.floor(torusX / blockSize) * blockSize + blockSize * 0.5;
      const blockY = Math.floor(torusY / blockSize) * blockSize + blockSize * 0.5;
      const blockZ = Math.floor(torusZ / blockSize) * blockSize + blockSize * 0.5;

      // Fade block effect near center hole to keep it circular
      const distFromCenter = Math.sqrt(torusX * torusX + torusZ * torusZ);
      const blockFade = Math.min(1, Math.max(0, (distFromCenter - R * 0.6) / (R * 0.5)));

      // Block blend - fades near center
      const blockBlend = 0.45 * blockFade;

      // Scale
      const scale = 1.3;

      // Apply orbital texture displacement along the normal direction
      const normalX = Math.cos(theta);
      const normalZ = Math.sin(theta);

      // Apply blend with orbital texture
      const baseX = torusX + orbitDisp * normalX;
      const baseY = torusY + orbitDisp * 0.5;
      const baseZ = torusZ + orbitDisp * normalZ;

      const finalX = (baseX * (1 - blockBlend) + blockX * blockBlend) * scale;
      const finalY = (baseY * (1 - blockBlend) + blockY * blockBlend) * scale;
      const finalZ = (baseZ * (1 - blockBlend) + blockZ * blockBlend) * scale;

      spikyPositions[i] = finalX;
      spikyPositions[i + 1] = finalY;
      spikyPositions[i + 2] = finalZ;
    }

    positionsRef.current = {
      sphere: spherePositions,
      brain: brainPositions,
      spiky: spikyPositions,
      current: currentPositions,
      baseNormals: baseNormals
    };

    // Material - premium glossy appearance
    const material = new THREE.MeshStandardMaterial({
      color: theme === 'light' ? 0x151515 : 0xf5f5f5,
      roughness: 0.25,
      metalness: 0.1,
      envMapIntensity: 0.8
    });

    // Mesh
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
    meshRef.current = mesh;

    // Lighting - optimized for showing brain folds and details
    // Key light (main) - from top-left front for good shadow definition
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
    keyLight.position.set(-3, 4, 5);
    scene.add(keyLight);

    // Fill light (softer, opposite side) - reduces harsh shadows
    const fillLight = new THREE.DirectionalLight(0xffffff, 1.0);
    fillLight.position.set(3, 0, 3);
    scene.add(fillLight);

    // Rim light (back) - creates edge definition
    const rimLight = new THREE.DirectionalLight(0xffffff, 1.5);
    rimLight.position.set(0, 2, -5);
    scene.add(rimLight);

    // Bottom fill - prevents bottom from being too dark
    const bottomLight = new THREE.DirectionalLight(0xffffff, 0.5);
    bottomLight.position.set(0, -3, 2);
    scene.add(bottomLight);

    // Ambient - subtle fill for overall illumination
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
    scene.add(ambientLight);

    // Environment map for reflections
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(theme === 'light' ? 0xf5f5f5 : 0x0a0a0a);
    const envMap = pmremGenerator.fromScene(envScene).texture;
    scene.environment = envMap;
    pmremGenerator.dispose();

    // Create simple orbital particle system - fewer particles
    const orbitParticleCount = 30;
    const orbitGeometry = new THREE.BufferGeometry();
    const orbitPositions = new Float32Array(orbitParticleCount * 3);
    const orbitSizes = new Float32Array(orbitParticleCount);

    // Initialize positions and varied sizes
    for (let i = 0; i < orbitParticleCount; i++) {
      orbitPositions[i * 3] = 0;
      orbitPositions[i * 3 + 1] = 0;
      orbitPositions[i * 3 + 2] = 0;
      // Varied sizes for depth effect
      orbitSizes[i] = 0.02 + Math.random() * 0.03;
    }

    orbitGeometry.setAttribute('position', new THREE.BufferAttribute(orbitPositions, 3));
    orbitGeometryRef.current = orbitGeometry;

    const orbitMaterial = new THREE.PointsMaterial({
      color: theme === 'light' ? 0x333333 : 0xcccccc,
      size: 0.04,
      transparent: true,
      opacity: 0,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending
    });

    const orbitParticles = new THREE.Points(orbitGeometry, orbitMaterial);
    scene.add(orbitParticles);
    orbitParticlesRef.current = orbitParticles;

  }, [size, theme]);

  const animate = useCallback(() => {
    if (!isVisibleRef.current) {
      animationRef.current = requestAnimationFrame(animate);
      return;
    }

    if (!rendererRef.current || !sceneRef.current || !cameraRef.current || !meshRef.current || !positionsRef.current || !geometryRef.current) {
      animationRef.current = requestAnimationFrame(animate);
      return;
    }

    timeRef.current += 0.016 * speed;
    const time = timeRef.current;

    // Animation timeline - slower transitions
    // Total cycle: sphere(hold) -> brain(morph+hold) -> spiky(morph+hold) -> brain(morph+hold) -> sphere(morph)
    const morphDuration = 2.0; // Slower morphs
    const holdDuration = stageHold * 2.5; // Each shape stays longer
    const brainHoldDuration = stageHold * 5; // Brain stays even longer
    const cycleDuration = holdDuration * 2 + brainHoldDuration * 2 + morphDuration * 4;
    const cycleTime = time % cycleDuration;

    let morphProgress: number;
    let fromPositions: Float32Array;
    let toPositions: Float32Array;

    const { sphere, brain, spiky, current, baseNormals } = positionsRef.current;

    // Update Vortex Funnel - spinning torus with depth
    const updateAura = () => {
      const t = time * 0.4;
      const R = 0.75;
      const r = 0.28;
      const blockSize = 0.06;
      const blockBlend = 0.5;
      const scale = 1.3;

      for (let i = 0; i < spiky.length; i += 3) {
        const nx = baseNormals[i];
        const ny = baseNormals[i + 1];
        const nz = baseNormals[i + 2];

        const theta = Math.atan2(nz, nx);
        const phi = Math.acos(ny);

        // Animated rotation
        const spinAngle = theta + t * 0.4;
        const tubeAngle = phi * 2 - Math.PI;

        // Torus coordinates
        const torusX = (R + r * Math.cos(tubeAngle)) * Math.cos(spinAngle);
        const torusY = r * Math.sin(tubeAngle);
        const torusZ = (R + r * Math.cos(tubeAngle)) * Math.sin(spinAngle);

        // Animated orbital textures - spiraling inward
        const orbitRings = 10;
        const spiralTwist = 4;

        // Animated spiral grooves - they flow inward
        const spiralAngle = spinAngle * spiralTwist + tubeAngle * 2 - t * 0.8;
        const ringPattern = Math.sin(spiralAngle * orbitRings) * 0.025;

        // Animated radial rays/gleams - pulsing toward center
        const numRays = 8;
        const rayAngle = spinAngle * numRays + t * 2; // Rays rotate with animation
        const raySharpness = Math.pow(Math.abs(Math.cos(rayAngle)), 8);
        const rayPulse = 0.7 + 0.3 * Math.sin(t * 3); // Pulsing intensity
        const rayStrength = raySharpness * 0.06 * rayPulse * (1 - Math.abs(Math.cos(tubeAngle)));

        // Combine orbital displacement with animated rays
        const orbitDisp = ringPattern + rayStrength;

        // Blocky displacement
        const blockX = Math.floor(torusX / blockSize) * blockSize + blockSize * 0.5;
        const blockY = Math.floor(torusY / blockSize) * blockSize + blockSize * 0.5;
        const blockZ = Math.floor(torusZ / blockSize) * blockSize + blockSize * 0.5;

        // Fade block effect near center hole to keep it circular
        const distFromCenter = Math.sqrt(torusX * torusX + torusZ * torusZ);
        const blockFade = Math.min(1, Math.max(0, (distFromCenter - R * 0.6) / (R * 0.5)));
        const actualBlockBlend = blockBlend * blockFade;

        // Apply orbital texture displacement
        const normalX = Math.cos(spinAngle);
        const normalZ = Math.sin(spinAngle);

        const baseX = torusX + orbitDisp * normalX;
        const baseY = torusY + orbitDisp * 0.5;
        const baseZ = torusZ + orbitDisp * normalZ;

        // Apply blend and scale
        const finalX = (baseX * (1 - actualBlockBlend) + blockX * actualBlockBlend) * scale;
        const finalY = (baseY * (1 - actualBlockBlend) + blockY * actualBlockBlend) * scale;
        const finalZ = (baseZ * (1 - actualBlockBlend) + blockZ * actualBlockBlend) * scale;

        spiky[i] = finalX;
        spiky[i + 1] = finalY;
        spiky[i + 2] = finalZ;
      }
    };

    // Determine current phase
    const t1 = holdDuration; // End of sphere hold
    const t2 = t1 + morphDuration; // End of sphere->brain morph
    const t3 = t2 + brainHoldDuration; // End of brain hold (más largo)
    const t4 = t3 + morphDuration; // End of brain->spiky morph
    const t5 = t4 + holdDuration; // End of spiky hold
    const t6 = t5 + morphDuration; // End of spiky->brain morph
    const t7 = t6 + brainHoldDuration; // End of brain hold (más largo)
    const t8 = t7 + morphDuration; // End of brain->sphere morph

    if (cycleTime < t1) {
      // Hold sphere - front view
      morphProgress = 0;
      fromPositions = sphere;
      toPositions = sphere;
      cameraPositionRef.current.targetX = 0;
      cameraPositionRef.current.targetY = 0;
      cameraPositionRef.current.targetZ = 4;
    } else if (cycleTime < t2) {
      // Morph sphere -> brain - front view
      morphProgress = cubicInOut((cycleTime - t1) / morphDuration);
      fromPositions = sphere;
      toPositions = brain;
      cameraPositionRef.current.targetX = 0;
      cameraPositionRef.current.targetY = 0;
      cameraPositionRef.current.targetZ = 4;
    } else if (cycleTime < t3) {
      // Hold brain - front view
      morphProgress = 0;
      fromPositions = brain;
      toPositions = brain;
      cameraPositionRef.current.targetX = 0;
      cameraPositionRef.current.targetY = 0;
      cameraPositionRef.current.targetZ = 4;
    } else if (cycleTime < t4) {
      // Morph brain -> Vortex (camera transitions to angled view)
      updateAura();
      morphProgress = cubicInOut((cycleTime - t3) / morphDuration);
      fromPositions = brain;
      toPositions = spiky;
      // Camera angled to show the ring and hole clearly
      cameraPositionRef.current.targetX = 0;
      cameraPositionRef.current.targetY = 2.5;
      cameraPositionRef.current.targetZ = 2.5;
    } else if (cycleTime < t5) {
      // Hold Vortex - 50 degree view
      updateAura();
      morphProgress = 0;
      fromPositions = spiky;
      toPositions = spiky;
      // Camera at ~50 degrees
      cameraPositionRef.current.targetX = 0;
      cameraPositionRef.current.targetY = 2.5;
      cameraPositionRef.current.targetZ = 2.5;
    } else if (cycleTime < t6) {
      // Morph Vortex -> brain (camera transitions back to front view)
      updateAura();
      morphProgress = cubicInOut((cycleTime - t5) / morphDuration);
      fromPositions = spiky;
      toPositions = brain;
      // Transition camera back to front view
      cameraPositionRef.current.targetX = 0;
      cameraPositionRef.current.targetY = 0;
      cameraPositionRef.current.targetZ = 4;
    } else if (cycleTime < t7) {
      // Hold brain - front view
      morphProgress = 0;
      fromPositions = brain;
      toPositions = brain;
      cameraPositionRef.current.targetX = 0;
      cameraPositionRef.current.targetY = 0;
      cameraPositionRef.current.targetZ = 4;
    } else {
      // Morph brain -> sphere - front view
      morphProgress = cubicInOut((cycleTime - t7) / morphDuration);
      fromPositions = brain;
      toPositions = sphere;
      cameraPositionRef.current.targetX = 0;
      cameraPositionRef.current.targetY = 0;
      cameraPositionRef.current.targetZ = 4;
    }

    // Interpolate positions
    for (let i = 0; i < current.length; i++) {
      current[i] = fromPositions[i] + (toPositions[i] - fromPositions[i]) * morphProgress;
    }

    // Update geometry - copy values to the buffer
    const positionArray = geometryRef.current.attributes.position.array as Float32Array;
    positionArray.set(current);
    geometryRef.current.attributes.position.needsUpdate = true;
    geometryRef.current.computeVertexNormals();

    // Subtle floating animation
    const floatY = Math.sin(time * 0.5) * 0.03;
    const floatX = Math.cos(time * 0.3) * 0.02;
    meshRef.current.position.y = floatY;
    meshRef.current.position.x = floatX;

    // Smooth rotation with mouse interaction
    // Interpolate current rotation towards target
    const rotLerp = 0.08;
    rotationRef.current.x += (rotationRef.current.targetX - rotationRef.current.x) * rotLerp;
    rotationRef.current.y += (rotationRef.current.targetY - rotationRef.current.y) * rotLerp;

    // Auto rotation when not dragging (slower)
    if (!mouseRef.current.isDragging) {
      rotationRef.current.targetY += 0.003;
      rotationRef.current.targetX = Math.sin(time * 0.2) * 0.15;
    }

    // Apply rotation
    meshRef.current.rotation.y = rotationRef.current.y;
    meshRef.current.rotation.x = rotationRef.current.x;

    // Animate camera position smoothly
    const camLerp = 0.04;
    cameraPositionRef.current.x += (cameraPositionRef.current.targetX - cameraPositionRef.current.x) * camLerp;
    cameraPositionRef.current.y += (cameraPositionRef.current.targetY - cameraPositionRef.current.y) * camLerp;
    cameraPositionRef.current.z += (cameraPositionRef.current.targetZ - cameraPositionRef.current.z) * camLerp;

    if (cameraRef.current) {
      cameraRef.current.position.set(
        cameraPositionRef.current.x,
        cameraPositionRef.current.y,
        cameraPositionRef.current.z
      );
      cameraRef.current.lookAt(0, 0, 0);
    }

    // Simple orbital effect - particles floating around the shape
    if (orbitParticlesRef.current && orbitGeometryRef.current) {
      const positions = orbitGeometryRef.current.attributes.position.array as Float32Array;
      const particleCount = positions.length / 3;

      // Single simple orbit - particles scattered around floating gently
      for (let i = 0; i < particleCount; i++) {
        // Each particle has a unique but deterministic position
        const seed1 = Math.sin(i * 127.1) * 43758.5453;
        const seed2 = Math.sin(i * 269.5) * 43758.5453;
        const seed3 = Math.sin(i * 113.5) * 43758.5453;

        const baseAngle = (seed1 - Math.floor(seed1)) * Math.PI * 2;
        const baseHeight = ((seed2 - Math.floor(seed2)) - 0.5) * 2;
        const baseRadius = 1.8 + (seed3 - Math.floor(seed3)) * 0.8;

        // Gentle floating motion
        const angle = baseAngle + time * 0.15;
        const heightOsc = Math.sin(time * 0.3 + i * 0.5) * 0.15;

        const x = Math.cos(angle) * baseRadius;
        const y = baseHeight + heightOsc;
        const z = Math.sin(angle) * baseRadius;

        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;
      }

      (orbitParticlesRef.current.material as THREE.PointsMaterial).opacity = 0.5;
      orbitGeometryRef.current.attributes.position.needsUpdate = true;
    }

    // Render
    rendererRef.current.render(sceneRef.current, cameraRef.current);

    animationRef.current = requestAnimationFrame(animate);
  }, [speed, stageHold]);

  useEffect(() => {
    initThree();

    const handleVisibility = () => {
      isVisibleRef.current = !document.hidden;
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Mouse interaction handlers
    const container = containerRef.current;
    let cleanupMouse = () => {};

    if (container) {
      const handleMouseDown = (e: MouseEvent) => {
        mouseRef.current.isDragging = true;
        mouseRef.current.prevX = e.clientX;
        mouseRef.current.prevY = e.clientY;
      };

      const handleMouseMove = (e: MouseEvent) => {
        if (!mouseRef.current.isDragging) return;

        const deltaX = e.clientX - mouseRef.current.prevX;
        const deltaY = e.clientY - mouseRef.current.prevY;

        // Update target rotation based on drag
        rotationRef.current.targetY += deltaX * 0.008;
        rotationRef.current.targetX += deltaY * 0.008;

        // Clamp X rotation to prevent flipping
        rotationRef.current.targetX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotationRef.current.targetX));

        mouseRef.current.prevX = e.clientX;
        mouseRef.current.prevY = e.clientY;
      };

      const handleMouseUp = () => {
        mouseRef.current.isDragging = false;
      };

      const handleMouseLeave = () => {
        mouseRef.current.isDragging = false;
      };

      // Touch support
      const handleTouchStart = (e: TouchEvent) => {
        if (e.touches.length === 1) {
          mouseRef.current.isDragging = true;
          mouseRef.current.prevX = e.touches[0].clientX;
          mouseRef.current.prevY = e.touches[0].clientY;
        }
      };

      const handleTouchMove = (e: TouchEvent) => {
        if (!mouseRef.current.isDragging || e.touches.length !== 1) return;

        const deltaX = e.touches[0].clientX - mouseRef.current.prevX;
        const deltaY = e.touches[0].clientY - mouseRef.current.prevY;

        rotationRef.current.targetY += deltaX * 0.008;
        rotationRef.current.targetX += deltaY * 0.008;
        rotationRef.current.targetX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotationRef.current.targetX));

        mouseRef.current.prevX = e.touches[0].clientX;
        mouseRef.current.prevY = e.touches[0].clientY;
      };

      const handleTouchEnd = () => {
        mouseRef.current.isDragging = false;
      };

      container.addEventListener('mousedown', handleMouseDown);
      container.addEventListener('mousemove', handleMouseMove);
      container.addEventListener('mouseup', handleMouseUp);
      container.addEventListener('mouseleave', handleMouseLeave);
      container.addEventListener('touchstart', handleTouchStart, { passive: true });
      container.addEventListener('touchmove', handleTouchMove, { passive: true });
      container.addEventListener('touchend', handleTouchEnd);

      cleanupMouse = () => {
        container.removeEventListener('mousedown', handleMouseDown);
        container.removeEventListener('mousemove', handleMouseMove);
        container.removeEventListener('mouseup', handleMouseUp);
        container.removeEventListener('mouseleave', handleMouseLeave);
        container.removeEventListener('touchstart', handleTouchStart);
        container.removeEventListener('touchmove', handleTouchMove);
        container.removeEventListener('touchend', handleTouchEnd);
      };
    }

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      // Cleanup
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibility);
      cleanupMouse();

      if (geometryRef.current) {
        geometryRef.current.dispose();
      }
      if (orbitGeometryRef.current) {
        orbitGeometryRef.current.dispose();
      }
      if (orbitParticlesRef.current && orbitParticlesRef.current.material) {
        (orbitParticlesRef.current.material as THREE.Material).dispose();
      }
      if (meshRef.current && meshRef.current.material) {
        (meshRef.current.material as THREE.Material).dispose();
      }
      if (rendererRef.current) {
        rendererRef.current.dispose();
        if (containerRef.current && rendererRef.current.domElement) {
          containerRef.current.removeChild(rendererRef.current.domElement);
        }
      }
      if (sceneRef.current) {
        sceneRef.current.clear();
      }
    };
  }, [initThree, animate]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        width: size,
        height: size,
        display: 'block',
        cursor: 'grab',
        touchAction: 'none'
      }}
    />
  );
}

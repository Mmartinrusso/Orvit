'use client';

import React, { Suspense, useState, useRef, useEffect } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import {
  OrbitControls,
  useGLTF,
  Environment,
  ContactShadows,
  Html,
  Center,
  Grid,
  PerspectiveCamera,
  useProgress
} from '@react-three/drei';
import * as THREE from 'three';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Box,
  Loader2,
  AlertCircle,
  Move3D,
  Sun,
  Grid3X3,
  Eye,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn, formatNumber } from '@/lib/utils';

// Loader component que muestra el progreso
function Loader() {
  const { progress } = useProgress();
  return (
    <Html center>
      <div className="flex flex-col items-center gap-2 bg-background/90 p-4 rounded-lg border shadow-lg">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-medium">Cargando modelo 3D...</p>
        <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">{formatNumber(progress, 0)}%</p>
      </div>
    </Html>
  );
}

// Componente que carga y renderiza el modelo GLTF/GLB
interface ModelProps {
  url: string;
  onLoad?: () => void;
  onError?: (error: Error) => void;
  wireframe?: boolean;
  autoRotate?: boolean;
}

function Model({ url, onLoad, onError, wireframe = false, autoRotate = false }: ModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene } = useGLTF(url, true, true, (loader) => {
    loader.manager.onError = (url) => {
      onError?.(new Error(`Error cargando: ${url}`));
    };
  });

  useEffect(() => {
    if (scene) {
      // Centrar y escalar el modelo
      const box = new THREE.Box3().setFromObject(scene);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());

      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 2 / maxDim;

      scene.scale.setScalar(scale);
      scene.position.sub(center.multiplyScalar(scale));

      // Aplicar wireframe si está habilitado
      scene.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach(mat => {
              if (mat instanceof THREE.MeshStandardMaterial) {
                mat.wireframe = wireframe;
              }
            });
          } else if (mesh.material instanceof THREE.MeshStandardMaterial) {
            mesh.material.wireframe = wireframe;
          }
        }
      });

      onLoad?.();
    }
  }, [scene, onLoad, wireframe]);

  // Auto-rotación
  useFrame((state, delta) => {
    if (autoRotate && groupRef.current) {
      groupRef.current.rotation.y += delta * 0.3;
    }
  });

  return (
    <group ref={groupRef}>
      <primitive object={scene} />
    </group>
  );
}

// Placeholder cuando no hay modelo
function PlaceholderModel() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.5;
    }
  });

  return (
    <Center>
      <mesh ref={meshRef}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color="#6366f1"
          wireframe
          transparent
          opacity={0.5}
        />
      </mesh>
    </Center>
  );
}

// Controles de cámara
function CameraController({
  resetTrigger
}: {
  resetTrigger: number;
}) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    if (resetTrigger > 0 && controlsRef.current) {
      camera.position.set(3, 2, 3);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  }, [resetTrigger, camera]);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enablePan
      enableZoom
      enableRotate
      minDistance={1}
      maxDistance={20}
      minPolarAngle={0}
      maxPolarAngle={Math.PI}
    />
  );
}

// Props del componente principal
interface Machine3DViewerProps {
  modelUrl?: string | null;
  className?: string;
  onComponentClick?: (componentName: string) => void;
  height?: string;
}

export function Machine3DViewer({
  modelUrl,
  className,
  onComponentClick,
  height = "400px"
}: Machine3DViewerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wireframe, setWireframe] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [ambientIntensity, setAmbientIntensity] = useState([0.5]);
  const [resetTrigger, setResetTrigger] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleLoad = () => {
    setIsLoading(false);
    setError(null);
  };

  const handleError = (err: Error) => {
    setIsLoading(false);
    setError(err.message || 'Error al cargar el modelo 3D');
  };

  const handleResetCamera = () => {
    setResetTrigger(prev => prev + 1);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Si no hay modelo, mostrar placeholder
  const hasModel = modelUrl && modelUrl.trim() !== '';

  return (
    <TooltipProvider>
      <div
        ref={containerRef}
        className={cn(
          "relative rounded-lg border bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 overflow-hidden",
          isFullscreen && "fixed inset-0 z-50 rounded-none",
          className
        )}
        style={{ height: isFullscreen ? '100vh' : height }}
      >
        {/* Canvas 3D */}
        <Canvas
          shadows
          dpr={[1, 2]}
          gl={{
            antialias: true,
            preserveDrawingBuffer: true,
          }}
          camera={{ position: [3, 2, 3], fov: 50 }}
        >
          <Suspense fallback={<Loader />}>
            {/* Iluminación */}
            <ambientLight intensity={ambientIntensity[0]} />
            <spotLight
              position={[10, 10, 10]}
              angle={0.15}
              penumbra={1}
              intensity={1}
              castShadow
              shadow-mapSize={2048}
            />
            <pointLight position={[-10, -10, -10]} intensity={0.5} />

            {/* Modelo o Placeholder */}
            {hasModel ? (
              <Model
                url={modelUrl}
                onLoad={handleLoad}
                onError={handleError}
                wireframe={wireframe}
                autoRotate={autoRotate}
              />
            ) : (
              <PlaceholderModel />
            )}

            {/* Grid del suelo */}
            {showGrid && (
              <Grid
                infiniteGrid
                fadeDistance={30}
                fadeStrength={5}
                cellSize={0.5}
                cellThickness={0.5}
                cellColor="#6366f1"
                sectionSize={2}
                sectionThickness={1}
                sectionColor="#8b5cf6"
              />
            )}

            {/* Sombras de contacto */}
            <ContactShadows
              position={[0, -0.99, 0]}
              opacity={0.4}
              scale={10}
              blur={2}
              far={4}
            />

            {/* Entorno (opcional, mejora la iluminación) */}
            <Environment preset="city" />

            {/* Controles de órbita */}
            <CameraController resetTrigger={resetTrigger} />
          </Suspense>
        </Canvas>

        {/* Overlay de error */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="text-center p-4">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-2" />
              <p className="text-sm font-medium text-destructive">{error}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Verifica que el archivo sea un modelo 3D válido (GLB/GLTF)
              </p>
            </div>
          </div>
        )}

        {/* Mensaje cuando no hay modelo */}
        {!hasModel && (
          <div className="absolute bottom-4 left-4 right-4 text-center">
            <p className="text-xs text-muted-foreground bg-background/80 backdrop-blur-sm rounded-lg py-2 px-4 inline-block">
              <Box className="h-4 w-4 inline-block mr-1 -mt-0.5" />
              Sube un modelo 3D (GLB/GLTF) para visualizarlo aquí
            </p>
          </div>
        )}

        {/* Controles */}
        <div className="absolute top-2 right-2 flex flex-col gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="secondary"
                size="icon"
                className="h-8 w-8 bg-background/80 backdrop-blur-sm"
                onClick={handleResetCamera}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Resetear cámara</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={wireframe ? "default" : "secondary"}
                size="icon"
                className="h-8 w-8 bg-background/80 backdrop-blur-sm"
                onClick={() => setWireframe(!wireframe)}
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Wireframe</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={autoRotate ? "default" : "secondary"}
                size="icon"
                className="h-8 w-8 bg-background/80 backdrop-blur-sm"
                onClick={() => setAutoRotate(!autoRotate)}
              >
                <Move3D className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Auto-rotar</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={showGrid ? "default" : "secondary"}
                size="icon"
                className="h-8 w-8 bg-background/80 backdrop-blur-sm"
                onClick={() => setShowGrid(!showGrid)}
              >
                <Eye className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Mostrar grid</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="secondary"
                size="icon"
                className="h-8 w-8 bg-background/80 backdrop-blur-sm"
                onClick={toggleFullscreen}
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Pantalla completa</TooltipContent>
          </Tooltip>
        </div>

        {/* Control de iluminación */}
        <div className="absolute bottom-2 right-2 flex items-center gap-2 bg-background/80 backdrop-blur-sm rounded-lg p-2">
          <Sun className="h-4 w-4 text-muted-foreground" />
          <Slider
            value={ambientIntensity}
            onValueChange={setAmbientIntensity}
            min={0.1}
            max={1}
            step={0.1}
            className="w-20"
          />
        </div>

        {/* Instrucciones */}
        <div className="absolute bottom-2 left-2 text-xs text-muted-foreground bg-background/60 backdrop-blur-sm rounded px-2 py-1">
          <span className="hidden sm:inline">
            🖱️ Click + arrastrar: rotar | Scroll: zoom | Shift + arrastrar: mover
          </span>
          <span className="sm:hidden">
            👆 Arrastrar: rotar | Pinch: zoom
          </span>
        </div>
      </div>
    </TooltipProvider>
  );
}

// Precargar modelo (opcional, para mejor UX)
export function preloadModel(url: string) {
  useGLTF.preload(url);
}

export default Machine3DViewer;

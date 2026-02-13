'use client';

import { useEffect, useRef, useCallback } from 'react';

interface Point3D {
  x: number;
  y: number;
  z: number;
  originalX: number;
  originalY: number;
  originalZ: number;
}

interface OrvitParticleLogoProps {
  width?: number;
  height?: number;
  particleColor?: string;
  className?: string;
  particleCount?: number;
}

export default function OrvitParticleLogo({
  width = 400,
  height = 400,
  particleColor = '#1e293b',
  className = '',
  particleCount = 2000
}: OrvitParticleLogoProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointsRef = useRef<Point3D[]>([]);
  const animationRef = useRef<number>(0);
  const rotationRef = useRef({ x: 0, y: 0 });
  const mouseRef = useRef({ x: 0, y: 0, active: false });

  const initPoints = useCallback(() => {
    const radius = Math.min(width, height) * 0.35;
    pointsRef.current = [];

    // Distribución de Fibonacci para puntos uniformes en esfera
    const goldenRatio = (1 + Math.sqrt(5)) / 2;

    for (let i = 0; i < particleCount; i++) {
      const theta = 2 * Math.PI * i / goldenRatio;
      const phi = Math.acos(1 - 2 * (i + 0.5) / particleCount);

      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);

      pointsRef.current.push({
        x, y, z,
        originalX: x,
        originalY: y,
        originalZ: z
      });
    }
  }, [width, height, particleCount]);

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height / 2;
    const time = Date.now() * 0.001;
    const radius = Math.min(width, height) * 0.35;

    // Rotación automática suave
    rotationRef.current.y += 0.003;
    rotationRef.current.x = Math.sin(time * 0.2) * 0.1;

    // Influencia del mouse
    if (mouseRef.current.active) {
      const targetRotX = (mouseRef.current.y - centerY) / height * 0.5;
      const targetRotY = (mouseRef.current.x - centerX) / width * 0.5;
      rotationRef.current.x += (targetRotX - rotationRef.current.x) * 0.05;
    }

    const cosX = Math.cos(rotationRef.current.x);
    const sinX = Math.sin(rotationRef.current.x);
    const cosY = Math.cos(rotationRef.current.y);
    const sinY = Math.sin(rotationRef.current.y);

    // Transformar y proyectar puntos
    const projectedPoints: { x: number; y: number; z: number; size: number }[] = [];

    pointsRef.current.forEach((point, index) => {
      // Aplicar ruido/distorsión orgánica
      const noiseScale = 0.15;
      const noiseSpeed = 0.5;
      const noise = Math.sin(point.originalX * 0.02 + time * noiseSpeed) *
                   Math.cos(point.originalY * 0.02 + time * noiseSpeed * 0.7) *
                   Math.sin(point.originalZ * 0.02 + time * noiseSpeed * 0.5);

      const distortion = 1 + noise * noiseScale;

      let x = point.originalX * distortion;
      let y = point.originalY * distortion;
      let z = point.originalZ * distortion;

      // Rotación Y
      const tempX = x * cosY - z * sinY;
      const tempZ = x * sinY + z * cosY;
      x = tempX;
      z = tempZ;

      // Rotación X
      const tempY = y * cosX - z * sinX;
      z = y * sinX + z * cosX;
      y = tempY;

      // Proyección perspectiva
      const perspective = 600;
      const scale = perspective / (perspective + z);
      const projX = centerX + x * scale;
      const projY = centerY + y * scale;

      // Tamaño basado en profundidad
      const size = Math.max(0.5, 1.5 * scale);

      // Solo mostrar puntos visibles (z positivo = frente)
      const opacity = (z + radius) / (radius * 2);

      if (opacity > 0.1) {
        projectedPoints.push({
          x: projX,
          y: projY,
          z: z,
          size: size
        });
      }
    });

    // Ordenar por profundidad (más lejanos primero)
    projectedPoints.sort((a, b) => a.z - b.z);

    // Dibujar puntos
    projectedPoints.forEach(point => {
      const opacity = Math.min(1, (point.z + radius) / (radius * 1.5)) * 0.9;

      ctx.beginPath();
      ctx.arc(point.x, point.y, point.size, 0, Math.PI * 2);
      ctx.fillStyle = particleColor;
      ctx.globalAlpha = Math.max(0.1, opacity);
      ctx.fill();
    });

    ctx.globalAlpha = 1;
    animationRef.current = requestAnimationFrame(animate);
  }, [width, height, particleColor]);

  useEffect(() => {
    initPoints();
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [initPoints, animate]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    mouseRef.current.x = e.clientX - rect.left;
    mouseRef.current.y = e.clientY - rect.top;
    mouseRef.current.active = true;
  }, []);

  const handleMouseLeave = useCallback(() => {
    mouseRef.current.active = false;
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={className}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ background: 'transparent' }}
    />
  );
}

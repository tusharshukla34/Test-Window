'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Award } from 'lucide-react';

interface Academy3DHologramProps {
  className?: string;
  studentName?: string;
}

export function Academy3DHologram({ className = '', studentName }: Academy3DHologramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [rotate, setRotate] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      // Only track if close to or over the hero area
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const distX = (e.clientX - centerX) / (window.innerWidth / 2);
      const distY = (e.clientY - centerY) / (window.innerHeight / 2);

      // Subtle tilt: +/- 15 degrees max
      setRotate({
        x: Math.max(-15, Math.min(15, -distY * 18)),
        y: Math.max(-15, Math.min(15, distX * 18))
      });
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative w-48 h-48 sm:w-56 sm:h-56 flex items-center justify-center select-none pointer-events-none ${className}`}
      style={{ perspective: '800px' }}
    >
      {/* Dynamic 3D Gyroscope Stage */}
      <div
        className="relative w-full h-full flex items-center justify-center transition-transform duration-300 ease-out"
        style={{
          transform: `rotateX(${rotate.x}deg) rotateY(${rotate.y}deg)`,
          transformStyle: 'preserve-3d'
        }}
      >
        {/* Ambient Glow Aura */}
        <div className="absolute w-40 h-40 rounded-full bg-cyan-400/20 blur-2xl animate-pulse pointer-events-none" />

        {/* Ring 1 - Outer Cyan Orbit */}
        <div
          className="absolute w-36 h-36 sm:w-44 sm:h-44 rounded-full border border-cyan-400/40 border-dashed"
          style={{
            transform: 'rotateX(70deg) rotateZ(0deg)',
            animation: 'spinOrbit 16s linear infinite',
            transformStyle: 'preserve-3d',
            boxShadow: '0 0 20px rgba(34, 211, 238, 0.25), inset 0 0 15px rgba(34, 211, 238, 0.2)'
          }}
        >
          {/* Orbital Satellite Node */}
          <div
            className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-cyan-300 shadow-[0_0_12px_#22d3ee] flex items-center justify-center"
            style={{ transform: 'translateZ(10px)' }}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-white" />
          </div>
        </div>

        {/* Ring 2 - Middle Teal Ring */}
        <div
          className="absolute w-28 h-28 sm:w-34 sm:h-34 rounded-full border-2 border-teal-300/50"
          style={{
            transform: 'rotateY(60deg) rotateX(25deg)',
            animation: 'spinOrbitReverse 12s linear infinite',
            transformStyle: 'preserve-3d',
            boxShadow: '0 0 15px rgba(45, 212, 191, 0.3)'
          }}
        >
          {/* Orbital Node 2 */}
          <div
            className="absolute top-1/2 -right-2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-emerald-300 shadow-[0_0_10px_#6ee7b7]"
            style={{ transform: 'translateZ(8px)' }}
          />
        </div>

        {/* Ring 3 - Inner Emerald Inclined Ring */}
        <div
          className="absolute w-22 h-22 sm:w-26 sm:h-26 rounded-full border border-emerald-400/60 border-dotted"
          style={{
            transform: 'rotateX(-45deg) rotateY(45deg)',
            animation: 'spinOrbit 9s linear infinite',
            transformStyle: 'preserve-3d'
          }}
        />

        {/* 3D Floating Center Core / Crystal Gem */}
        <div
          className="relative z-10 w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-teal-500 via-cyan-400 to-white/90 p-[2px] shadow-2xl shadow-cyan-500/40"
          style={{
            transform: 'translateZ(30px) rotateX(15deg) rotateY(15deg)',
            animation: 'floatGem 4s ease-in-out infinite',
            transformStyle: 'preserve-3d'
          }}
        >
          <div className="w-full h-full rounded-2xl bg-teal-950/80 backdrop-blur-md flex flex-col items-center justify-center border border-white/30 text-white relative overflow-hidden">
            {/* Shimmer light across core */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent animate-pulse" />
            <Award className="w-7 h-7 sm:w-8 sm:h-8 text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
            <span className="text-[9px] font-black uppercase tracking-wider text-cyan-100 mt-0.5">
              PRO
            </span>
          </div>
        </div>

        {/* Floating Mini 3D Badge (Top Right) */}
        <div
          className="absolute -top-1 -right-2 px-2.5 py-1 rounded-full bg-cyan-950/90 border border-cyan-400/40 text-cyan-300 text-[10px] font-extrabold shadow-lg flex items-center gap-1 backdrop-blur-sm"
          style={{
            transform: 'translateZ(45px)',
            animation: 'floatBadge 3.5s ease-in-out infinite alternate'
          }}
        >
          <Sparkles size={11} className="text-cyan-300 animate-spin" />
          <span>Active</span>
        </div>
      </div>

      <style jsx>{`
        @keyframes spinOrbit {
          from {
            transform: rotateX(70deg) rotateZ(0deg);
          }
          to {
            transform: rotateX(70deg) rotateZ(360deg);
          }
        }
        @keyframes spinOrbitReverse {
          from {
            transform: rotateY(60deg) rotateX(25deg) rotateZ(360deg);
          }
          to {
            transform: rotateY(60deg) rotateX(25deg) rotateZ(0deg);
          }
        }
        @keyframes floatGem {
          0%, 100% {
            transform: translateZ(30px) translateY(0px) rotateX(15deg) rotateY(15deg);
          }
          50% {
            transform: translateZ(40px) translateY(-8px) rotateX(10deg) rotateY(25deg);
          }
        }
        @keyframes floatBadge {
          0% {
            transform: translateZ(45px) translateY(0px);
          }
          100% {
            transform: translateZ(45px) translateY(-6px);
          }
        }
      `}</style>
    </div>
  );
}

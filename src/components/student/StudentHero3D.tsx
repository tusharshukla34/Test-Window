'use client';

import React, { useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Layers, FileCheck2, Sparkles, Orbit, Compass, Award } from 'lucide-react';
import { Academy3DHologram } from '@/components/ui/Academy3DHologram';

interface StudentHero3DProps {
  studentName: string;
  studentId: string;
  batches: { id: string; name: string }[];
}

export default function StudentHero3D({ studentName, studentId, batches }: StudentHero3DProps) {
  const router = useRouter();
  const heroRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!heroRef.current) return;
    const rect = heroRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Smooth tilt: +/- 6 degrees max for pleasant, non-dizzying 3D perspective
    const rotX = -((y - centerY) / centerY) * 7;
    const rotY = ((x - centerX) / centerX) * 7;

    setTilt({ x: rotX, y: rotY });
    setMousePos({
      x: Math.round((x / rect.width) * 100),
      y: Math.round((y / rect.height) * 100)
    });
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setTilt({ x: 0, y: 0 });
    setMousePos({ x: 50, y: 50 });
  };

  return (
    <div
      style={{ perspective: '1200px' }}
      className="w-full select-none"
    >
      <div
        ref={heroRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          transform: `rotateX(${tilt.x.toFixed(2)}deg) rotateY(${tilt.y.toFixed(2)}deg) translateZ(${isHovered ? '8px' : '0px'})`,
          transformStyle: 'preserve-3d',
          transition: isHovered ? 'transform 0.08s ease-out' : 'transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1)',
          willChange: 'transform'
        }}
        className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-8 bg-gradient-to-br from-slate-950 via-teal-950 to-cyan-950 text-white p-6 sm:p-9 rounded-3xl shadow-2xl shadow-teal-950/40 border border-teal-500/30 overflow-hidden"
      >
        {/* Dynamic Specular Sheen following cursor */}
        <div
          className="pointer-events-none absolute inset-0 z-0 transition-opacity duration-300"
          style={{
            opacity: isHovered ? 0.45 : 0.15,
            background: `radial-gradient(circle 500px at ${mousePos.x}% ${mousePos.y}%, rgba(34, 211, 238, 0.35) 0%, rgba(20, 184, 166, 0.15) 40%, transparent 70%)`
          }}
        />

        {/* 3D Animated Background Grid Texture */}
        <div
          className="pointer-events-none absolute inset-0 opacity-15"
          style={{
            backgroundImage: `linear-gradient(to right, rgba(45, 212, 191, 0.15) 1px, transparent 1px), linear-gradient(to bottom, rgba(45, 212, 191, 0.15) 1px, transparent 1px)`,
            backgroundSize: '32px 32px',
            transform: 'translateZ(-10px)'
          }}
        />

        {/* Floating 3D Background Nebula Sphere */}
        <div
          className="pointer-events-none absolute -right-20 -top-20 w-80 h-80 rounded-full bg-cyan-500/20 blur-3xl animate-pulse"
          style={{ transform: 'translateZ(-20px)' }}
        />
        <div
          className="pointer-events-none absolute -left-20 -bottom-20 w-80 h-80 rounded-full bg-teal-500/20 blur-3xl"
          style={{ transform: 'translateZ(-20px)' }}
        />

        {/* Left Column Content with Progressive 3D Depth */}
        <div
          className="relative z-10 space-y-4 max-w-xl"
          style={{ transform: 'translateZ(24px)', transformStyle: 'preserve-3d' }}
        >
          {/* Header Badges with 3D Pop */}
          <div
            className="flex items-center gap-2.5 flex-wrap"
            style={{ transform: 'translateZ(12px)', transformStyle: 'preserve-3d' }}
          >
            <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-teal-300 font-extrabold px-3 py-1 rounded-full bg-teal-900/70 border border-teal-400/40 shadow-xs backdrop-blur-md">
              <Compass size={12} className="text-cyan-300 animate-spin" style={{ animationDuration: '8s' }} />
              Student Academic Workspace
            </span>
            <span className="font-mono text-xs text-cyan-200 font-bold px-2.5 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-700/50 shadow-inner">
              {studentId || 'STU'}
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold text-amber-300 px-2 py-0.5 rounded-full bg-amber-950/40 border border-amber-500/30">
              <Sparkles size={11} className="text-amber-400" /> Live Matrix
            </span>
          </div>

          {/* Main Title with 3D Depth */}
          <div style={{ transform: 'translateZ(20px)', transformStyle: 'preserve-3d' }}>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-cyan-100 to-teal-200 drop-shadow-[0_2px_12px_rgba(34,211,238,0.25)]">
              Welcome back, {studentName}
            </h1>
            <p className="text-teal-200/90 text-xs sm:text-sm leading-relaxed mt-2 font-medium">
              Access your personalized learning curriculum, submit daily homework solutions for teacher evaluation, and participate in scheduled mock examinations.
            </p>
          </div>

          {/* Batches with Glassmorphic 3D Elevation */}
          <div
            className="pt-1 flex flex-wrap items-center gap-2"
            style={{ transform: 'translateZ(28px)', transformStyle: 'preserve-3d' }}
          >
            <span className="text-[11px] font-bold text-teal-300 flex items-center gap-1">
              <Orbit size={13} className="text-teal-400" />
              Active Cohorts:
            </span>
            {batches.length === 0 ? (
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-white/10 text-slate-300 border border-white/10">
                No cohort assigned
              </span>
            ) : (
              batches.map(b => (
                <span
                  key={b.id}
                  className="text-[11px] font-extrabold px-3 py-1 rounded-full bg-white/15 text-white border border-white/25 backdrop-blur-md shadow-xs hover:border-cyan-400/60 transition-colors"
                >
                  {b.name}
                </span>
              ))
            )}
          </div>

          {/* Elevated 3D Action Buttons */}
          <div
            className="pt-2 flex items-center gap-3.5 flex-wrap"
            style={{ transform: 'translateZ(42px)', transformStyle: 'preserve-3d' }}
          >
            <button
              onClick={() => router.push('/student/batches')}
              className="group inline-flex items-center gap-2 px-4.5 py-2.5 rounded-xl bg-white hover:bg-teal-50 text-slate-900 text-xs sm:text-sm font-black transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-white/20 active:translate-y-0.5 shadow-lg border border-white cursor-pointer"
            >
              <Layers size={16} className="text-teal-600 group-hover:scale-110 transition-transform" />
              <span>Explore Batches</span>
            </button>
            <button
              onClick={() => router.push('/student/exams')}
              className="group inline-flex items-center gap-2 px-4.5 py-2.5 rounded-xl bg-gradient-to-r from-teal-400 via-cyan-400 to-emerald-400 hover:from-teal-300 hover:to-cyan-300 text-slate-950 text-xs sm:text-sm font-black transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-cyan-400/40 active:translate-y-0.5 shadow-lg border border-cyan-200 cursor-pointer"
            >
              <FileCheck2 size={16} className="text-slate-950 group-hover:scale-110 transition-transform" />
              <span>Launch Exams</span>
            </button>
          </div>
        </div>

        {/* Right Column: 3D Holographic Gyroscope with 3D Depth */}
        <div
          className="flex items-center justify-center relative z-20 self-center shrink-0"
          style={{ transform: 'translateZ(50px)', transformStyle: 'preserve-3d' }}
        >
          <Academy3DHologram studentName={studentName} />
        </div>
      </div>
    </div>
  );
}

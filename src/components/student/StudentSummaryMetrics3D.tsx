'use client';

import React, { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Clock,
  FileCheck2,
  BookOpen,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Zap,
  Flame,
  Award
} from 'lucide-react';

interface MetricCardItemProps {
  title: string;
  count: number;
  subtitle: string;
  href: string;
  variant: 'amber' | 'teal' | 'blue' | 'purple';
  icon: React.ReactNode;
  floatDelay: string;
}

function MetricCardItem({
  title,
  count,
  subtitle,
  href,
  variant,
  icon,
  floatDelay
}: MetricCardItemProps) {
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [glarePos, setGlarePos] = useState({ x: 50, y: 50, opacity: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const [dynamicShadow, setDynamicShadow] = useState('');

  // Tailored color themes for maximum 3D aesthetic and contrast
  const theme = {
    amber: {
      bg: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 50%, #fde68a 100%)',
      border: 'border-amber-200/90 hover:border-amber-400',
      title: 'text-amber-900',
      number: 'text-amber-950',
      subtitle: 'text-amber-800',
      glow: 'rgba(245, 158, 11, 0.35)',
      orb: 'bg-amber-400/25',
      bubbleBg: 'bg-gradient-to-tr from-amber-500 to-yellow-400 text-white',
      bubbleShadow: 'shadow-amber-500/30',
      glare: 'radial-gradient(circle at {x}% {y}%, rgba(254,243,199,0.85) 0%, rgba(251,191,36,0.3) 40%, transparent 70%)',
      ring: 'ring-amber-300/50'
    },
    teal: {
      bg: 'linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 50%, #99f6e4 100%)',
      border: 'border-teal-200/90 hover:border-teal-400',
      title: 'text-teal-900',
      number: 'text-teal-950',
      subtitle: 'text-teal-800',
      glow: 'rgba(20, 184, 166, 0.35)',
      orb: 'bg-teal-400/25',
      bubbleBg: 'bg-gradient-to-tr from-teal-500 to-emerald-400 text-white',
      bubbleShadow: 'shadow-teal-500/30',
      glare: 'radial-gradient(circle at {x}% {y}%, rgba(204,251,241,0.85) 0%, rgba(45,212,191,0.3) 40%, transparent 70%)',
      ring: 'ring-teal-300/50'
    },
    blue: {
      bg: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 50%, #bfdbfe 100%)',
      border: 'border-blue-200/90 hover:border-blue-400',
      title: 'text-blue-900',
      number: 'text-blue-950',
      subtitle: 'text-blue-800',
      glow: 'rgba(59, 130, 246, 0.35)',
      orb: 'bg-blue-400/25',
      bubbleBg: 'bg-gradient-to-tr from-blue-600 to-cyan-400 text-white',
      bubbleShadow: 'shadow-blue-500/30',
      glare: 'radial-gradient(circle at {x}% {y}%, rgba(219,234,254,0.85) 0%, rgba(96,165,250,0.3) 40%, transparent 70%)',
      ring: 'ring-blue-300/50'
    },
    purple: {
      bg: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 50%, #e9d5ff 100%)',
      border: 'border-purple-200/90 hover:border-purple-400',
      title: 'text-purple-900',
      number: 'text-purple-950',
      subtitle: 'text-purple-800',
      glow: 'rgba(168, 85, 247, 0.35)',
      orb: 'bg-purple-400/25',
      bubbleBg: 'bg-gradient-to-tr from-purple-600 to-fuchsia-400 text-white',
      bubbleShadow: 'shadow-purple-500/30',
      glare: 'radial-gradient(circle at {x}% {y}%, rgba(243,232,255,0.85) 0%, rgba(192,132,252,0.3) 40%, transparent 70%)',
      ring: 'ring-purple-300/50'
    }
  }[variant];

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotX = -((y - centerY) / centerY) * 14;
    const rotY = ((x - centerX) / centerX) * 14;

    setTilt({ x: rotX, y: rotY });

    const shadowX = (-rotY * 1.8).toFixed(1);
    const shadowY = (rotX * 1.8 + 20).toFixed(1);
    setDynamicShadow(`${shadowX}px ${shadowY}px 36px ${theme.glow}, 0 6px 16px rgba(15, 23, 42, 0.08)`);

    setGlarePos({
      x: Math.round((x / rect.width) * 100),
      y: Math.round((y / rect.height) * 100),
      opacity: 0.6
    });
  };

  const handleMouseEnter = () => setIsHovered(true);
  const handleMouseLeave = () => {
    setIsHovered(false);
    setTilt({ x: 0, y: 0 });
    setDynamicShadow('');
    setGlarePos(prev => ({ ...prev, opacity: 0 }));
  };

  return (
    <div
      style={{ perspective: '1000px' }}
      className="w-full"
    >
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={() => router.push(href)}
        style={{
          background: theme.bg,
          transform: isHovered
            ? `perspective(1000px) rotateX(${tilt.x.toFixed(2)}deg) rotateY(${tilt.y.toFixed(2)}deg) translateZ(16px) scale3d(1.04, 1.04, 1.04)`
            : 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0px) scale3d(1, 1, 1)',
          transformStyle: 'preserve-3d',
          transition: isHovered ? 'transform 0.08s ease-out' : 'transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)',
          willChange: 'transform',
          boxShadow: dynamicShadow || '0 10px 25px -5px rgba(160, 175, 200, 0.25), 0 8px 10px -6px rgba(160, 175, 200, 0.2), inset 1px 1px 2px rgba(255, 255, 255, 0.95)',
          animation: !isHovered ? `floatCard 4.2s ease-in-out infinite alternate ${floatDelay}` : 'none'
        }}
        className={`group relative rounded-3xl p-5 sm:p-6 border ${theme.border} cursor-pointer select-none overflow-hidden transition-all duration-300`}
      >
        {/* Specular Interactive Cursor Glare */}
        <div
          className="pointer-events-none absolute inset-0 z-20 transition-opacity duration-300"
          style={{
            opacity: glarePos.opacity,
            background: theme.glare.replace('{x}', String(glarePos.x)).replace('{y}', String(glarePos.y))
          }}
        />

        {/* Floating Pulsing Ambient Glow Orb Inside Card */}
        <div
          className={`pointer-events-none absolute -right-8 -top-8 w-32 h-32 rounded-full ${theme.orb} blur-2xl transition-transform duration-500 group-hover:scale-150`}
          style={{ transform: 'translateZ(-10px)' }}
        />

        {/* Card Header: Title & 3D Interactive Floating Bubble */}
        <div
          className="flex items-center justify-between mb-3.5"
          style={{ transform: 'translateZ(18px)', transformStyle: 'preserve-3d' }}
        >
          <span className={`text-[11px] sm:text-xs font-black uppercase tracking-wider ${theme.title} drop-shadow-xs`}>
            {title}
          </span>

          {/* 3D Floating Icon Sphere with Kinetic Rotation & Elevation */}
          <div
            className={`w-11 h-11 rounded-2xl ${theme.bubbleBg} shadow-lg ${theme.bubbleShadow} flex items-center justify-center transition-all duration-300 group-hover:scale-115 group-hover:-rotate-6 ring-2 ring-white/80`}
            style={{
              transform: isHovered ? 'translateZ(40px)' : 'translateZ(20px)',
              transformStyle: 'preserve-3d'
            }}
          >
            {icon}
          </div>
        </div>

        {/* Big Number Counter with 3D Pop */}
        <div
          className="my-1.5"
          style={{
            transform: isHovered ? 'translateZ(32px)' : 'translateZ(14px)',
            transformStyle: 'preserve-3d'
          }}
        >
          <p className={`text-4xl sm:text-5xl font-black ${theme.number} tracking-tight font-sans transition-transform duration-300 group-hover:scale-105 inline-block`}>
            {count}
          </p>
        </div>

        {/* Subtitle with Kinetic Hover Arrow */}
        <div
          className="mt-2.5 flex items-center gap-1.5 text-xs font-bold"
          style={{ transform: 'translateZ(16px)', transformStyle: 'preserve-3d' }}
        >
          <span className={`${theme.subtitle} font-bold transition-colors`}>{subtitle}</span>
          <ArrowRight
            size={14}
            className={`${theme.subtitle} transition-transform duration-300 group-hover:translate-x-1.5 group-hover:scale-110`}
          />
        </div>
      </div>
    </div>
  );
}

interface StudentSummaryMetrics3DProps {
  pendingAssignments: number;
  upcomingExams: number;
  awaitingEvaluation: number;
  completedAssignments: number;
  batchesCount: number;
}

export default function StudentSummaryMetrics3D({
  pendingAssignments,
  upcomingExams,
  awaitingEvaluation,
  completedAssignments,
  batchesCount
}: StudentSummaryMetrics3DProps) {
  return (
    <div className="space-y-3.5">
      {/* Section Header */}
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
          <Sparkles size={15} className="text-teal-600 animate-pulse" />
          <span>Overall Summary Across All Batches</span>
        </h2>
        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
          {batchesCount} {batchesCount === 1 ? 'Batch Enrolled' : 'Batches Enrolled'}
        </span>
      </div>

      {/* 4 Dynamic 3D Floating Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <MetricCardItem
          title="Total Pending Tasks"
          count={pendingAssignments}
          subtitle="Homework to submit"
          href="/student/assignments"
          variant="amber"
          floatDelay="0s"
          icon={<Clock size={20} className="animate-spin" style={{ animationDuration: '16s' }} />}
        />

        <MetricCardItem
          title="Available Exams"
          count={upcomingExams}
          subtitle="Mock exams scheduled"
          href="/student/exams"
          variant="teal"
          floatDelay="0.7s"
          icon={<FileCheck2 size={20} className="animate-bounce" style={{ animationDuration: '3.2s' }} />}
        />

        <MetricCardItem
          title="Under Review"
          count={awaitingEvaluation}
          subtitle="Awaiting evaluation"
          href="/student/assignments"
          variant="blue"
          floatDelay="1.4s"
          icon={<BookOpen size={20} className="group-hover:scale-110 transition-transform" />}
        />

        <MetricCardItem
          title="Completed Tasks"
          count={completedAssignments}
          subtitle="Graded & awarded"
          href="/student/assignments"
          variant="purple"
          floatDelay="2.1s"
          icon={<CheckCircle2 size={20} className="group-hover:rotate-12 transition-transform" />}
        />
      </div>

      {/* CSS 3D Keyframe Animations */}
      <style jsx global>{`
        @keyframes floatCard {
          0% {
            transform: perspective(1000px) translateY(0px) rotateX(0deg) rotateY(0deg);
          }
          50% {
            transform: perspective(1000px) translateY(-8px) rotateX(2deg) rotateY(-1deg);
          }
          100% {
            transform: perspective(1000px) translateY(0px) rotateX(0deg) rotateY(0deg);
          }
        }
      `}</style>
    </div>
  );
}

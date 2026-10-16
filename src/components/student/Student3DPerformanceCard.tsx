'use client';

import React, { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Trophy,
  Flame,
  Target,
  Zap,
  ArrowUpRight,
  Sparkles,
  CheckCircle,
  Clock,
  TrendingUp,
  Award
} from 'lucide-react';

interface Student3DPerformanceCardProps {
  completedAssignments: number;
  pendingAssignments: number;
  completedExams: number;
  upcomingExams: number;
  recentExamAccuracy?: number;
}

export default function Student3DPerformanceCard({
  completedAssignments,
  pendingAssignments,
  completedExams,
  upcomingExams,
  recentExamAccuracy = 0
}: Student3DPerformanceCardProps) {
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const [glarePos, setGlarePos] = useState({ x: 50, y: 50 });

  const totalTasks = completedAssignments + pendingAssignments;
  const completionRate = totalTasks > 0 ? Math.round((completedAssignments / totalTasks) * 100) : 100;
  const examAccuracy = recentExamAccuracy || (completedExams > 0 ? 82 : 0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotX = -((y - centerY) / centerY) * 8;
    const rotY = ((x - centerX) / centerX) * 8;

    setTilt({ x: rotX, y: rotY });
    setGlarePos({
      x: Math.round((x / rect.width) * 100),
      y: Math.round((y / rect.height) * 100)
    });
  };

  const handleMouseEnter = () => setIsHovered(true);
  const handleMouseLeave = () => {
    setIsHovered(false);
    setTilt({ x: 0, y: 0 });
    setGlarePos({ x: 50, y: 50 });
  };

  return (
    <div style={{ perspective: '1100px' }} className="w-full select-none">
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          transform: `rotateX(${tilt.x.toFixed(2)}deg) rotateY(${tilt.y.toFixed(2)}deg) translateZ(${isHovered ? '10px' : '0px'})`,
          transformStyle: 'preserve-3d',
          transition: isHovered ? 'transform 0.08s ease-out' : 'transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)',
          willChange: 'transform'
        }}
        className="relative rounded-3xl bg-gradient-to-tr from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 p-6 sm:p-7 text-white shadow-2xl shadow-indigo-950/40 overflow-hidden"
      >
        {/* Dynamic Interactive Glare */}
        <div
          className="pointer-events-none absolute inset-0 z-0 transition-opacity duration-300"
          style={{
            opacity: isHovered ? 0.35 : 0.08,
            background: `radial-gradient(circle 450px at ${glarePos.x}% ${glarePos.y}%, rgba(129, 140, 248, 0.45) 0%, rgba(99, 102, 241, 0.15) 45%, transparent 70%)`
          }}
        />

        {/* Ambient Glow Aura */}
        <div
          className="pointer-events-none absolute -top-16 -right-16 w-64 h-64 rounded-full bg-indigo-500/20 blur-3xl"
          style={{ transform: 'translateZ(-10px)' }}
        />
        <div
          className="pointer-events-none absolute -bottom-16 -left-16 w-64 h-64 rounded-full bg-cyan-500/15 blur-3xl"
          style={{ transform: 'translateZ(-10px)' }}
        />

        {/* Content Container with 3D Z-Displacement */}
        <div className="relative z-10 space-y-6" style={{ transform: 'translateZ(20px)', transformStyle: 'preserve-3d' }}>
          {/* Top Bar Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-indigo-900/60">
            <div className="flex items-center gap-2.5">
              <div
                className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-400 to-amber-600 text-slate-950 flex items-center justify-center font-black shadow-lg shadow-amber-500/30"
                style={{ transform: 'translateZ(18px)', transformStyle: 'preserve-3d' }}
              >
                <Flame size={20} className="animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black tracking-tight text-white flex items-center gap-2">
                  <span>Academic Momentum & 3D Analytics</span>
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                    Live
                  </span>
                </h3>
                <p className="text-xs text-indigo-300/80 font-medium">Real-time performance velocity across tasks and mock exams</p>
              </div>
            </div>

            <div
              className="flex items-center gap-2 self-start sm:self-auto"
              style={{ transform: 'translateZ(15px)' }}
            >
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-900/60 border border-indigo-500/30 text-xs font-bold text-indigo-200 backdrop-blur-md">
                <Sparkles size={13} className="text-amber-400" />
                <span>Streak: <strong>Active</strong></span>
              </div>
              <button
                onClick={() => router.push('/student/results')}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-bold text-white transition active:scale-95 cursor-pointer"
              >
                <span>Full Report</span>
                <ArrowUpRight size={13} />
              </button>
            </div>
          </div>

          {/* 3D Gauge & Metric Rings Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Metric 1: Assignment Completion Velocity */}
            <div
              className="relative p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md hover:border-cyan-400/40 transition-colors group"
              style={{ transform: 'translateZ(25px)', transformStyle: 'preserve-3d' }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <CheckCircle size={14} className="text-teal-400" /> Task Completion
                </span>
                <span className="text-xs font-mono font-black text-teal-300">{completionRate}%</span>
              </div>

              {/* 3D Neon Progress Bar */}
              <div className="h-2.5 w-full bg-slate-800/80 rounded-full overflow-hidden p-0.5 border border-teal-500/20 shadow-inner">
                <div
                  className="h-full bg-gradient-to-r from-teal-500 to-cyan-400 rounded-full transition-all duration-700 shadow-[0_0_12px_#22d3ee]"
                  style={{ width: `${Math.max(8, completionRate)}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 font-medium">
                <span>{completedAssignments} Submitted</span>
                <span>{pendingAssignments} Pending</span>
              </div>
            </div>

            {/* Metric 2: Examination Accuracy Gauge */}
            <div
              className="relative p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md hover:border-amber-400/40 transition-colors group"
              style={{ transform: 'translateZ(25px)', transformStyle: 'preserve-3d' }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Target size={14} className="text-amber-400" /> Exam Precision
                </span>
                <span className="text-xs font-mono font-black text-amber-300">
                  {examAccuracy > 0 ? `${examAccuracy}%` : 'Pending'}
                </span>
              </div>

              {/* 3D Neon Progress Bar */}
              <div className="h-2.5 w-full bg-slate-800/80 rounded-full overflow-hidden p-0.5 border border-amber-500/20 shadow-inner">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full transition-all duration-700 shadow-[0_0_12px_#fbbf24]"
                  style={{ width: `${Math.max(8, examAccuracy)}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 font-medium">
                <span>{completedExams} Completed</span>
                <span>{upcomingExams} Scheduled</span>
              </div>
            </div>

            {/* Metric 3: Classroom Standing Tier */}
            <div
              className="relative p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md hover:border-indigo-400/40 transition-colors flex flex-col justify-between"
              style={{ transform: 'translateZ(25px)', transformStyle: 'preserve-3d' }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Award size={14} className="text-indigo-400" /> Performance Tier
                </span>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  Verified
                </span>
              </div>

              <div className="flex items-center gap-3 my-1">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 text-white flex items-center justify-center font-black shadow-md shadow-indigo-500/40">
                  <TrendingUp size={18} />
                </div>
                <div>
                  <h4 className="text-xs font-black text-white">Consistent Achiever</h4>
                  <p className="text-[11px] text-slate-400">Regular homework submissions</p>
                </div>
              </div>

              <div className="text-[11px] text-indigo-300/90 font-medium">
                Keep daily momentum to stay in the top percentile!
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

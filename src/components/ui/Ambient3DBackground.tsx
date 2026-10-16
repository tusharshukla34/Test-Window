'use client';

import React from 'react';

export default function Ambient3DBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none">
      {/* 3D Floating Orb 1: Cyan Orbit */}
      <div
        className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-cyan-400/10 blur-[100px]"
        style={{
          animation: 'drift3DOne 24s ease-in-out infinite alternate'
        }}
      />

      {/* 3D Floating Orb 2: Teal / Emerald Orbit */}
      <div
        className="absolute top-1/3 -right-40 w-[30rem] h-[30rem] rounded-full bg-teal-400/10 blur-[120px]"
        style={{
          animation: 'drift3DTwo 28s ease-in-out infinite alternate'
        }}
      />

      {/* 3D Floating Orb 3: Violet / Indigo Deep Aura */}
      <div
        className="absolute -bottom-32 left-1/4 w-[28rem] h-[28rem] rounded-full bg-indigo-500/10 blur-[110px]"
        style={{
          animation: 'drift3DThree 32s ease-in-out infinite alternate'
        }}
      />

      <style jsx>{`
        @keyframes drift3DOne {
          0% {
            transform: translate3d(0px, 0px, 0px) scale(1);
          }
          50% {
            transform: translate3d(80px, 120px, 40px) scale(1.15);
          }
          100% {
            transform: translate3d(40px, 60px, -20px) scale(0.95);
          }
        }
        @keyframes drift3DTwo {
          0% {
            transform: translate3d(0px, 0px, 0px) scale(1);
          }
          50% {
            transform: translate3d(-100px, 140px, 50px) scale(1.2);
          }
          100% {
            transform: translate3d(-50px, 80px, -30px) scale(0.9);
          }
        }
        @keyframes drift3DThree {
          0% {
            transform: translate3d(0px, 0px, 0px) scale(1);
          }
          50% {
            transform: translate3d(90px, -100px, 60px) scale(1.1);
          }
          100% {
            transform: translate3d(-40px, -60px, -40px) scale(1);
          }
        }
      `}</style>
    </div>
  );
}

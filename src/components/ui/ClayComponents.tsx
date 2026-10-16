'use client';

import React from 'react';

interface ClayCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: 'white' | 'purple' | 'teal' | 'amber' | 'blue';
  interactive?: boolean;
}

export function ClayCard({
  children,
  variant = 'white',
  interactive = false,
  className = '',
  ...props
}: ClayCardProps) {
  let variantClass = 'clay-card-static';
  if (interactive) variantClass = 'clay-card';

  if (variant === 'purple') variantClass = 'clay-card-pastel-purple';
  else if (variant === 'teal') variantClass = 'clay-card-pastel-teal';
  else if (variant === 'amber') variantClass = 'clay-card-pastel-amber';
  else if (variant === 'blue') variantClass = 'clay-card-pastel-blue';

  return (
    <div className={`${variantClass} p-5 ${className}`} {...props}>
      {children}
    </div>
  );
}

export interface ClayCard3DProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: 'white' | 'purple' | 'teal' | 'amber' | 'blue';
  className?: string;
  maxTilt?: number;
  glare?: boolean;
  glareVariant?: 'white' | 'holographic' | 'cyan' | 'amber' | 'purple';
  animatedFloat?: boolean;
}

export function ClayCard3D({
  children,
  variant = 'white',
  className = '',
  maxTilt = 12,
  glare = true,
  glareVariant = 'white',
  animatedFloat = false,
  onClick,
  ...props
}: ClayCard3DProps) {
  const cardRef = React.useRef<HTMLDivElement>(null);
  const [glarePos, setGlarePos] = React.useState<{ x: number; y: number; opacity: number }>({ x: 50, y: 50, opacity: 0 });
  const [transform, setTransform] = React.useState<string>('perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0px)');
  const [dynamicShadow, setDynamicShadow] = React.useState<string>('');
  const [isHovered, setIsHovered] = React.useState(false);

  let variantClass = 'clay-card';
  if (variant === 'purple') variantClass = 'clay-card-pastel-purple';
  else if (variant === 'teal') variantClass = 'clay-card-pastel-teal';
  else if (variant === 'amber') variantClass = 'clay-card-pastel-amber';
  else if (variant === 'blue') variantClass = 'clay-card-pastel-blue';

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotX = -((y - centerY) / centerY) * maxTilt;
    const rotY = ((x - centerX) / centerX) * maxTilt;

    setTransform(`perspective(1000px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg) translateZ(16px) scale3d(1.03, 1.03, 1.03)`);

    const shadowX = (-rotY * 1.5).toFixed(1);
    const shadowY = (rotX * 1.5 + 18).toFixed(1);
    setDynamicShadow(`${shadowX}px ${shadowY}px 32px rgba(15, 23, 42, 0.16), 0 4px 12px rgba(15, 23, 42, 0.08)`);

    setGlarePos({
      x: Math.round((x / rect.width) * 100),
      y: Math.round((y / rect.height) * 100),
      opacity: 0.45
    });
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setTransform('perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0px) scale3d(1, 1, 1)');
    setDynamicShadow('');
    setGlarePos(prev => ({ ...prev, opacity: 0 }));
  };

  let glareGradient = `radial-gradient(circle at ${glarePos.x}% ${glarePos.y}%, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0) 65%)`;
  if (glareVariant === 'holographic') {
    glareGradient = `radial-gradient(circle at ${glarePos.x}% ${glarePos.y}%, rgba(34,211,238,0.5) 0%, rgba(168,85,247,0.3) 35%, rgba(255,255,255,0) 70%)`;
  } else if (glareVariant === 'cyan') {
    glareGradient = `radial-gradient(circle at ${glarePos.x}% ${glarePos.y}%, rgba(34,211,238,0.6) 0%, rgba(45,212,191,0.2) 40%, rgba(255,255,255,0) 70%)`;
  } else if (glareVariant === 'amber') {
    glareGradient = `radial-gradient(circle at ${glarePos.x}% ${glarePos.y}%, rgba(251,191,36,0.6) 0%, rgba(245,158,11,0.2) 40%, rgba(255,255,255,0) 70%)`;
  } else if (glareVariant === 'purple') {
    glareGradient = `radial-gradient(circle at ${glarePos.x}% ${glarePos.y}%, rgba(168,85,247,0.6) 0%, rgba(139,92,246,0.2) 40%, rgba(255,255,255,0) 70%)`;
  }

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      style={{
        transform,
        transformStyle: 'preserve-3d',
        transition: isHovered ? 'transform 0.08s ease-out' : 'transform 0.45s cubic-bezier(0.2, 0.8, 0.2, 1)',
        willChange: 'transform',
        boxShadow: dynamicShadow || undefined
      }}
      className={`${variantClass} p-5 relative overflow-hidden select-none transition-all ${animatedFloat && !isHovered ? 'motion-safe:animate-pulse' : ''} ${onClick ? 'cursor-pointer' : ''} ${className}`}
      {...props}
    >
      {glare && (
        <div
          className="pointer-events-none absolute inset-0 z-20 transition-opacity duration-300"
          style={{
            opacity: glarePos.opacity,
            background: glareGradient
          }}
        />
      )}
      <div style={{ transform: 'translateZ(20px)', transformStyle: 'preserve-3d' }} className="relative z-10">
        {children}
      </div>
    </div>
  );
}

interface ClayButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'teal' | 'outline';
  size?: 'sm' | 'md' | 'lg';
}

export function ClayButton({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled,
  ...props
}: ClayButtonProps) {
  let baseColor = 'bg-blue-600 text-white hover:bg-blue-700';
  if (variant === 'secondary') {
    baseColor = 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200';
  } else if (variant === 'teal') {
    baseColor = 'bg-[#00bcd4] text-white hover:bg-[#00acc1]';
  } else if (variant === 'danger') {
    baseColor = 'bg-rose-500 text-white hover:bg-rose-600';
  } else if (variant === 'outline') {
    baseColor = 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50';
  }

  let sizeClass = 'px-4 py-2 text-sm';
  if (size === 'sm') sizeClass = 'px-3 py-1.5 text-xs';
  if (size === 'lg') sizeClass = 'px-6 py-3 text-base font-semibold';

  return (
    <button
      className={`clay-btn font-medium inline-flex items-center justify-center gap-2 transition-all ${baseColor} ${sizeClass} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
}

export function Modal({ isOpen, onClose, title, children, maxWidth = 'max-w-2xl' }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs transition-opacity animate-in fade-in">
      <div className={`bg-white rounded-2xl shadow-2xl border border-slate-200 w-full ${maxWidth} max-h-[90vh] flex flex-col overflow-hidden`}>
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100">
          <h3 className="text-base sm:text-lg font-bold text-slate-800 truncate pr-2">{title}</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 rounded-lg p-1.5 transition text-sm font-bold shrink-0"
          >
            ✕
          </button>
        </div>
        <div className="p-4 sm:p-6 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}

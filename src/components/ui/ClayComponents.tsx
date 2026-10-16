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
}

export function ClayCard3D({
  children,
  variant = 'white',
  className = '',
  maxTilt = 8,
  glare = true,
  onClick,
  ...props
}: ClayCard3DProps) {
  const cardRef = React.useRef<HTMLDivElement>(null);
  const [glarePos, setGlarePos] = React.useState<{ x: number; y: number; opacity: number }>({ x: 50, y: 50, opacity: 0 });
  const [transform, setTransform] = React.useState<string>('perspective(800px) rotateX(0deg) rotateY(0deg) translateZ(0px)');
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

    setTransform(`perspective(900px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg) translateZ(12px) scale3d(1.025, 1.025, 1.025)`);
    setGlarePos({
      x: Math.round((x / rect.width) * 100),
      y: Math.round((y / rect.height) * 100),
      opacity: 0.35
    });
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setTransform('perspective(900px) rotateX(0deg) rotateY(0deg) translateZ(0px) scale3d(1, 1, 1)');
    setGlarePos(prev => ({ ...prev, opacity: 0 }));
  };

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
        transition: isHovered ? 'transform 0.08s ease-out' : 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)',
        willChange: 'transform'
      }}
      className={`${variantClass} p-5 relative overflow-hidden select-none transition-shadow ${onClick ? 'cursor-pointer' : ''} ${className}`}
      {...props}
    >
      {glare && (
        <div
          className="pointer-events-none absolute inset-0 z-20 transition-opacity duration-300"
          style={{
            opacity: glarePos.opacity,
            background: `radial-gradient(circle at ${glarePos.x}% ${glarePos.y}%, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0) 65%)`
          }}
        />
      )}
      <div style={{ transform: 'translateZ(18px)', transformStyle: 'preserve-3d' }}>
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

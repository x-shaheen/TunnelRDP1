import React from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost';
type Size = 'sm' | 'default' | 'lg';

interface ProfessionalButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: React.ReactNode;
  className?: string;
}

const variantClasses: Record<Variant, string> = {
  primary: `
    bg-gradient-to-r from-blue-600 to-blue-700 
    hover:from-blue-700 hover:to-blue-800 
    text-white border border-blue-500/50
    shadow-lg hover:shadow-blue-500/25
    hover:shadow-xl transition-all duration-300
  `,
  secondary: `
    bg-gradient-to-r from-gray-700 to-gray-800 
    hover:from-gray-600 hover:to-gray-700 
    text-white border border-gray-600/50
    shadow-lg hover:shadow-gray-500/25
    hover:shadow-xl transition-all duration-300
  `,
  outline: `
    border border-white/20 hover:border-white/40 
    bg-transparent hover:bg-white/5 
    text-white hover:text-white
    transition-all duration-300
  `,
  ghost: `
    bg-transparent hover:bg-white/10 
    text-white/80 hover:text-white
    transition-all duration-300
  `,
};

const sizeClasses: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs',
  default: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

export const ProfessionalButton: React.FC<ProfessionalButtonProps> = ({
  variant = 'primary',
  size = 'default',
  children,
  className = '',
  disabled,
  ...props
}) => {
  return (
    <button
      className={cn(
        'relative inline-flex items-center justify-center rounded-lg font-medium',
        'focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-2 focus:ring-offset-black',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none',
        'transform hover:scale-105 active:scale-95 transition-all duration-200',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      disabled={disabled}
      {...props}
    >
      {/* Subtle glow effect for primary buttons */}
      {variant === 'primary' && (
        <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-blue-600/20 to-blue-700/20 blur-lg -z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      )}
      
      {children}
    </button>
  );
};

export default ProfessionalButton;

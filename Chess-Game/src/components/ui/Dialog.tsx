import type { ReactNode } from 'react';
import { X } from 'lucide-react';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

export function Dialog({ open, onClose, title, children, className = '' }: DialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog content */}
      <div
        className={`
          relative z-10 bg-surface border border-line rounded-xl
          shadow-2xl shadow-black/50
          max-w-lg w-full mx-4
          animate-in fade-in zoom-in-95 duration-200
          ${className}
        `}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-line">
            <h2 className="text-lg font-semibold text-text">{title}</h2>
            <button
              onClick={onClose}
              className="p-1 rounded-md text-text-muted hover:text-text hover:bg-surface-raised transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        )}

        {/* Body */}
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
}

interface ProgressProps {
  value: number;
  max?: number;
  className?: string;
}

export function Progress({ value, max = 100, className = '' }: ProgressProps) {
  const percentage = (value / max) * 100;

  return (
    <div className={`h-2 bg-surface-raised rounded-full overflow-hidden ${className}`}>
      <div
        className="h-full bg-card-gold rounded-full transition-all duration-300"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'gold' | 'silver' | 'green' | 'blue' | 'bronze' | 'purple' | 'danger';
  className?: string;
}

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  const variantStyles = {
    default: 'bg-surface-raised text-text',
    gold: 'bg-card-gold/20 text-card-gold border border-card-gold/30',
    silver: 'bg-card-silver/20 text-card-silver border border-card-silver/30',
    green: 'bg-card-green/20 text-card-green border border-card-green/30',
    blue: 'bg-card-blue/20 text-card-blue border border-card-blue/30',
    bronze: 'bg-card-bronze/20 text-card-bronze border border-card-bronze/30',
    purple: 'bg-card-purple/20 text-card-purple border border-card-purple/30',
    danger: 'bg-danger/20 text-danger border border-danger/30',
  };

  return (
    <span
      className={`
        inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium
        ${variantStyles[variant]}
        ${className}
      `}
    >
      {children}
    </span>
  );
}

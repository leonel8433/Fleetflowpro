
import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const Logo: React.FC<LogoProps> = ({ className = '', size = 'md' }) => {
  const sizeClasses = {
    sm: { text: 'text-lg', square: 'w-2 h-2', gap: 'gap-0.5' },
    md: { text: 'text-2xl', square: 'w-3 h-3', gap: 'gap-1' },
    lg: { text: 'text-4xl', square: 'w-5 h-5', gap: 'gap-1.5' }
  };

  const currentSize = sizeClasses[size];

  return (
    <div className={`flex flex-col items-center select-none ${className}`}>
      <div className="flex items-start">
        {/* Row 1: "Help" + 2 Squares */}
        <span className={`${currentSize.text} font-write text-slate-700 tracking-tighter mr-2`}>
          Help
        </span>
        <div className={`flex ${currentSize.gap} mt-1.5`}>
          <div className={`${currentSize.square} bg-blue-400 rounded-sm shadow-sm`}></div>
          <div className={`${currentSize.square} bg-blue-900 rounded-sm shadow-sm`}></div>
        </div>
      </div>
      <div className="flex items-end -mt-1 ml-10">
        {/* Row 2: 2 Squares + "System" */}
        <div className={`flex ${currentSize.gap} mb-1.5 mr-2`}>
          <div className={`${currentSize.square} bg-blue-900 rounded-sm shadow-sm`}></div>
          <div className={`${currentSize.square} bg-blue-400 rounded-sm shadow-sm`}></div>
        </div>
        <span className={`${currentSize.text} font-write text-slate-700 tracking-tighter`}>
          System
        </span>
      </div>
    </div>
  );
};

export default Logo;

import React from 'react';
import { cn } from '@/lib/utils';

interface LoadingTerminalProps {
  text?: string;
  className?: string;
  isVisible?: boolean;
}

export const LoadingTerminal: React.FC<LoadingTerminalProps> = ({ 
  text = "Deploying...", 
  className = "",
  isVisible = true 
}) => {
  if (!isVisible) return null;

  return (
    <div className={cn(
      "fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4",
      className
    )}>
      <div className="bg-black border border-green-400/30 rounded-lg shadow-2xl w-full max-w-md">
        {/* Terminal Header */}
        <div className="flex items-center justify-between bg-gray-900 px-4 py-2 rounded-t-lg border-b border-green-400/20">
          <div className="flex items-center space-x-2">
            <div className="flex space-x-1">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
            </div>
            <span className="text-green-400 text-sm font-mono">Terminal</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
            <span className="text-green-400 text-xs">ACTIVE</span>
          </div>
        </div>

        {/* Terminal Content */}
        <div className="p-6 font-mono text-sm">
          <div className="space-y-2 mb-4">
            <div className="text-green-400">
              <span className="text-blue-400">user@rdp-automation:~$</span> {text}
            </div>
            <div className="text-gray-400">
              Initializing deployment sequence...
            </div>
            <div className="text-gray-400">
              Connecting to cloud infrastructure...
            </div>
            <div className="text-gray-400">
              Setting up secure tunnel...
            </div>
          </div>

          {/* Loading Animation */}
          <div className="flex items-center space-x-2">
            <span className="text-green-400">Processing</span>
            <div className="flex space-x-1">
              <div className="w-1 h-1 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-1 h-1 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-1 h-1 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>

          {/* Cursor */}
          <div className="flex items-center mt-4">
            <span className="text-blue-400">user@rdp-automation:~$</span>
            <span className="ml-1 w-2 h-4 bg-green-400 animate-pulse"></span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingTerminal;

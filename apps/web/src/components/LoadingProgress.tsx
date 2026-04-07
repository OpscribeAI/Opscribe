import { useEffect, useState } from "react";
import { Zap, Loader2 } from "lucide-react";

interface LoadingProgressProps {
  isVisible: boolean;
  graphName: string;
}

export default function LoadingProgress({ isVisible, graphName }: LoadingProgressProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (isVisible) {
      setProgress(5);
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 95) return 95; // Stall at 95 until finished
          return prev + Math.random() * 2;
        });
      }, 500);
      return () => clearInterval(interval);
    } else {
      setProgress(0);
    }
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 w-full z-[100] bg-[#020617]/90 backdrop-blur-xl border-t border-blue-500/20 shadow-[0_-10px_40px_rgba(59,130,246,0.15)] animate-in slide-in-from-bottom-full duration-500">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-8">
        <div className="flex items-center gap-4 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 flex items-center justify-center relative overflow-hidden group">
            <Zap className="w-5 h-5 text-blue-400 relative z-10 animate-pulse" />
            <div className="absolute inset-0 bg-blue-500/20 blur-xl opacity-50 group-hover:opacity-100 transition-opacity" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
              Ingesting Infrastructure: <span className="text-blue-400">"{graphName}"</span>
            </h4>
            <div className="flex items-center gap-2 mt-1">
                <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />
                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Discovering resources & building map...</p>
            </div>
          </div>
        </div>

        <div className="flex-1 max-w-2xl relative">
          <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
             {/* The progress bar itself */}
             <div 
               className="h-full bg-gradient-to-r from-blue-600 via-blue-400 to-indigo-500 transition-all duration-1000 ease-out relative"
               style={{ width: `${progress}%` }}
             >
                {/* Shimmer effect */}
                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full animate-shimmer" />
             </div>
          </div>
          <div className="absolute -bottom-5 right-0">
             <span className="text-[10px] font-mono text-blue-500 font-bold">{Math.round(progress)}%</span>
          </div>
        </div>
      </div>
      
      {/* CSS for Shimmer Animation */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite linear;
        }
      `}</style>
    </div>
  );
}

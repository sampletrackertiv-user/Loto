import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Volume2, Share2, Mic } from 'lucide-react';
import { generateLotoRhyme } from '../services/geminiService';
import { Language } from '../types';

interface GameHostProps {
  onExit: () => void;
  lang: Language;
}

export const GameHost: React.FC<GameHostProps> = ({ onExit, lang }) => {
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [currentNumber, setCurrentNumber] = useState<number | null>(null);
  const [currentRhyme, setCurrentRhyme] = useState<string>('');
  const [isAuto, setIsAuto] = useState(false);
  const [speed, setSpeed] = useState(6000);
  const [flash, setFlash] = useState(false); // Visual effect for new number

  // Use refs for interval management to avoid closure staleness
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const numbersRef = useRef<number[]>([]); // To track available numbers synchronously

  useEffect(() => {
    // Initial rhyme welcome
    setCurrentRhyme(lang === 'vi' ? "Mời bà con cô bác cùng tham gia..." : "Welcome everyone, get your tickets ready...");
    return () => stopAuto();
  }, [lang]);

  const drawNumber = async () => {
    const allNumbers = Array.from({ length: 90 }, (_, i) => i + 1);
    const available = allNumbers.filter(n => !calledNumbers.includes(n));

    if (available.length === 0) {
      stopAuto();
      setCurrentRhyme(lang === 'vi' ? "Hết số rồi! Kiểm tra vé nào!" : "All numbers called! Check for Bingo!");
      return;
    }

    const nextNum = available[Math.floor(Math.random() * available.length)];
    
    // Optimistic UI update
    setFlash(true);
    setCurrentNumber(nextNum);
    setCalledNumbers(prev => [...prev, nextNum]);
    setTimeout(() => setFlash(false), 500);

    // Fetch Rhyme
    const rhyme = await generateLotoRhyme(nextNum, lang);
    setCurrentRhyme(rhyme);
  };

  const startAuto = () => {
    if (isAuto) return;
    setIsAuto(true);
    drawNumber(); // Draw immediately
    timerRef.current = setInterval(drawNumber, speed);
  };

  const stopAuto = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsAuto(false);
  };

  const toggleAuto = () => {
    if (isAuto) stopAuto();
    else startAuto();
  };

  const resetGame = () => {
    stopAuto();
    setCalledNumbers([]);
    setCurrentNumber(null);
    setCurrentRhyme(lang === 'vi' ? "Bắt đầu ván mới nào!" : "New game starting!");
  };

  return (
    <div className="flex flex-col h-screen max-h-screen">
      {/* Header */}
      <header className="p-4 bg-slate-900 border-b border-slate-700 flex justify-between items-center shrink-0">
        <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-red-500">
          Loto Master <span className="text-xs text-slate-400 font-normal border border-slate-600 px-2 py-0.5 rounded ml-2">HOST MODE</span>
        </h1>
        <div className="flex gap-2">
           <button onClick={resetGame} className="p-2 hover:bg-slate-800 rounded text-slate-300" title="Reset">
            <RotateCcw size={20} />
          </button>
          <button onClick={onExit} className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-sm rounded border border-slate-600">
            Exit
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden flex flex-col md:flex-row">
        {/* Left Panel: The Stage */}
        <section className="flex-1 p-6 flex flex-col items-center justify-center relative bg-slate-900">
           {/* Background effects */}
           <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-900/20 via-slate-900 to-slate-900 z-0"></div>

           <div className="z-10 w-full max-w-md text-center space-y-8">
              {/* Current Number Ball */}
              <div className="relative group cursor-pointer" onClick={isAuto ? stopAuto : drawNumber}>
                 <div className={`
                    w-48 h-48 mx-auto rounded-full 
                    bg-gradient-to-br from-red-500 via-pink-600 to-purple-700
                    flex items-center justify-center shadow-[0_0_50px_rgba(236,72,153,0.5)]
                    border-8 border-white/10 relative
                    transition-transform duration-300
                    ${flash ? 'scale-110 brightness-110' : 'scale-100'}
                 `}>
                    {currentNumber ? (
                      <span className="text-8xl font-black text-white drop-shadow-lg ball-animation">
                        {currentNumber}
                      </span>
                    ) : (
                      <span className="text-2xl font-bold text-white/50 uppercase tracking-widest">
                        Ready
                      </span>
                    )}
                    
                    {/* Shine effect */}
                    <div className="absolute top-4 left-8 w-12 h-8 bg-white/20 rounded-full rotate-[-45deg] blur-sm"></div>
                 </div>
              </div>

              {/* Rhyme Display */}
              <div className="glass-panel p-6 rounded-2xl min-h-[120px] flex items-center justify-center flex-col">
                 <div className="flex items-center gap-2 mb-2 text-indigo-400 text-sm font-semibold uppercase tracking-wider">
                    <Mic size={14} />
                    {lang === 'vi' ? 'MC AI đang hô:' : 'AI Caller:'}
                 </div>
                 <p className="text-xl md:text-2xl text-white font-medium italic leading-relaxed animate-pulse">
                   "{currentRhyme}"
                 </p>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-center gap-6">
                <button 
                  onClick={toggleAuto}
                  className={`flex items-center gap-2 px-8 py-4 rounded-full font-bold text-lg shadow-lg transition-all transform hover:scale-105 ${isAuto ? 'bg-red-500/20 text-red-400 border border-red-500/50' : 'bg-green-600 text-white hover:bg-green-500'}`}
                >
                  {isAuto ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}
                  {isAuto ? (lang === 'vi' ? 'Dừng lại' : 'Stop') : (lang === 'vi' ? 'Quay Số' : 'Draw')}
                </button>
                
                <div className="flex flex-col items-center">
                    <label className="text-xs text-slate-500 mb-1">Speed</label>
                    <input 
                      type="range" 
                      min="2000" 
                      max="10000" 
                      step="500"
                      value={speed}
                      onChange={(e) => setSpeed(Number(e.target.value))}
                      className="w-24 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                    />
                </div>
              </div>
           </div>
        </section>

        {/* Right Panel: The Board History */}
        <section className="md:w-96 bg-slate-800 border-l border-slate-700 flex flex-col">
          <div className="p-4 border-b border-slate-700 font-semibold text-slate-300 flex justify-between">
            <span>Board ({calledNumbers.length}/90)</span>
            <button className="text-slate-500 hover:text-white"><Share2 size={18} /></button>
          </div>
          <div className="flex-1 p-2 overflow-y-auto">
             <div className="grid grid-cols-5 gap-2">
                {Array.from({ length: 90 }, (_, i) => i + 1).map((num) => {
                  const isCalled = calledNumbers.includes(num);
                  const isRecent = currentNumber === num;
                  return (
                    <div 
                      key={num}
                      className={`
                        aspect-square rounded-lg flex items-center justify-center text-sm font-bold
                        transition-all duration-500
                        ${isRecent ? 'bg-yellow-400 text-black scale-110 shadow-lg z-10' : ''}
                        ${!isRecent && isCalled ? 'bg-indigo-600 text-white' : ''}
                        ${!isCalled ? 'bg-slate-700/50 text-slate-500' : ''}
                      `}
                    >
                      {num}
                    </div>
                  );
                })}
             </div>
          </div>
        </section>
      </main>
    </div>
  );
};
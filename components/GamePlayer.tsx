import React, { useState, useEffect, useCallback } from 'react';
import { TicketData } from '../types';
import { TicketView } from './TicketView';
import { ChatOverlay } from './ChatOverlay';
import { Volume2, VolumeX, Trophy, AlertTriangle } from 'lucide-react';
import { generateLotoRhyme } from '../services/geminiService';

interface GamePlayerProps {
  onExit: () => void;
  lang: 'vi' | 'en';
}

// Generate a valid 9x3 Vietnamese Loto Ticket
// Rule: 9 columns. Row 1: 5 nums, Row 2: 5 nums, Row 3: 5 nums.
// Col 0: 1-9, Col 1: 10-19, ... Col 8: 80-90.
const generateTicket = (): TicketData => {
  const ticket: TicketData = Array(3).fill(null).map(() => Array(9).fill({ value: null, marked: false }));
  const colRanges = [
    { min: 1, max: 9 }, { min: 10, max: 19 }, { min: 20, max: 29 },
    { min: 30, max: 39 }, { min: 40, max: 49 }, { min: 50, max: 59 },
    { min: 60, max: 69 }, { min: 70, max: 79 }, { min: 80, max: 90 }
  ];

  // Logic to ensure 5 numbers per row and validity is complex. 
  // Simplified robust generation:
  // 1. Fill each column with some numbers.
  // 2. Redistribute to ensure 5 per row.
  // Simplified approximation for this demo:
  
  for (let r = 0; r < 3; r++) {
    // Pick 5 random columns for this row
    const availableCols = [0,1,2,3,4,5,6,7,8].sort(() => 0.5 - Math.random()).slice(0, 5);
    availableCols.forEach(c => {
      const range = colRanges[c];
      let num = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
      // Ensure unique in column across rows (simple check, good enough for demo)
      while (ticket[0][c].value === num || ticket[1][c].value === num) {
        num = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
      }
      ticket[r][c] = { value: num, marked: false };
    });
  }
  // Sort columns just in case
  for(let c=0; c<9; c++) {
      const numsInCol = [ticket[0][c].value, ticket[1][c].value, ticket[2][c].value].filter(n => n !== null) as number[];
      numsInCol.sort((a,b) => a-b);
      let idx = 0;
      for(let r=0; r<3; r++) {
          if(ticket[r][c].value !== null) {
              ticket[r][c] = { value: numsInCol[idx], marked: false };
              idx++;
          }
      }
  }

  return ticket;
};

export const GamePlayer: React.FC<GamePlayerProps> = ({ onExit, lang }) => {
  const [ticket, setTicket] = useState<TicketData>(generateTicket());
  const [history, setHistory] = useState<number[]>([]);
  const [currentCall, setCurrentCall] = useState<number | null>(null);
  const [currentRhyme, setCurrentRhyme] = useState<string>('');
  const [muted, setMuted] = useState(false);
  const [bingoStatus, setBingoStatus] = useState<'none' | 'check' | 'win'>('none');
  
  // Simulation of "Live" host calling numbers
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    
    // Start delay
    const timeout = setTimeout(() => {
       interval = setInterval(async () => {
          // If already bingo, stop
          if (bingoStatus === 'win') return;

          const allNums = Array.from({ length: 90 }, (_, i) => i + 1);
          const available = allNums.filter(n => !history.includes(n));
          if (available.length === 0) return;

          // Pick random number not in history (local simulation of server)
          // In a real app, history would come from props/server
          // Here we create a local simulation sequence that persists
          let nextNum: number;
          
          // Cheat for demo: 10% chance to pick a number on the user's ticket if not marked
          // so the user can actually play
          const userUnmarked = ticket.flat().filter(c => c.value !== null && !c.marked).map(c => c.value as number);
          
          if (userUnmarked.length > 0 && Math.random() < 0.2) {
             nextNum = userUnmarked[Math.floor(Math.random() * userUnmarked.length)];
             // Ensure it hasn't been called (it shouldn't be if it's unmarked, but safety check)
             if(history.includes(nextNum)) nextNum = available[Math.floor(Math.random() * available.length)];
          } else {
             nextNum = available[Math.floor(Math.random() * available.length)];
          }

          setHistory(prev => {
              if (prev.includes(nextNum)) return prev;
              return [...prev, nextNum];
          });
          setCurrentCall(nextNum);
          
          // Get rhyme
          const rhyme = await generateLotoRhyme(nextNum, lang);
          setCurrentRhyme(rhyme);

       }, 5000); // New number every 5 seconds
    }, 2000);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [history, bingoStatus, lang, ticket]);

  // Handle cell click
  const handleCellClick = (r: number, c: number, val: number) => {
    // Only allow marking if the number has been called in history
    if (history.includes(val)) {
       const newTicket = [...ticket];
       newTicket[r] = [...newTicket[r]];
       newTicket[r][c] = { ...newTicket[r][c], marked: !newTicket[r][c].marked };
       setTicket(newTicket);
       checkWin(newTicket);
    } else {
        // Visual feedback for invalid click?
        alert(lang === 'vi' ? 'Số này chưa gọi nha!' : 'Number not called yet!');
    }
  };

  const checkWin = (currentTicket: TicketData) => {
    // Check Full House (all numbers marked) or Rows (traditional Loto often rewards full rows)
    // Let's assume Full Row win for this demo
    for (const row of currentTicket) {
      const numbersInRow = row.filter(cell => cell.value !== null);
      if (numbersInRow.length > 0 && numbersInRow.every(cell => cell.marked)) {
        setBingoStatus('win');
        setCurrentRhyme("KINH! KINH! KINH! BINGO!!!");
        return;
      }
    }
    // Check full house
    const allNumbers = currentTicket.flat().filter(c => c.value !== null);
    if (allNumbers.every(c => c.marked)) {
        setBingoStatus('win');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-900">
      {/* Navbar */}
      <nav className="p-3 bg-slate-800 border-b border-slate-700 flex justify-between items-center shadow-lg z-20">
         <div className="flex items-center gap-3">
            <div className="bg-red-600 text-white font-bold px-3 py-1 rounded text-sm uppercase tracking-wider animate-pulse">
                Live
            </div>
            <h1 className="text-white font-bold hidden sm:block">Phòng: Tết Sum Vầy (#882)</h1>
         </div>
         <div className="flex items-center gap-4">
             <div className="text-right hidden sm:block">
                <p className="text-xs text-slate-400">Giải thưởng / Jackpot</p>
                <p className="text-yellow-400 font-bold">5,000,000 VNĐ</p>
             </div>
             <button onClick={() => setMuted(!muted)} className="p-2 text-slate-400 hover:text-white rounded-full bg-slate-700">
                 {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
             </button>
             <button onClick={onExit} className="text-sm text-slate-400 hover:text-white underline">Exit</button>
         </div>
      </nav>

      <div className="flex-1 overflow-hidden flex flex-col md:flex-row relative">
         {/* Confetti / Win Overlay */}
         {bingoStatus === 'win' && (
            <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center flex-col p-4">
                <Trophy size={80} className="text-yellow-400 mb-4 animate-bounce" />
                <h2 className="text-4xl md:text-6xl font-black text-white text-center mb-4 text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-red-500 to-pink-500">
                    BINGO! CHIẾN THẮNG!
                </h2>
                <p className="text-white text-xl mb-8">Bạn đã thắng giải nhất!</p>
                <button onClick={onExit} className="bg-white text-red-600 px-8 py-3 rounded-full font-bold hover:bg-gray-100">
                    Nhận Thưởng & Thoát
                </button>
            </div>
         )}

         {/* Left: Game Area */}
         <div className="flex-1 p-4 overflow-y-auto flex flex-col items-center gap-6">
            
            {/* Current Call Display */}
            <div className="w-full max-w-2xl bg-gradient-to-r from-indigo-900 to-slate-900 rounded-2xl p-6 shadow-2xl border border-slate-700 flex items-center gap-6 relative overflow-hidden">
                <div className="absolute -right-10 -top-10 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl"></div>
                
                <div className="relative shrink-0">
                    <div className="w-24 h-24 rounded-full bg-red-600 flex items-center justify-center border-4 border-yellow-400 shadow-lg">
                        <span className="text-4xl font-black text-white">
                            {currentCall || '--'}
                        </span>
                    </div>
                </div>
                
                <div className="flex-1 z-10">
                    <p className="text-indigo-300 text-xs font-bold uppercase tracking-widest mb-1">
                        {lang === 'vi' ? 'MC đang hô:' : 'Caller says:'}
                    </p>
                    <p className="text-white text-lg sm:text-xl font-medium italic">
                        "{currentRhyme || (lang === 'vi' ? 'Đang chờ số...' : 'Waiting for number...')}"
                    </p>
                </div>
            </div>

            {/* The Ticket */}
            <div className="w-full">
                <TicketView 
                    ticket={ticket} 
                    interactive={true} 
                    onCellClick={handleCellClick}
                />
            </div>

            {/* Recent History (Horizontal Scroll) */}
            <div className="w-full max-w-2xl">
                <p className="text-slate-400 text-xs mb-2 uppercase font-bold">Lịch sử / History</p>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide mask-fade-right">
                    {history.slice().reverse().map((num, i) => (
                        <div key={i} className={`
                            w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm font-bold border
                            ${i === 0 ? 'bg-yellow-400 border-yellow-200 text-black scale-110' : 'bg-slate-800 border-slate-600 text-slate-400'}
                        `}>
                            {num}
                        </div>
                    ))}
                </div>
            </div>
         </div>

         {/* Right: Chat */}
         <div className="h-64 md:h-full md:w-80 p-2 shrink-0">
             <ChatOverlay gameHistory={history} playerName="Me" />
         </div>
      </div>
    </div>
  );
};
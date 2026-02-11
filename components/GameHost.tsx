import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Volume2, Share2, Mic, Copy, Users } from 'lucide-react';
import { generateLotoRhyme } from '../services/geminiService';
import { Language, NetworkPayload, ChatMessage } from '../types';
import Peer, { DataConnection } from 'peerjs';

interface GameHostProps {
  onExit: () => void;
  lang: Language;
}

export const GameHost: React.FC<GameHostProps> = ({ onExit, lang }) => {
  // Game State
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [currentNumber, setCurrentNumber] = useState<number | null>(null);
  const [currentRhyme, setCurrentRhyme] = useState<string>('');
  const [isAuto, setIsAuto] = useState(false);
  const [speed, setSpeed] = useState(6000);
  const [flash, setFlash] = useState(false);
  
  // Network State
  const [peerId, setPeerId] = useState<string>('');
  const [connections, setConnections] = useState<DataConnection[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const peerRef = useRef<Peer | null>(null);

  // Refs for logic
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const connectionsRef = useRef<DataConnection[]>([]); // Synced ref for callbacks

  // Initialize PeerJS (Host)
  useEffect(() => {
    // Generate a shorter, friendlier ID if possible, but standard peerjs IDs are UUIDs.
    // We will let PeerJS assign one for reliability.
    const peer = new Peer();
    peerRef.current = peer;

    peer.on('open', (id) => {
      setPeerId(id);
      setCurrentRhyme(lang === 'vi' ? "Phòng đã sẵn sàng! Mời mọi người vào." : "Room Ready! Waiting for players.");
    });

    peer.on('connection', (conn) => {
      conn.on('open', () => {
        connectionsRef.current.push(conn);
        setConnections([...connectionsRef.current]);
        
        // Send initial sync to new player
        const syncData: NetworkPayload = {
          type: 'SYNC_STATE',
          payload: {
             history: calledNumbers, // Need to access current state, might need ref if using inside closure
             currentNumber,
             currentRhyme
          }
        };
        // We need to send the LATEST state. 
        // Since this callback is a closure, we might miss state updates.
        // For simplicity in this demo, the Player requests sync or we trigger it later.
        // Better: Just send what we know immediately, but React state might be stale here.
        // Let's rely on the next broadcast or send a quick "Welcome"
        
        broadcast({
            type: 'CHAT_MESSAGE',
            payload: {
                id: Date.now().toString(),
                sender: 'System',
                text: 'New player joined!',
                isSystem: true
            }
        });
      });

      conn.on('data', (data: any) => {
        const action = data as NetworkPayload;
        if (action.type === 'CHAT_MESSAGE') {
            const msg = action.payload as ChatMessage;
            setMessages(prev => [...prev, msg]);
            // Re-broadcast chat to everyone else
            broadcast(action);
        }
      });

      conn.on('close', () => {
         connectionsRef.current = connectionsRef.current.filter(c => c !== conn);
         setConnections([...connectionsRef.current]);
      });
    });

    return () => {
      peer.destroy();
    };
  }, []);

  // Ensure state is synced when a player connects (using a side effect for simplicity)
  useEffect(() => {
      if (connections.length > 0) {
        // Send Sync to everyone to be safe, or just newest.
        // This is a bit spammy but ensures consistency.
        const syncData: NetworkPayload = {
            type: 'SYNC_STATE',
            payload: {
                history: calledNumbers,
                currentNumber,
                currentRhyme
            }
        };
        broadcast(syncData);
      }
  }, [connections.length]); // Only when connection count changes

  const broadcast = (data: NetworkPayload) => {
    connectionsRef.current.forEach(conn => {
        if (conn.open) conn.send(data);
    });
    
    // Also update local state if it's chat
    if (data.type === 'CHAT_MESSAGE') {
        // Handled separately or checked here
    }
  };

  // Game Logic
  const drawNumber = async () => {
    const allNumbers = Array.from({ length: 90 }, (_, i) => i + 1);
    const available = allNumbers.filter(n => !calledNumbers.includes(n));

    if (available.length === 0) {
      stopAuto();
      const endMsg = lang === 'vi' ? "Hết số rồi!" : "Game Over!";
      setCurrentRhyme(endMsg);
      broadcast({ type: 'CALL_NUMBER', payload: { number: null, rhyme: endMsg, history: calledNumbers } });
      return;
    }

    const nextNum = available[Math.floor(Math.random() * available.length)];
    
    // Update Local
    setFlash(true);
    setCurrentNumber(nextNum);
    const newHistory = [...calledNumbers, nextNum];
    setCalledNumbers(newHistory);
    setTimeout(() => setFlash(false), 500);

    // AI Rhyme
    const rhyme = await generateLotoRhyme(nextNum, lang);
    setCurrentRhyme(rhyme);

    // Broadcast
    broadcast({
        type: 'CALL_NUMBER',
        payload: {
            number: nextNum,
            rhyme: rhyme,
            history: newHistory
        }
    });
  };

  const startAuto = () => {
    if (isAuto) return;
    setIsAuto(true);
    drawNumber();
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
    setCurrentRhyme(lang === 'vi' ? "Ván mới!" : "New Game!");
    setMessages([]);
    broadcast({ type: 'RESET_GAME', payload: {} });
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(peerId);
    alert('Room ID copied!');
  };

  return (
    <div className="flex flex-col h-screen max-h-screen">
      {/* Header */}
      <header className="p-4 bg-slate-900 border-b border-slate-700 flex justify-between items-center shrink-0">
        <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-red-500">
          Loto Master <span className="text-xs text-slate-400 font-normal border border-slate-600 px-2 py-0.5 rounded ml-2">HOST</span>
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
           {/* Room Info Overlay */}
           <div className="absolute top-4 left-4 bg-black/50 backdrop-blur px-4 py-2 rounded-lg border border-white/10 z-20">
              <div className="text-xs text-slate-400 uppercase font-bold mb-1">Room ID</div>
              <div className="flex items-center gap-2">
                  <code className="text-green-400 font-mono text-lg">{peerId || 'Connecting...'}</code>
                  <button onClick={copyToClipboard} className="text-white hover:text-green-300"><Copy size={16}/></button>
              </div>
              <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                 <Users size={12}/> {connections.length} players connected
              </div>
           </div>

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
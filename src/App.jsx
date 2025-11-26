import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX, Bell } from 'lucide-react';

const App = () => {
  // --- 狀態管理 ---
  const [active, setActive] = useState(false);
  const [cycleDuration, setCycleDuration] = useState(8); // 預設 8 秒
  const [muted, setMuted] = useState(false);
  
  // 視覺狀態
  const [scale, setScale] = useState(1); 
  const [phaseLabel, setPhaseLabel] = useState('Ready');

  // Refs
  const audioCtxRef = useRef(null);
  const masterGainRef = useRef(null);
  const animationFrameRef = useRef(null);
  const startTimeRef = useRef(null);
  const lastPhaseRef = useRef(null);

  // --- 1. 音訊引擎：Soft Bell (Medical Grade) ---
  const initAudio = useCallback(() => {
    if (!audioCtxRef.current) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioCtxRef.current = new AudioContext();
      
      masterGainRef.current = audioCtxRef.current.createGain();
      masterGainRef.current.connect(audioCtxRef.current.destination);
      masterGainRef.current.gain.value = 0.4; 
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  }, []);

  // 🔔 核心：Soft Bell 產生器
  const playSoftBell = useCallback(() => {
    if (muted || !audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const t = ctx.currentTime;

    const fundamental = ctx.createOscillator();
    const harmonic = ctx.createOscillator();
    
    const mainGain = ctx.createGain();
    const harmonicGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    const FREQ = 1000; 
    fundamental.type = 'sine';
    fundamental.frequency.value = FREQ;

    harmonic.type = 'triangle';
    harmonic.frequency.value = FREQ * 2;

    filter.type = 'lowpass';
    filter.frequency.value = 7000;
    filter.Q.value = 0.5;

    fundamental.connect(mainGain);
    harmonic.connect(harmonicGain);
    harmonicGain.connect(mainGain);
    mainGain.connect(filter);
    filter.connect(masterGainRef.current);

    harmonicGain.gain.value = 0.15; 

    mainGain.gain.setValueAtTime(0, t);
    mainGain.gain.linearRampToValueAtTime(0.8, t + 0.003);
    mainGain.gain.exponentialRampToValueAtTime(0.001, t + 0.113);

    fundamental.start(t);
    harmonic.start(t);
    
    fundamental.stop(t + 0.12);
    harmonic.stop(t + 0.12);

  }, [muted]);

  // --- 2. 動畫邏輯（重寫版本）---
  useEffect(() => {
    if (!active) {
      // 停止動畫
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      setScale(1);
      setPhaseLabel('Ready');
      startTimeRef.current = null;
      lastPhaseRef.current = null;
      return;
    }

    // 啟動動畫
    initAudio();
    startTimeRef.current = null;
    lastPhaseRef.current = null;

    const animate = (timestamp) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp;
      }
      
      const elapsed = (timestamp - startTimeRef.current) / 1000;
      const halfCycle = cycleDuration / 2;
      const cycleTime = elapsed % cycleDuration;
      
      const isInhale = cycleTime < halfCycle;
      const currentPhase = isInhale ? 'in' : 'out';

      // 計算進度
      let progress;
      if (isInhale) {
        progress = cycleTime / halfCycle;
      } else {
        progress = 1 - ((cycleTime - halfCycle) / halfCycle);
      }
      
      // 使用緩動函數
      const easedProgress = -(Math.cos(Math.PI * progress) - 1) / 2;
      
      // 更大的縮放範圍：從 0.7 到 1.5
      const newScale = 0.7 + easedProgress * 0.8;
      setScale(newScale);

      // 階段轉換
      if (currentPhase !== lastPhaseRef.current) {
        playSoftBell(); 
        setPhaseLabel(isInhale ? 'Inhale' : 'Exhale');
        
        if (navigator.vibrate) {
          navigator.vibrate(30);
        }
        
        lastPhaseRef.current = currentPhase;
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    // 清理函數
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [active, cycleDuration, playSoftBell, initAudio]);

  // --- 3. 控制邏輯 ---
  const toggleActive = () => {
    setActive(!active);
  };

  const handleCycleDurationChange = (e) => {
    setCycleDuration(Number(e.target.value));
    // 重置動畫起始時間
    startTimeRef.current = null;
  };

  return (
    <div className="flex flex-col items-center justify-between min-h-screen bg-slate-900 text-slate-100 font-sans overflow-hidden">
      
      {/* Header */}
      <header className="w-full p-8 flex justify-between items-center z-10">
        <div className="flex items-center gap-2">
          <Bell className="text-emerald-400 w-5 h-5" />
          <h1 className="text-xl font-light tracking-widest text-emerald-400/90">
            Reso-Calm
          </h1>
        </div>
        <button 
          onClick={() => setMuted(!muted)} 
          className="text-slate-500 hover:text-slate-300 transition-colors p-2"
        >
          {muted ? <VolumeX size={24} /> : <Volume2 size={24} />}
        </button>
      </header>

      {/* Main Visual */}
      <main className="flex-1 flex flex-col items-center justify-center w-full">
        
        <div className="relative flex items-center justify-center w-80 h-80">
          {/* 參考線 */}
          <div className="absolute w-64 h-64 rounded-full border border-slate-700/40"></div>
          
          {/* 呼吸球 */}
          <div 
            className="w-40 h-40 rounded-full bg-gradient-to-b from-emerald-500/20 to-teal-600/20 backdrop-blur-md border border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.15)] flex items-center justify-center"
            style={{ 
              transform: `scale(${scale})`,
              transition: 'transform 0.1s linear'
            }}
          >
            <span className="text-sm uppercase tracking-[0.2em] text-emerald-100/70 font-medium select-none">
              {phaseLabel}
            </span>
          </div>
        </div>

        <div className="mt-12 text-center opacity-40 text-xs space-y-1 font-mono">
          <p>Soft Bell Cue • 1000Hz</p>
          <p>{cycleDuration}s Cycle</p>
          <p className="text-emerald-500">Scale: {scale.toFixed(2)}</p>
        </div>

      </main>

      {/* Footer Controls */}
      <footer className="w-full p-10 pb-16 flex flex-col items-center gap-8 bg-slate-950/50 rounded-t-[3rem] border-t border-white/5 z-10">
        
        {/* Slider */}
        <div className="w-full max-w-xs flex flex-col gap-3">
          <div className="flex justify-between text-xs text-slate-400 px-1 select-none">
            <span>Fast (6s)</span>
            <span className="text-emerald-500 font-bold">{cycleDuration}s</span>
            <span>Slow (16s)</span>
          </div>
          <input 
            type="range" 
            min="6" 
            max="16" 
            step="1" 
            value={cycleDuration}
            onChange={handleCycleDurationChange}
            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
        </div>

        {/* Play Button */}
        <button 
          onClick={toggleActive}
          className={`w-20 h-20 rounded-full flex items-center justify-center shadow-xl border transition-all duration-300 hover:scale-105 active:scale-95 ${
            active 
              ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400 shadow-emerald-900/20' 
              : 'bg-white/5 border-white/10 text-slate-300'
          }`}
        >
          {active ? <Pause size={32} /> : <Play size={32} className="ml-1" />}
        </button>
      </footer>
    </div>
  );
};

export default App;

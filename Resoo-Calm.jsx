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
  const animationRef = useRef(null);
  const startTimeRef = useRef(null);
  const lastPhaseRef = useRef(null);

  // --- 1. 音訊引擎：Soft Bell (Medical Grade) ---
  const initAudio = useCallback(() => {
    if (!audioCtxRef.current) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioCtxRef.current = new AudioContext();
      
      masterGainRef.current = audioCtxRef.current.createGain();
      masterGainRef.current.connect(audioCtxRef.current.destination);
      // 總音量設定：依照規格書建議，設為中低 (0.4) 以減少感官負荷
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

    // 1. 建立振盪器 (Oscillators)
    const fundamental = ctx.createOscillator(); // 基音
    const harmonic = ctx.createOscillator();    // 泛音 (增加清亮度)
    
    const mainGain = ctx.createGain();
    const harmonicGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    // 2. 頻率設定 (Frequency)
    // 規格：900-1100 Hz 理想區段
    const FREQ = 1000; 
    fundamental.type = 'sine'; // 基音純淨
    fundamental.frequency.value = FREQ;

    harmonic.type = 'triangle'; // 諧波提供些微亮度
    harmonic.frequency.value = FREQ * 2; // 2nd Harmonic

    // 3. 濾波器 (Filter - Timbre Shaping)
    // 規格：Low-pass 6-8kHz
    filter.type = 'lowpass';
    filter.frequency.value = 7000;
    filter.Q.value = 0.5; // 平滑

    // 4. 路由 (Routing)
    fundamental.connect(mainGain);
    harmonic.connect(harmonicGain);
    harmonicGain.connect(mainGain); // 混合
    mainGain.connect(filter);
    filter.connect(masterGainRef.current);

    // 5. 諧波比例 (Harmonics Ratio)
    // 規格：第2諧波約 10-20%
    harmonicGain.gain.value = 0.15; 

    // 6. 包絡線 (ADSR - The "Soft" Magic)
    // 規格：Attack 2-5ms, Decay 90-120ms
    mainGain.gain.setValueAtTime(0, t);
    
    // Attack: 3ms (0.003s) - 立起但不刺耳
    mainGain.gain.linearRampToValueAtTime(0.8, t + 0.003);
    
    // Decay: 110ms (0.11s) - 快速自然消失
    // 使用指數衰減達到 "Bell" 的物理聽感
    mainGain.gain.exponentialRampToValueAtTime(0.001, t + 0.113);

    // 7. 播放與停止
    fundamental.start(t);
    harmonic.start(t);
    
    // 稍微多留一點時間給 Release (120ms total)
    fundamental.stop(t + 0.12);
    harmonic.stop(t + 0.12);

  }, [muted]);

  // --- 2. 動畫邏輯 ---
  const animate = useCallback((timestamp) => {
    if (!startTimeRef.current) startTimeRef.current = timestamp;
    const elapsed = (timestamp - startTimeRef.current) / 1000;
    
    const halfCycle = cycleDuration / 2;
    const cycleTime = elapsed % cycleDuration;
    
    const isInhale = cycleTime < halfCycle;
    const currentPhase = isInhale ? 'in' : 'out';

    // 視覺縮放
    let progress;
    if (isInhale) {
        progress = cycleTime / halfCycle;
    } else {
        progress = 1 - ((cycleTime - halfCycle) / halfCycle);
    }
    
    const easedProgress = -(Math.cos(Math.PI * progress) - 1) / 2;
    setScale(1 + easedProgress * 0.5); 

    // 觸發 Soft Bell
    if (currentPhase !== lastPhaseRef.current) {
        playSoftBell(); 
        setPhaseLabel(isInhale ? 'Inhale' : 'Exhale');
        
        // 輕微觸覺回饋 (Haptic) - 僅 30ms 配合聲音
        if (navigator.vibrate) navigator.vibrate(30);
        
        lastPhaseRef.current = currentPhase;
    }

    animationRef.current = requestAnimationFrame(animate);
  }, [cycleDuration, playSoftBell]);

  // --- 3. 控制邏輯 ---
  const toggleActive = () => {
    if (!active) {
      initAudio();
      startTimeRef.current = null;
      lastPhaseRef.current = null; 
      animationRef.current = requestAnimationFrame(animate);
    } else {
      cancelAnimationFrame(animationRef.current);
      setPhaseLabel('Ready');
      setScale(1);
    }
    setActive(!active);
  };

  useEffect(() => {
    return () => cancelAnimationFrame(animationRef.current);
  }, []);

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
        <button onClick={() => setMuted(!muted)} className="text-slate-500 hover:text-slate-300 transition-colors p-2">
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
                className="w-40 h-40 rounded-full bg-gradient-to-b from-emerald-500/20 to-teal-600/20 backdrop-blur-md border border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.15)] flex items-center justify-center transition-transform duration-75 ease-out"
                style={{ transform: `scale(${scale})` }}
            >
                <span className="text-sm uppercase tracking-[0.2em] text-emerald-100/70 font-medium select-none">
                    {phaseLabel}
                </span>
            </div>
        </div>

        <div className="mt-12 text-center opacity-40 text-xs space-y-1 font-mono">
            <p>Soft Bell Cue • 1000Hz</p>
            <p>{cycleDuration}s Cycle</p>
        </div>

      </main>

      {/* Footer Controls */}
      <footer className="w-full p-10 pb-16 flex flex-col items-center gap-8 bg-slate-950/50 rounded-t-[3rem] border-t border-white/5 z-10">
        
        {/* Slider */}
        <div className="w-full max-w-xs flex flex-col gap-3">
            <div className="flex justify-between text-xs text-slate-400 px-1 select-none">
                <span>Fast (6s)</span>
                <span className="text-emerald-500 font-bold">{cycleDuration}s</span>
                <span>Slow (10s)</span>
            </div>
            <input 
                type="range" 
                min="6" max="10" step="1" 
                value={cycleDuration}
                onChange={(e) => {
                    setCycleDuration(Number(e.target.value));
                    startTimeRef.current = null; 
                }}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
        </div>

        {/* Play Button */}
        <button 
            onClick={toggleActive}
            className={`w-20 h-20 rounded-full flex items-center justify-center shadow-xl border transition-all duration-300 hover:scale-105 active:scale-95 ${active ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400 shadow-emerald-900/20' : 'bg-white/5 border-white/10 text-slate-300'}`}
        >
            {active ? <Pause size={32} /> : <Play size={32} className="ml-1" />}
        </button>
      </footer>
    </div>
  );
};

export default App;
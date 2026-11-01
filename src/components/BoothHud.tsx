import React, { useState } from 'react';
import {
  ThemeId,
  LightingMode,
  PitchBendDirection,
  THEMES,
  QWERTY_FADE_KEYS,
  computeEffectiveBpm,
  clampBpm,
} from '../utils/stageEngine';
import {
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  Zap,
  Sparkles,
  Activity,
  Sliders,
  HelpCircle,
  RotateCcw,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';

export interface BoothHudProps {
  uiVisible: boolean;
  onToggleUiVisible: () => void;
  activeTheme: ThemeId;
  onSelectTheme: (theme: ThemeId) => void;
  lightingMode: LightingMode;
  onChangeLightingMode: (mode: LightingMode) => void;
  baseBpm: number;
  onChangeBaseBpm: (bpm: number) => void;
  pitchBend: PitchBendDirection;
  onPitchBendStart: (dir: PitchBendDirection) => void;
  onPitchBendEnd: () => void;
  autoBpm: boolean;
  onToggleAutoBpm: (next?: boolean) => void;
  onTapTempo: () => void;
  onSyncBeat: () => void;
  strobeHeld: boolean;
  onStrobeHoldChange: (held: boolean) => void;
  strobeRateHz: number;
  onChangeStrobeRateHz: (hz: number) => void;
  activeFadeKey: string | null;
  activeFadeDurationMs: number | null;
  onTriggerFade: (key: string, durationMs: number) => void;
  beatIndex: number;
  lightLevel: number;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

type MobileTab = 'fade' | 'bpm' | 'strobe';

export const BoothHud: React.FC<BoothHudProps> = ({
  uiVisible,
  onToggleUiVisible,
  activeTheme,
  onSelectTheme,
  lightingMode,
  onChangeLightingMode,
  baseBpm,
  onChangeBaseBpm,
  pitchBend,
  onPitchBendStart,
  onPitchBendEnd,
  autoBpm,
  onToggleAutoBpm,
  onTapTempo,
  onSyncBeat,
  strobeHeld,
  onStrobeHoldChange,
  strobeRateHz,
  onChangeStrobeRateHz,
  activeFadeKey,
  activeFadeDurationMs,
  onTriggerFade,
  beatIndex,
  lightLevel,
  isFullscreen,
  onToggleFullscreen,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isPinnedOpen, setIsPinnedOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>('fade');
  const [showShortcutModal, setShowShortcutModal] = useState(false);
  const [bpmInputText, setBpmInputText] = useState<string>(String(baseBpm));
  const [isEditingBpm, setIsEditingBpm] = useState(false);

  const effectiveBpm = computeEffectiveBpm(baseBpm, pitchBend, 6);
  const currentThemeMeta = THEMES[activeTheme];
  const isWhiteout = activeTheme === 9;

  React.useEffect(() => {
    if (!isEditingBpm) {
      setBpmInputText(baseBpm.toFixed(1).replace(/\.0$/, ''));
    }
  }, [baseBpm, isEditingBpm]);

  const handleBpmInputCommit = () => {
    setIsEditingBpm(false);
    const parsed = parseFloat(bpmInputText);
    if (!Number.isNaN(parsed)) {
      const clamped = clampBpm(parsed);
      onChangeBaseBpm(clamped);
      setBpmInputText(clamped.toFixed(1).replace(/\.0$/, ''));
    } else {
      setBpmInputText(baseBpm.toFixed(1).replace(/\.0$/, ''));
    }
  };

  // When UI is hidden (H key or Hide button), keep screen clean while remaining
  // accessible via touch on mobile devices and hover/click on desktop
  if (!uiVisible) {
    return (
      <div className="fixed top-3 right-3 sm:top-4 sm:right-4 z-50 opacity-45 hover:opacity-100 active:opacity-100 focus-within:opacity-100 transition-opacity duration-200">
        <button
          type="button"
          onClick={onToggleUiVisible}
          aria-label="컨트롤 UI 보이기 (단축키 H)"
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#08080a]/90 text-neutral-200 border border-white/15 text-xs font-medium shadow-lg hover:bg-neutral-900 whitespace-nowrap shrink-0"
        >
          <Eye className="w-3.5 h-3.5 text-white" />
          <span>UI 보이기 (H)</span>
        </button>
      </div>
    );
  }

  const showDetails = isHovered || isPinnedOpen || isEditingBpm;

  return (
    <>
      {/* Top Minimal Monochrome Header Bar (Responsive for Mobile & Desktop) */}
      <header
        className={`fixed top-0 inset-x-0 z-30 flex items-center justify-between gap-2 sm:gap-8 px-3.5 sm:px-6 py-2.5 sm:py-3.5 transition-colors duration-200 ${
          isWhiteout
            ? 'bg-[#08080a]/95 text-neutral-100 border-b border-neutral-800'
            : 'bg-[#060608]/88 text-neutral-100 border-b border-white/[0.08]'
        }`}
      >
        {/* Zone 1: Brand Wordmark + Mobile Theme Status Pill */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="text-sm sm:text-base font-bold tracking-tight font-display text-white whitespace-nowrap shrink-0">
            PULSE STAGE
          </div>
          <span className="md:hidden inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/[0.06] border border-white/10 text-[11px] text-neutral-300 truncate">
            <strong className="text-white font-mono">#{activeTheme}</strong>
            <span className="truncate">{currentThemeMeta.shortLabel}</span>
          </span>
        </div>

        {/* Zone 2: Desktop Concise Monochrome Status & Quick Mode Links */}
        <nav
          aria-label="스테이지 상태 및 주요 단축 제어"
          className="hidden md:flex items-center gap-6 text-xs text-neutral-400"
        >
          <span className="whitespace-nowrap shrink-0">
            배경 <strong className="text-white font-mono tabular-nums">#{activeTheme}</strong> ·{' '}
            <span className="text-neutral-200">{currentThemeMeta.nameKo}</span>
          </span>
          <span aria-hidden="true" className="text-neutral-700">
            /
          </span>
          <button
            type="button"
            onClick={() => onToggleAutoBpm()}
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            반응 모드:{' '}
            <strong className="text-white">
              {autoBpm ? 'AUTO (BPM)' : 'MANUAL (OFF)'}
            </strong>
          </button>
          <span aria-hidden="true" className="text-neutral-700">
            /
          </span>
          <button
            type="button"
            onClick={() =>
              onChangeLightingMode(lightingMode === 'bloom' ? 'overdrive' : 'bloom')
            }
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            조명 연출:{' '}
            <strong className="text-white">
              {lightingMode === 'bloom' ? '스테이지 블룸' : '그래픽 백색 발광'}
            </strong>
          </button>
          <span aria-hidden="true" className="text-neutral-700">
            /
          </span>
          <button
            type="button"
            onClick={() => setShowShortcutModal((v) => !v)}
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            단축키 안내
          </button>
        </nav>

        {/* Zone 3: Primary Actions — Fullscreen & Hide UI */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onToggleFullscreen}
            aria-label={isFullscreen ? '전체화면 종료 (F)' : '전체화면 전환 (F)'}
            className="px-2.5 sm:px-3 py-1.5 text-xs font-medium text-neutral-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.1] border border-white/10 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            {isFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">전체화면 (F)</span>
          </button>
          <button
            type="button"
            onClick={onToggleUiVisible}
            aria-label="컨트롤 UI 숨기기 (단축키 H)"
            className="px-2.5 sm:px-3.5 py-1.5 text-xs font-semibold text-neutral-950 bg-white hover:bg-neutral-200 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <EyeOff className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">UI 숨기기 (H)</span>
            <span className="sm:hidden">숨기기</span>
          </button>
        </div>
      </header>

      {/* Bottom Interactive Monochrome DJ Console Dock */}
      <section
        aria-label="DJ 비주얼 및 조명 컨트롤 패널"
        onMouseEnter={(e) => {
          // Only trigger hover auto-open for fine mouse pointers (desktop)
          if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
            setIsHovered(true);
          }
        }}
        onMouseLeave={() => setIsHovered(false)}
        className="fixed bottom-2 sm:bottom-4 inset-x-0 z-30 flex justify-center px-2.5 sm:px-4 pointer-events-none"
      >
        <div
          className={`w-full max-w-[1220px] pointer-events-auto rounded-xl border transition-colors duration-200 ${
            isWhiteout
              ? 'bg-[#08080a]/96 border-neutral-800 text-neutral-100 shadow-2xl'
              : 'bg-[#070709]/94 border-white/12 text-neutral-100 shadow-2xl'
          } p-2.5 sm:p-4`}
        >
          {/* Expandable Detailed Controls Drawer (Hover on Desktop, Tap Toggle on Mobile) */}
          <div
            className={
              showDetails
                ? 'block opacity-100 mb-2.5 sm:mb-4 pb-2.5 sm:pb-4 border-b border-white/10'
                : 'hidden opacity-0'
            }
          >
            {/* Mobile Segmented Tab Switcher (Visible below lg so mobile stays compact) */}
            <div className="flex lg:hidden items-center gap-1 p-1 mb-2.5 rounded-lg bg-neutral-900 border border-white/10">
              <button
                type="button"
                onClick={() => setMobileTab('fade')}
                className={`flex-1 py-1.5 px-1.5 rounded-md text-[11px] sm:text-xs font-semibold transition-colors flex items-center justify-center gap-1 whitespace-nowrap ${
                  mobileTab === 'fade'
                    ? 'bg-white text-neutral-950'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Sparkles className="w-3 h-3 shrink-0" />
                <span>페이드 (Q~P)</span>
              </button>
              <button
                type="button"
                onClick={() => setMobileTab('bpm')}
                className={`flex-1 py-1.5 px-1.5 rounded-md text-[11px] sm:text-xs font-semibold transition-colors flex items-center justify-center gap-1 whitespace-nowrap ${
                  mobileTab === 'bpm'
                    ? 'bg-white text-neutral-950'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Activity className="w-3 h-3 shrink-0" />
                <span>BPM · 벤드</span>
              </button>
              <button
                type="button"
                onClick={() => setMobileTab('strobe')}
                className={`flex-1 py-1.5 px-1.5 rounded-md text-[11px] sm:text-xs font-semibold transition-colors flex items-center justify-center gap-1 whitespace-nowrap ${
                  mobileTab === 'strobe'
                    ? 'bg-white text-neutral-950'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Zap className="w-3 h-3 shrink-0" />
                <span>스트로브 · 모드</span>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 items-stretch">
              {/* Left Column: QWERTY White Fade Pad (Q ~ P: 100ms ~ 1000ms) */}
              <div
                className={`${
                  mobileTab === 'fade' ? 'flex' : 'hidden lg:flex'
                } lg:col-span-5 flex-col justify-between bg-white/[0.025] border border-white/[0.08] rounded-lg p-3 sm:p-3.5`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Sparkles className="w-3.5 h-3.5 text-neutral-300 shrink-0" />
                    <span className="text-xs font-semibold text-neutral-200 whitespace-nowrap">
                      화이트 페이드 조명 (Q ~ P)
                    </span>
                  </div>
                  <span className="text-[11px] font-mono tabular-nums text-neutral-400 whitespace-nowrap shrink-0">
                    {activeFadeDurationMs
                      ? `활성: ${activeFadeKey} (${activeFadeDurationMs}ms)`
                      : '100ms → 1000ms'}
                  </span>
                </div>

                <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
                  {QWERTY_FADE_KEYS.map((item) => {
                    const isTriggered = activeFadeKey === item.key && lightLevel > 0.05;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onPointerDown={(e) => {
                          e.preventDefault();
                          onTriggerFade(item.key, item.durationMs);
                        }}
                        onClick={(e) => {
                          // Keyboard activation fallback (Enter/Space on focused button)
                          if (e.detail === 0) {
                            onTriggerFade(item.key, item.durationMs);
                          }
                        }}
                        onContextMenu={(e) => e.preventDefault()}
                        aria-label={`화이트 페이드 ${item.key}키 (${item.durationMs}ms)`}
                        className={`flex flex-col items-center justify-center min-h-[42px] sm:min-h-0 py-2 px-1 rounded-md border text-center transition-all touch-none select-none ${
                          isTriggered
                            ? 'bg-white text-neutral-950 border-white font-bold scale-[1.03]'
                            : 'bg-neutral-900 hover:bg-neutral-800 active:bg-neutral-700 text-neutral-200 border-white/10'
                        }`}
                      >
                        <span className="text-xs font-mono font-bold leading-none">
                          {item.key}
                        </span>
                        <span
                          className={`text-[10px] font-mono tabular-nums mt-1 leading-none ${
                            isTriggered ? 'text-neutral-800' : 'text-neutral-500'
                          }`}
                        >
                          {item.durationMs}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Center Column: Spacebar Strobe & Lighting Render Mode */}
              <div
                className={`${
                  mobileTab === 'strobe' ? 'flex' : 'hidden lg:flex'
                } lg:col-span-3 flex-col justify-between bg-white/[0.025] border border-white/[0.08] rounded-lg p-3 sm:p-3.5`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-neutral-300 shrink-0" />
                    <span className="text-xs font-semibold text-neutral-200">
                      점멸 스트로브 & 조명 모드
                    </span>
                  </div>
                  <span className="text-[11px] font-mono tabular-nums text-neutral-200">
                    {strobeRateHz} Hz
                  </span>
                </div>

                {/* Strobe Speed Slider */}
                <div className="flex items-center gap-2.5 my-1.5">
                  <label
                    htmlFor="strobe-rate-slider"
                    className="text-[11px] text-neutral-400 whitespace-nowrap shrink-0"
                  >
                    점멸 속도
                  </label>
                  <input
                    id="strobe-rate-slider"
                    type="range"
                    min={3}
                    max={20}
                    step={1}
                    value={strobeRateHz}
                    onChange={(e) => onChangeStrobeRateHz(Number(e.target.value))}
                    className="w-full accent-white cursor-pointer h-2 bg-neutral-800 rounded-lg"
                  />
                </div>

                {/* Lighting Style Switcher (Bloom vs Geometry Overdrive) */}
                <div className="grid grid-cols-2 gap-1.5 mt-2">
                  <button
                    type="button"
                    onClick={() => onChangeLightingMode('bloom')}
                    className={`py-2 sm:py-1.5 px-2.5 rounded-md text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
                      lightingMode === 'bloom'
                        ? 'bg-white text-neutral-950 border-white font-semibold'
                        : 'bg-neutral-900 border-white/10 text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    스테이지 블룸
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeLightingMode('overdrive')}
                    className={`py-2 sm:py-1.5 px-2.5 rounded-md text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
                      lightingMode === 'overdrive'
                        ? 'bg-white text-neutral-950 border-white font-semibold'
                        : 'bg-neutral-900 border-white/10 text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    그래픽 발광 (L)
                  </button>
                </div>
              </div>

              {/* Right Column: BPM Beatmatching, Pitch Bend (- / +), Auto/Manual */}
              <div
                className={`${
                  mobileTab === 'bpm' ? 'flex' : 'hidden lg:flex'
                } lg:col-span-4 flex-col justify-between bg-white/[0.025] border border-white/[0.08] rounded-lg p-3 sm:p-3.5`}
              >
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-neutral-300 shrink-0" />
                    <span className="text-xs font-semibold text-neutral-200">
                      BPM & 비트매칭 (피치벤드)
                    </span>
                  </div>

                  {/* Auto BPM vs Manual Off Toggle */}
                  <div className="flex items-center p-0.5 bg-neutral-900 border border-white/10 rounded-md">
                    <button
                      type="button"
                      onClick={() => onToggleAutoBpm(true)}
                      className={`px-2 py-1 sm:py-0.5 text-[11px] font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                        autoBpm
                          ? 'bg-white text-neutral-950 font-semibold'
                          : 'text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      BPM 오토
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleAutoBpm(false)}
                      className={`px-2 py-1 sm:py-0.5 text-[11px] font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                        !autoBpm
                          ? 'bg-white text-neutral-950 font-semibold'
                          : 'text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      수동 (Off)
                    </button>
                  </div>
                </div>

                {/* Direct BPM Numeric Input + -1/+1 Step + Tap + Sync + Pitch Bend (- / +) */}
                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        onChangeBaseBpm(clampBpm(Math.round((baseBpm - 1) * 10) / 10))
                      }
                      aria-label="BPM 1 감소 (아래 화살표)"
                      title="BPM -1 (↓ 화살표)"
                      className="px-2 py-2 sm:py-1.5 rounded-md bg-neutral-900 hover:bg-neutral-800 active:bg-white active:text-neutral-950 border border-white/15 font-mono text-xs font-bold text-neutral-200 transition-colors shrink-0 select-none"
                    >
                      -1
                    </button>
                    <div className="relative flex items-center">
                      <label htmlFor="bpm-direct-input" className="sr-only">
                        BPM 직접 입력
                      </label>
                      <input
                        id="bpm-direct-input"
                        type="number"
                        min={40}
                        max={240}
                        step={0.5}
                        value={bpmInputText}
                        onFocus={() => setIsEditingBpm(true)}
                        onChange={(e) => setBpmInputText(e.target.value)}
                        onBlur={handleBpmInputCommit}
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          if (e.key === 'Enter') {
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
                        className="w-14 py-2 sm:py-1.5 px-1.5 rounded-md bg-neutral-900 border border-white/15 text-sm font-mono font-bold tabular-nums text-white text-center focus:outline-none focus:border-white"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onChangeBaseBpm(clampBpm(Math.round((baseBpm + 1) * 10) / 10))
                      }
                      aria-label="BPM 1 증가 (위 화살표)"
                      title="BPM +1 (↑ 화살표)"
                      className="px-2 py-2 sm:py-1.5 rounded-md bg-neutral-900 hover:bg-neutral-800 active:bg-white active:text-neutral-950 border border-white/15 font-mono text-xs font-bold text-neutral-200 transition-colors shrink-0 select-none"
                    >
                      +1
                    </button>
                  </div>

                  {/* Pitch Bend - */}
                  <button
                    type="button"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      onPitchBendStart(-1);
                    }}
                    onPointerUp={onPitchBendEnd}
                    onPointerLeave={onPitchBendEnd}
                    onPointerCancel={onPitchBendEnd}
                    onContextMenu={(e) => e.preventDefault()}
                    aria-label="피치벤드 감속 (- 버튼 홀드 또는 [ 키)"
                    className={`px-2 py-2 sm:py-1.5 rounded-md border font-mono text-xs font-bold transition-colors whitespace-nowrap shrink-0 touch-none select-none ${
                      pitchBend === -1
                        ? 'bg-white text-neutral-950 border-white'
                        : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border-white/10'
                    }`}
                  >
                    - BEND
                  </button>

                  {/* Pitch Bend + */}
                  <button
                    type="button"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      onPitchBendStart(1);
                    }}
                    onPointerUp={onPitchBendEnd}
                    onPointerLeave={onPitchBendEnd}
                    onPointerCancel={onPitchBendEnd}
                    onContextMenu={(e) => e.preventDefault()}
                    aria-label="피치벤드 가속 (+ 버튼 홀드 또는 ] 키)"
                    className={`px-2 py-2 sm:py-1.5 rounded-md border font-mono text-xs font-bold transition-colors whitespace-nowrap shrink-0 touch-none select-none ${
                      pitchBend === 1
                        ? 'bg-white text-neutral-950 border-white'
                        : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border-white/10'
                    }`}
                  >
                    + BEND
                  </button>

                  {/* TAP Tempo */}
                  <button
                    type="button"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      onTapTempo();
                    }}
                    onClick={(e) => {
                      if (e.detail === 0) onTapTempo();
                    }}
                    aria-label="탭 템포 (박자에 맞춰 터치/클릭)"
                    className="px-2 py-2 sm:py-1.5 rounded-md bg-neutral-900 hover:bg-neutral-800 active:bg-white active:text-neutral-950 border border-white/10 text-xs font-semibold text-neutral-200 transition-colors whitespace-nowrap shrink-0 touch-none select-none"
                  >
                    TAP
                  </button>

                  {/* Beat SYNC / CUE */}
                  <button
                    type="button"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      onSyncBeat();
                    }}
                    onClick={(e) => {
                      if (e.detail === 0) onSyncBeat();
                    }}
                    aria-label="박자 정박 싱크 맞추기 (Enter)"
                    className="px-2 py-2 sm:py-1.5 rounded-md bg-white/10 hover:bg-white/20 active:bg-white active:text-neutral-950 border border-white/20 text-xs font-semibold text-white transition-colors flex items-center justify-center gap-1 whitespace-nowrap shrink-0 touch-none select-none"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>SYNC</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Always-Visible Primary Strip: Theme 0~9 Selector + Space Strobe Hold + Live BPM (-1/+1) + Pad Toggle */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2">
            {/* Theme 0..9 Buttons: 5x2 Grid on Mobile (<sm) so all 10 themes fit without scrolling, Single Row on sm+ */}
            <div className="grid grid-cols-5 sm:flex sm:items-center gap-1 py-0.5">
              {([0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as ThemeId[]).map((id) => {
                const t = THEMES[id];
                const isSelected = activeTheme === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onSelectTheme(id)}
                    aria-label={`배경 테마 ${id}번: ${t.nameKo}`}
                    aria-pressed={isSelected}
                    className={`group relative flex items-center justify-center sm:justify-start gap-1 px-1.5 sm:px-2 py-2 sm:py-1.5 rounded-lg border text-xs font-medium transition-all whitespace-nowrap shrink-0 ${
                      isSelected
                        ? 'bg-white text-neutral-950 border-white font-semibold shadow-sm'
                        : 'bg-white/[0.03] hover:bg-white/[0.08] active:bg-white/[0.15] text-neutral-300 border-white/10'
                    }`}
                  >
                    <span
                      className={`font-mono font-bold text-xs tabular-nums ${
                        isSelected ? 'text-neutral-950' : 'text-white'
                      }`}
                    >
                      {id}
                    </span>
                    <span className="text-[11px] truncate">{t.shortLabel}</span>
                  </button>
                );
              })}
            </div>

            {/* Right Status & Spacebar Strobe Hold Trigger + Live BPM (-1 / +1) + Expand Pad Toggle */}
            <div className="flex items-center justify-between lg:justify-end gap-1.5 sm:gap-2 lg:ml-auto shrink-0">
              {/* Spacebar / Touch Strobe Hold Button */}
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  onStrobeHoldChange(true);
                }}
                onPointerUp={() => onStrobeHoldChange(false)}
                onPointerLeave={() => onStrobeHoldChange(false)}
                onPointerCancel={() => onStrobeHoldChange(false)}
                onContextMenu={(e) => e.preventDefault()}
                aria-label="화이트 점멸 스트로브 (스페이스바 또는 터치 홀드)"
                className={`flex-1 lg:flex-none justify-center px-3 py-2.5 sm:py-2 rounded-lg border text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 touch-none select-none ${
                  strobeHeld
                    ? 'bg-white text-neutral-950 border-white shadow-lg scale-[1.01]'
                    : 'bg-white/[0.06] hover:bg-white/[0.11] text-neutral-200 border-white/15'
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-current shrink-0" />
                <span className="hidden sm:inline">STROBE (SPACE 홀드)</span>
                <span className="sm:hidden">STROBE (홀드)</span>
              </button>

              {/* Live Effective BPM & Quick -1 / +1 Buttons */}
              <div className="flex items-center rounded-lg bg-neutral-900 border border-white/10 overflow-hidden shrink-0">
                <button
                  type="button"
                  data-testid="bpm-minus-one"
                  onClick={() =>
                    onChangeBaseBpm(clampBpm(Math.round((baseBpm - 1) * 10) / 10))
                  }
                  aria-label="BPM -1 감소 (아래 화살표)"
                  title="BPM -1 (↓ 화살표)"
                  className="px-2 py-2 sm:py-1.5 hover:bg-neutral-800 active:bg-white active:text-neutral-950 border-r border-white/10 font-mono text-xs font-bold text-neutral-200 transition-colors select-none"
                >
                  -1
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileTab('bpm');
                    setIsPinnedOpen((v) => !v);
                  }}
                  className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-neutral-800 text-left transition-colors"
                  title="클릭하거나 마우스를 올리면 BPM 및 피치벤드 세부 설정이 열립니다"
                >
                  <div className="flex items-center gap-1" aria-label={`현재 박자 ${beatIndex + 1}/4`}>
                    {[0, 1, 2, 3].map((b) => (
                      <span
                        key={b}
                        className={`w-1.5 h-3.5 rounded-sm transition-colors ${
                          autoBpm && beatIndex === b
                            ? 'bg-white'
                            : 'bg-neutral-700'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-mono font-bold tabular-nums text-white leading-none">
                      {effectiveBpm.toFixed(1)}{' '}
                      <span className="text-[10px] font-normal text-neutral-400">BPM</span>
                    </div>
                    <div className="text-[10px] font-mono tabular-nums text-neutral-400 leading-none mt-0.5">
                      {pitchBend === -1
                        ? '▼ PITCH -6%'
                        : pitchBend === 1
                        ? '▲ PITCH +6%'
                        : autoBpm
                        ? 'AUTO SYNC'
                        : 'MANUAL'}
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  data-testid="bpm-plus-one"
                  onClick={() =>
                    onChangeBaseBpm(clampBpm(Math.round((baseBpm + 1) * 10) / 10))
                  }
                  aria-label="BPM +1 증가 (위 화살표)"
                  title="BPM +1 (↑ 화살표)"
                  className="px-2 py-2 sm:py-1.5 hover:bg-neutral-800 active:bg-white active:text-neutral-950 border-l border-white/10 font-mono text-xs font-bold text-neutral-200 transition-colors select-none"
                >
                  +1
                </button>
              </div>

              {/* Pin / Expand Detailed Drawer Toggle (Labeled on mobile for clear touch discovery) */}
              <button
                type="button"
                onClick={() => setIsPinnedOpen((v) => !v)}
                aria-expanded={showDetails}
                aria-label="조명 패드 및 세부 설정 패널 열기/닫기"
                className={`px-2.5 sm:p-2 py-2.5 sm:py-2 rounded-lg border text-xs font-semibold transition-colors flex items-center gap-1 shrink-0 ${
                  isPinnedOpen
                    ? 'bg-white text-neutral-950 border-white'
                    : 'bg-white/[0.05] hover:bg-white/[0.1] border-white/12 text-neutral-200'
                }`}
              >
                <Sliders className="w-4 h-4" />
                <span className="lg:hidden">패드</span>
                {showDetails ? (
                  <ChevronDown className="w-3.5 h-3.5 lg:hidden" />
                ) : (
                  <ChevronUp className="w-3.5 h-3.5 lg:hidden" />
                )}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Keyboard Shortcuts Reference Modal */}
      {showShortcutModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="shortcut-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
          onClick={() => setShowShortcutModal(false)}
        >
          <div
            className="w-full max-w-lg rounded-xl bg-[#09090c] border border-white/15 p-5 sm:p-6 text-neutral-100 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-white" />
                <h2 id="shortcut-modal-title" className="text-base font-bold font-display">
                  DJ 키보드 & 터치 컨트롤 안내
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowShortcutModal(false)}
                className="px-2.5 py-1 text-xs rounded-md bg-white/10 hover:bg-white/20 text-neutral-200"
              >
                닫기 (ESC)
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between gap-2 py-1.5 border-b border-white/5">
                <span className="text-neutral-300">3D 배경 테마 전환 (0: 암전 / 1~8: 3D 공간 / 9: 화이트)</span>
                <kbd className="px-2 py-1 rounded bg-neutral-900 border border-white/15 font-mono text-white shrink-0">
                  숫자키 0 ~ 9
                </kbd>
              </div>
              <div className="flex items-center justify-between gap-2 py-1.5 border-b border-white/5">
                <span className="text-neutral-300">10단계 화이트 페이드 조명 (100ms ~ 1000ms)</span>
                <kbd className="px-2 py-1 rounded bg-neutral-900 border border-white/15 font-mono text-white shrink-0">
                  Q ~ P / 터치 패드
                </kbd>
              </div>
              <div className="flex items-center justify-between gap-2 py-1.5 border-b border-white/5">
                <span className="text-neutral-300">화이트 점멸 스트로브 (누르고 있는 동안 작동)</span>
                <kbd className="px-2 py-1 rounded bg-neutral-900 border border-white/15 font-mono text-white shrink-0">
                  SPACE / 버튼 홀드
                </kbd>
              </div>
              <div className="flex items-center justify-between gap-2 py-1.5 border-b border-white/5">
                <span className="text-neutral-300">BPM -1 / +1 단위 즉시 조절</span>
                <kbd className="px-2 py-1 rounded bg-neutral-900 border border-white/15 font-mono text-white shrink-0">
                  ↑ / ↓ 화살표 또는 -1 / +1 버튼
                </kbd>
              </div>
              <div className="flex items-center justify-between gap-2 py-1.5 border-b border-white/5">
                <span className="text-neutral-300">비트매칭 피치벤드 일시 감속 / 일시 가속 (홀드)</span>
                <kbd className="px-2 py-1 rounded bg-neutral-900 border border-white/15 font-mono text-white shrink-0">
                  - / + / [ / ] / ← / →
                </kbd>
              </div>
              <div className="flex items-center justify-between gap-2 py-1.5 border-b border-white/5">
                <span className="text-neutral-300">박자 싱크 맞추기 (Downbeat 정박 리셋)</span>
                <kbd className="px-2 py-1 rounded bg-neutral-900 border border-white/15 font-mono text-neutral-200 shrink-0">
                  Enter 또는 S
                </kbd>
              </div>
              <div className="flex items-center justify-between gap-2 py-1.5 border-b border-white/5">
                <span className="text-neutral-300">조명 연출 모드 전환 (스테이지 블룸 ↔ 그래픽 발광)</span>
                <kbd className="px-2 py-1 rounded bg-neutral-900 border border-white/15 font-mono text-neutral-200 shrink-0">
                  L
                </kbd>
              </div>
              <div className="flex items-center justify-between gap-2 py-1.5">
                <span className="text-neutral-300">공연용 화면 컨트롤 UI 숨기기 / 보이기</span>
                <kbd className="px-2 py-1 rounded bg-neutral-900 border border-white/15 font-mono text-white shrink-0">
                  H
                </kbd>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

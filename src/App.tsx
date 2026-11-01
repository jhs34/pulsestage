/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ThemeId,
  LightingMode,
  PitchBendDirection,
  getThemeIdFromKey,
  getFadeDurationMs,
  computeTapTempoBpm,
  computeEffectiveBpm,
  clampBpm,
} from './utils/stageEngine';
import { StageCanvas } from './components/StageCanvas';
import { BoothHud } from './components/BoothHud';

export default function App() {
  // Default to Theme 1 (Deep Sub-Bass Waves) so the stage immediately looks alive
  const [activeTheme, setActiveTheme] = useState<ThemeId>(1);
  const [lightingMode, setLightingMode] = useState<LightingMode>('bloom');
  const [baseBpm, setBaseBpm] = useState<number>(128);
  const [pitchBend, setPitchBend] = useState<PitchBendDirection>(0);
  const [autoBpm, setAutoBpm] = useState<boolean>(true);
  const [strobeHeld, setStrobeHeld] = useState<boolean>(false);
  const [strobeRateHz, setStrobeRateHz] = useState<number>(10);
  const [uiVisible, setUiVisible] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Fade trigger state
  const [fadeTrigger, setFadeTrigger] = useState<{
    id: number;
    durationMs: number;
    key: string;
    timestamp: number;
  } | null>(null);

  const [syncTrigger, setSyncTrigger] = useState<number>(0);
  const [beatIndex, setBeatIndex] = useState<number>(0);
  const [lightLevel, setLightLevel] = useState<number>(0);

  const tapHistoryRef = useRef<number[]>([]);

  const handleTriggerFade = useCallback((key: string, durationMs: number) => {
    setFadeTrigger((prev) => ({
      id: (prev?.id ?? 0) + 1,
      durationMs,
      key: key.toUpperCase(),
      timestamp: performance.now(),
    }));
  }, []);

  const handleTapTempo = useCallback(() => {
    const now = performance.now();
    const prevTaps = tapHistoryRef.current;
    // Reset tap history if last tap was more than 2.2 seconds ago
    const filtered =
      prevTaps.length > 0 && now - prevTaps[prevTaps.length - 1] > 2200
        ? [now]
        : [...prevTaps.slice(-7), now];
    tapHistoryRef.current = filtered;

    const newBpm = computeTapTempoBpm(filtered);
    if (newBpm !== null) {
      setBaseBpm(newBpm);
    }
  }, []);

  const handleSyncBeat = useCallback(() => {
    setSyncTrigger((c) => c + 1);
    setBeatIndex(0);
  }, []);

  const handleToggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  // Global keyboard shortcuts for DJ booth operation
  useEffect(() => {
    const isTypingInInput = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingInInput(e.target)) return;

      // 1. Spacebar Hold Strobe
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        if (!e.repeat) {
          setStrobeHeld(true);
        }
        return;
      }

      // 2. Pitch Bend Hold (- / + / [ / ] / ArrowLeft / ArrowRight)
      if (
        e.key === '-' ||
        e.key === '_' ||
        e.code === 'Minus' ||
        e.code === 'NumpadSubtract' ||
        e.code === 'BracketLeft' ||
        e.code === 'ArrowLeft'
      ) {
        e.preventDefault();
        if (!e.repeat) {
          setPitchBend(-1);
        }
        return;
      }

      if (
        e.key === '+' ||
        e.key === '=' ||
        e.code === 'Equal' ||
        e.code === 'NumpadAdd' ||
        e.code === 'BracketRight' ||
        e.code === 'ArrowRight'
      ) {
        e.preventDefault();
        if (!e.repeat) {
          setPitchBend(1);
        }
        return;
      }

      // 2b. ArrowUp / ArrowDown -> Step Base BPM by +1 / -1
      if (e.code === 'ArrowUp' || e.key === 'ArrowUp') {
        e.preventDefault();
        setBaseBpm((prev) => clampBpm(Math.round((prev + 1) * 10) / 10));
        return;
      }

      if (e.code === 'ArrowDown' || e.key === 'ArrowDown') {
        e.preventDefault();
        setBaseBpm((prev) => clampBpm(Math.round((prev - 1) * 10) / 10));
        return;
      }

      // Ignore key auto-repeat for one-shot triggers
      if (e.repeat) return;

      // 3. Number keys 0..9 -> Theme Switch
      const themeId = getThemeIdFromKey(e.key, e.code);
      if (themeId !== null) {
        e.preventDefault();
        setActiveTheme(themeId);
        return;
      }

      // 4. QWERTY keys Q..P -> White Fade Lighting (100ms..1000ms)
      const fadeMs = getFadeDurationMs(e.code) ?? getFadeDurationMs(e.key);
      if (fadeMs !== null) {
        e.preventDefault();
        const labelKey = e.code.startsWith('Key') ? e.code.slice(3) : e.key.toUpperCase();
        handleTriggerFade(labelKey, fadeMs);
        return;
      }

      // 5. H Key -> Hide / Show Control UI
      if (e.code === 'KeyH' || e.key.toLowerCase() === 'h') {
        e.preventDefault();
        setUiVisible((v) => !v);
        return;
      }

      // 6. L Key -> Toggle Lighting Render Mode (Stage Bloom vs Geometry Overdrive)
      if (e.code === 'KeyL' || e.key.toLowerCase() === 'l') {
        e.preventDefault();
        setLightingMode((m) => (m === 'bloom' ? 'overdrive' : 'bloom'));
        return;
      }

      // 7. A Key -> Toggle Auto BPM / Manual Mode
      if (e.code === 'KeyA' || e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setAutoBpm((v) => !v);
        return;
      }

      // 8. S or Enter -> Beat Sync / Cue
      if (e.code === 'KeyS' || e.key.toLowerCase() === 's' || e.key === 'Enter') {
        e.preventDefault();
        handleSyncBeat();
        return;
      }

      // 9. F Key -> Fullscreen toggle
      if (e.code === 'KeyF' || e.key.toLowerCase() === 'f') {
        e.preventDefault();
        handleToggleFullscreen();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === ' ') {
        setStrobeHeld(false);
        return;
      }

      if (
        e.key === '-' ||
        e.key === '_' ||
        e.code === 'Minus' ||
        e.code === 'NumpadSubtract' ||
        e.code === 'BracketLeft' ||
        e.code === 'ArrowLeft'
      ) {
        setPitchBend((prev) => (prev === -1 ? 0 : prev));
        return;
      }

      if (
        e.key === '+' ||
        e.key === '=' ||
        e.code === 'Equal' ||
        e.code === 'NumpadAdd' ||
        e.code === 'BracketRight' ||
        e.code === 'ArrowRight'
      ) {
        setPitchBend((prev) => (prev === 1 ? 0 : prev));
      }
    };

    const handleWindowBlur = () => {
      setStrobeHeld(false);
      setPitchBend(0);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [handleTriggerFade, handleSyncBeat, handleToggleFullscreen]);

  const effectiveBpm = computeEffectiveBpm(baseBpm, pitchBend, 6);

  return (
    <main
      data-testid="dj-stage-root"
      data-active-theme={activeTheme}
      data-lighting-mode={lightingMode}
      data-auto-bpm={autoBpm}
      data-base-bpm={baseBpm}
      data-effective-bpm={effectiveBpm}
      data-pitch-bend={pitchBend}
      data-strobe-held={strobeHeld}
      data-ui-visible={uiVisible}
      data-last-fade-key={fadeTrigger?.key ?? ''}
      data-last-fade-ms={fadeTrigger?.durationMs ?? 0}
      className="relative w-screen h-[100dvh] overflow-hidden bg-[#010102] select-none touch-manipulation"
    >
      <StageCanvas
        activeTheme={activeTheme}
        lightingMode={lightingMode}
        baseBpm={baseBpm}
        pitchBend={pitchBend}
        pitchBendRangePercent={6}
        autoBpm={autoBpm}
        strobeHeld={strobeHeld}
        strobeRateHz={strobeRateHz}
        fadeTrigger={fadeTrigger}
        syncTrigger={syncTrigger}
        onBeatTelemetry={(beatIdx, _phase, currentLight) => {
          setBeatIndex(beatIdx);
          setLightLevel(currentLight);
        }}
      />

      <BoothHud
        uiVisible={uiVisible}
        onToggleUiVisible={() => setUiVisible((v) => !v)}
        activeTheme={activeTheme}
        onSelectTheme={setActiveTheme}
        lightingMode={lightingMode}
        onChangeLightingMode={setLightingMode}
        baseBpm={baseBpm}
        onChangeBaseBpm={setBaseBpm}
        pitchBend={pitchBend}
        onPitchBendStart={(dir) => setPitchBend(dir)}
        onPitchBendEnd={() => setPitchBend(0)}
        autoBpm={autoBpm}
        onToggleAutoBpm={(next) => setAutoBpm((v) => (typeof next === 'boolean' ? next : !v))}
        onTapTempo={handleTapTempo}
        onSyncBeat={handleSyncBeat}
        strobeHeld={strobeHeld}
        onStrobeHoldChange={setStrobeHeld}
        strobeRateHz={strobeRateHz}
        onChangeStrobeRateHz={setStrobeRateHz}
        activeFadeKey={fadeTrigger?.key ?? null}
        activeFadeDurationMs={fadeTrigger?.durationMs ?? null}
        onTriggerFade={handleTriggerFade}
        beatIndex={beatIndex}
        lightLevel={lightLevel}
        isFullscreen={isFullscreen}
        onToggleFullscreen={handleToggleFullscreen}
      />
    </main>
  );
}

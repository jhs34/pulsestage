export type ThemeId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type LightingMode = 'bloom' | 'overdrive';

export type PitchBendDirection = -1 | 0 | 1;

export interface ThemeMetadata {
  id: ThemeId;
  key: string;
  shortLabel: string;
  nameKo: string;
  nameEn: string;
  subtitle: string;
  accentHex: string;
  secondaryHex: string;
}

export interface FadeKeyConfig {
  key: string;
  code: string;
  durationMs: number;
  label: string;
}

export const QWERTY_FADE_KEYS: FadeKeyConfig[] = [
  { key: 'Q', code: 'KeyQ', durationMs: 100, label: '100ms' },
  { key: 'W', code: 'KeyW', durationMs: 200, label: '200ms' },
  { key: 'E', code: 'KeyE', durationMs: 300, label: '300ms' },
  { key: 'R', code: 'KeyR', durationMs: 400, label: '400ms' },
  { key: 'T', code: 'KeyT', durationMs: 500, label: '500ms' },
  { key: 'Y', code: 'KeyY', durationMs: 600, label: '600ms' },
  { key: 'U', code: 'KeyU', durationMs: 700, label: '700ms' },
  { key: 'I', code: 'KeyI', durationMs: 800, label: '800ms' },
  { key: 'O', code: 'KeyO', durationMs: 900, label: '900ms' },
  { key: 'P', code: 'KeyP', durationMs: 1000, label: '1000ms' },
];

export const THEMES: Record<ThemeId, ThemeMetadata> = {
  0: {
    id: 0,
    key: '0',
    shortLabel: '암전',
    nameKo: '암전 (Blackout)',
    nameEn: 'BLACKOUT',
    subtitle: '완전 암전 · 3D 블라인더 조명 단독 연출',
    accentHex: '#a3a3a3',
    secondaryHex: '#404040',
  },
  1: {
    id: 1,
    key: '1',
    shortLabel: '성당',
    nameKo: '모노리스 성당 & 흑요석 조각',
    nameEn: 'OBSIDIAN CATHEDRAL HALL',
    subtitle: '수직 라이트 필러 · 유광 블랙 천장 조각 · 반사 런웨이',
    accentHex: '#ffffff',
    secondaryHex: '#737373',
  },
  2: {
    id: 2,
    key: '2',
    shortLabel: '토포',
    nameKo: '와이어프레임 토포그래피 룸',
    nameEn: 'WIREFRAME TOPOGRAPHY ROOM',
    subtitle: '3D 격자 와이어 체임버 · 흰색 노드 지형 파동',
    accentHex: '#e5e5e5',
    secondaryHex: '#525252',
  },
  3: {
    id: 3,
    key: '3',
    shortLabel: '타일',
    nameKo: '흑요석 타일 매트릭스 볼트',
    nameEn: 'CARBON TILE MATRIX VAULT',
    subtitle: '정밀 베벨 다크 스퀘어 타일 · 소프트 스포트라이트 그라데이션',
    accentHex: '#d4d4d4',
    secondaryHex: '#404040',
  },
  4: {
    id: 4,
    key: '4',
    shortLabel: '아치',
    nameKo: '브루탈리스트 라이트 콜로네이드',
    nameEn: 'BRUTALIST LIGHT COLONNADE',
    subtitle: '거대 다크 콘크리트 아치 회랑 · 바닥 LED 프레임',
    accentHex: '#f5f5f5',
    secondaryHex: '#525252',
  },
  5: {
    id: 5,
    key: '5',
    shortLabel: '샤드',
    nameKo: '흑요석 파편 필드',
    nameEn: 'SUSPENDED OBSIDIAN SHARDS',
    subtitle: '부유하는 다각형 블랙 크리스탈 · 백색 림 하이라이트',
    accentHex: '#e5e5e5',
    secondaryHex: '#737373',
  },
  6: {
    id: 6,
    key: '6',
    shortLabel: '지오',
    nameKo: '모노크롬 기하학 메가스트럭처',
    nameEn: 'GEODESIC WIREFRAME ATRIUM',
    subtitle: '다층 3D 정다면체 트러스 링 · 중심 코어 레조넌스',
    accentHex: '#ffffff',
    secondaryHex: '#666666',
  },
  7: {
    id: 7,
    key: '7',
    shortLabel: '슬래브',
    nameKo: '키네틱 카본 모놀리스',
    nameEn: 'KINETIC CARBON SLABS',
    subtitle: '3D 부유형 흑연 슬래브 행렬 · 백색 엣지 라이트',
    accentHex: '#d4d4d4',
    secondaryHex: '#404040',
  },
  8: {
    id: 8,
    key: '8',
    shortLabel: '코리더',
    nameKo: '인피니티 프레임 코리더',
    nameEn: 'INFINITY PORTAL CORRIDOR',
    subtitle: '사각 루미너스 프레임 터널 · 습식 미러 플로어',
    accentHex: '#fafafa',
    secondaryHex: '#525252',
  },
  9: {
    id: 9,
    key: '9',
    shortLabel: '화이트',
    nameKo: '전체 화이트 (Whiteout)',
    nameEn: 'FULL WHITEOUT',
    subtitle: '최대 밝기 하이라이트 스테이지',
    accentHex: '#ffffff',
    secondaryHex: '#d4d4d4',
  },
};

const FADE_DURATION_MAP: Record<string, number> = {
  q: 100,
  w: 200,
  e: 300,
  r: 400,
  t: 500,
  y: 600,
  u: 700,
  i: 800,
  o: 900,
  p: 1000,
  KeyQ: 100,
  KeyW: 200,
  KeyE: 300,
  KeyR: 400,
  KeyT: 500,
  KeyY: 600,
  KeyU: 700,
  KeyI: 800,
  KeyO: 900,
  KeyP: 1000,
};

/**
 * Maps a keyboard key or code (Q..P) to its fade duration in milliseconds (100ms..1000ms).
 * Returns null if the key is not a QWERTY fade key.
 */
export function getFadeDurationMs(keyOrCode: string): number | null {
  if (!keyOrCode) return null;
  if (keyOrCode in FADE_DURATION_MAP) {
    return FADE_DURATION_MAP[keyOrCode];
  }
  const lower = keyOrCode.toLowerCase();
  return FADE_DURATION_MAP[lower] ?? null;
}

/**
 * Maps a keyboard key or code ('0'..'9' / 'Digit0'..'Digit9' / 'Numpad0'..'Numpad9') to ThemeId.
 */
export function getThemeIdFromKey(key: string, code?: string): ThemeId | null {
  if (/^[0-9]$/.test(key)) {
    return Number(key) as ThemeId;
  }
  if (code) {
    const match = code.match(/^(?:Digit|Numpad)([0-9])$/);
    if (match) {
      return Number(match[1]) as ThemeId;
    }
  }
  return null;
}

/**
 * Computes the current white fade intensity (0.0 to 1.0) given elapsed milliseconds
 * and target duration. Starts at 1.0 immediately on trigger and smoothly decays to 0.0.
 */
export function computeFadeIntensity(elapsedMs: number, durationMs: number): number {
  if (durationMs <= 0 || elapsedMs < 0 || elapsedMs >= durationMs) {
    return 0;
  }
  const progress = elapsedMs / durationMs; // 0.0 -> 1.0
  const remaining = 1 - progress;
  // Smooth non-linear cubic/quadratic blend for natural stage lamp decay
  return Number((remaining * (0.65 + 0.35 * remaining)).toFixed(4));
}

/**
 * Peak brightness ceiling for Spacebar strobe — intentionally lower than the 1.0 peak
 * of the QWERTY fade effect so strobe stays punchy without blinding overexposure.
 */
export const STROBE_PEAK_INTENSITY = 0.72;

/**
 * Computes the current strobe intensity (0.0 to STROBE_PEAK_INTENSITY) while Spacebar is held.
 * Immediately returns 0 when isHeld is false.
 */
export function computeStrobeIntensity(
  isHeld: boolean,
  elapsedActiveMs: number,
  rateHz: number
): number {
  if (!isHeld || rateHz <= 0 || elapsedActiveMs < 0) {
    return 0;
  }
  const clampedHz = Math.max(1, Math.min(30, rateHz));
  const cycleDurationMs = 1000 / clampedHz;
  const cyclePhase = (elapsedActiveMs % cycleDurationMs) / cycleDurationMs; // 0.0 -> 1.0

  // 42% duty cycle with crisp attack and fast decay within the active half-period
  if (cyclePhase < 0.42) {
    const subPhase = cyclePhase / 0.42;
    const envelope = 1 - subPhase * 0.35;
    return Number((STROBE_PEAK_INTENSITY * envelope).toFixed(4));
  }
  return 0;
}

/**
 * Clamps a BPM value into valid DJ range (40.0 to 240.0 BPM).
 */
export function clampBpm(bpm: number): number {
  if (!Number.isFinite(bpm)) return 128;
  return Math.max(40, Math.min(240, Math.round(bpm * 10) / 10));
}

/**
 * Computes effective BPM when pitch bend (-1, 0, +1) is held.
 * Uses +/- 4.0% pitch bend (like CDJ/Rekordbox tempo nudge).
 */
export function computeEffectiveBpm(
  baseBpm: number,
  pitchBend: PitchBendDirection,
  bendPercent = 6
): number {
  const validBase = clampBpm(baseBpm);
  if (pitchBend === 0) return validBase;
  const factor = 1 + (pitchBend * bendPercent) / 100;
  return Math.round(validBase * factor * 10) / 10;
}

/**
 * Advances the normalized beat phase (0.0 -> 1.0) and total beat count based on deltaTimeMs.
 */
export function stepBeatPhase(
  currentPhase: number,
  currentBeatCount: number,
  deltaTimeMs: number,
  effectiveBpm: number
): { phase: number; beatCount: number; beatTriggered: boolean } {
  if (deltaTimeMs <= 0 || effectiveBpm <= 0) {
    return { phase: currentPhase, beatCount: currentBeatCount, beatTriggered: false };
  }
  const beatsPerMs = effectiveBpm / 60000;
  const rawPhase = currentPhase + deltaTimeMs * beatsPerMs;
  const wholeBeatsPassed = Math.floor(rawPhase);
  const nextPhase = rawPhase - wholeBeatsPassed;

  return {
    phase: nextPhase,
    beatCount: currentBeatCount + wholeBeatsPassed,
    beatTriggered: wholeBeatsPassed > 0,
  };
}

/**
 * Computes the visual beat pulse (0.0 to 1.0) given the beat phase (0.0 to 1.0)
 * and whether Auto BPM mode is enabled.
 */
export function computeBeatPulse(beatPhase: number, autoBpmEnabled: boolean): number {
  if (!autoBpmEnabled) return 0;
  const normalized = ((beatPhase % 1) + 1) % 1;
  // Crisp kick-drum attack at phase=0, decaying exponentially across the beat
  return Number(Math.pow(1 - normalized, 2.8).toFixed(4));
}

/**
 * Computes average BPM from an array of tap timestamps (in milliseconds).
 * Ignores intervals longer than 2500ms (reset threshold).
 */
export function computeTapTempoBpm(tapTimestampsMs: number[]): number | null {
  if (tapTimestampsMs.length < 2) return null;

  const recent = tapTimestampsMs.slice(-8);
  const intervals: number[] = [];

  for (let i = 1; i < recent.length; i++) {
    const diff = recent[i] - recent[i - 1];
    if (diff > 200 && diff <= 2200) {
      intervals.push(diff);
    }
  }

  if (intervals.length === 0) return null;
  const avgIntervalMs = intervals.reduce((acc, v) => acc + v, 0) / intervals.length;
  return clampBpm(60000 / avgIntervalMs);
}

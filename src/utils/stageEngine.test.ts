import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getFadeDurationMs,
  getThemeIdFromKey,
  computeFadeIntensity,
  computeStrobeIntensity,
  STROBE_PEAK_INTENSITY,
  computeEffectiveBpm,
  stepBeatPhase,
  computeBeatPulse,
  computeTapTempoBpm,
  THEMES,
} from './stageEngine';

test('theme mapping covers 0-9 keys and numpad codes', () => {
  for (let i = 0; i <= 9; i++) {
    assert.equal(getThemeIdFromKey(String(i)), i);
    assert.equal(getThemeIdFromKey('', `Digit${i}`), i);
    assert.equal(getThemeIdFromKey('', `Numpad${i}`), i);
    assert.ok(THEMES[i as keyof typeof THEMES]);
  }
  assert.equal(getThemeIdFromKey('a'), null);
});

test('QWERTY fade keys map monotonically from Q (100ms) to P (1000ms)', () => {
  const keys = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'];
  let prev = 0;
  keys.forEach((k, idx) => {
    const duration = getFadeDurationMs(k);
    assert.equal(duration, (idx + 1) * 100);
    assert.ok(duration! > prev);
    prev = duration!;
  });
  assert.equal(getFadeDurationMs('KeyQ'), 100);
  assert.equal(getFadeDurationMs('KeyP'), 1000);
  assert.equal(getFadeDurationMs('KeyA'), null);
});

test('computeFadeIntensity starts at 1.0 and decays smoothly to 0 at duration', () => {
  assert.equal(computeFadeIntensity(0, 500), 1);
  const mid = computeFadeIntensity(250, 500);
  assert.ok(mid > 0.3 && mid < 0.7);
  assert.equal(computeFadeIntensity(500, 500), 0);
  assert.equal(computeFadeIntensity(600, 500), 0);
});

test('computeStrobeIntensity respects hold state and keeps peak brightness below fade peak', () => {
  assert.equal(computeStrobeIntensity(false, 10, 10), 0);
  const activePeak = computeStrobeIntensity(true, 0, 10);
  assert.equal(activePeak, STROBE_PEAK_INTENSITY);
  assert.ok(activePeak < 1.0, 'Strobe peak must be slightly lower than full 1.0 white fade');
  // Off phase of the 10Hz (100ms period) cycle at 60ms
  assert.equal(computeStrobeIntensity(true, 60, 10), 0);
});

test('pitch bend temporarily decelerates (-) or accelerates (+) effective BPM and restores on release', () => {
  const base = 128;
  const slowed = computeEffectiveBpm(base, -1, 6);
  const spedUp = computeEffectiveBpm(base, 1, 6);
  const restored = computeEffectiveBpm(base, 0, 6);

  assert.ok(slowed < base);
  assert.ok(spedUp > base);
  assert.equal(restored, base);
});

test('stepBeatPhase advances phase accurately and triggers beat wrap', () => {
  // At 120 BPM, 1 beat = 500ms
  const step1 = stepBeatPhase(0, 0, 250, 120);
  assert.equal(step1.phase, 0.5);
  assert.equal(step1.beatCount, 0);
  assert.equal(step1.beatTriggered, false);

  const step2 = stepBeatPhase(step1.phase, step1.beatCount, 300, 120);
  assert.ok(Math.abs(step2.phase - 0.1) < 0.001);
  assert.equal(step2.beatCount, 1);
  assert.equal(step2.beatTriggered, true);
});

test('computeBeatPulse returns 0 in Manual (Off) mode and decays in Auto (BPM) mode', () => {
  assert.equal(computeBeatPulse(0, false), 0);
  assert.equal(computeBeatPulse(0, true), 1);
  assert.ok(computeBeatPulse(0.2, true) < 0.6);
});

test('computeTapTempoBpm calculates accurate BPM from tap timestamps', () => {
  // 500ms intervals = 120 BPM
  const bpm = computeTapTempoBpm([1000, 1500, 2000, 2500]);
  assert.equal(bpm, 120);
  assert.equal(computeTapTempoBpm([1000]), null);
});

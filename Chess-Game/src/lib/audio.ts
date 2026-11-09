/**
 * Sound effects for the board.
 *
 * The sounds are synthesised with the Web Audio API rather than loaded from
 * files: a short oscillator burst per event keeps the bundle small and the
 * sounds tuneable in one place.
 *
 * The context is created lazily on the first sound, because browsers refuse
 * to start audio before the user has interacted with the page.
 */

/** The sounds the game can play. */
export type SoundName = 'move' | 'capture' | 'check' | 'castle' | 'gameover';

let audioContext: AudioContext | null = null;
let enabled = true;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioContext) {
    const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    audioContext = new Ctor();
  }
  // A context suspended by the browser is resumed on the next user gesture.
  if (audioContext.state === 'suspended') {
    void audioContext.resume();
  }
  return audioContext;
}

/** Turn the sound on or off. */
export function setSoundEnabled(value: boolean): void {
  enabled = value;
}

/** True when sound is on. */
export function isSoundEnabled(): boolean {
  return enabled;
}

/**
 * Play a short tone.
 *
 * @param frequency The pitch in hertz.
 * @param duration The length in seconds.
 * @param type The oscillator waveform.
 * @param gain The peak volume.
 */
function tone(
  context: AudioContext,
  frequency: number,
  duration: number,
  type: OscillatorType,
  gain: number,
  delay = 0,
): void {
  const start = context.currentTime + delay;
  const oscillator = context.createOscillator();
  const amplifier = context.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);

  // A quick attack and a smooth decay, so the tone reads as a strike rather
  // than a click.
  amplifier.gain.setValueAtTime(0, start);
  amplifier.gain.linearRampToValueAtTime(gain, start + 0.008);
  amplifier.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  oscillator.connect(amplifier);
  amplifier.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

/**
 * Play a sound effect.
 *
 * Does nothing when sound is disabled or the browser has no audio support.
 */
export function playSound(name: SoundName): void {
  if (!enabled) return;
  const context = getContext();
  if (!context) return;

  switch (name) {
    case 'move':
      tone(context, 320, 0.08, 'triangle', 0.16);
      break;
    case 'capture':
      tone(context, 180, 0.14, 'square', 0.16);
      tone(context, 120, 0.18, 'triangle', 0.12, 0.03);
      break;
    case 'check':
      tone(context, 660, 0.1, 'triangle', 0.16);
      tone(context, 880, 0.14, 'triangle', 0.14, 0.09);
      break;
    case 'castle':
      tone(context, 260, 0.09, 'sine', 0.14);
      tone(context, 390, 0.12, 'sine', 0.14, 0.07);
      break;
    case 'gameover':
      tone(context, 392, 0.18, 'triangle', 0.16);
      tone(context, 311, 0.18, 'triangle', 0.16, 0.16);
      tone(context, 261, 0.34, 'triangle', 0.16, 0.32);
      break;
  }
}

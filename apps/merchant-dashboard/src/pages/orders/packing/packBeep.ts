/**
 * The "no" sound of the scan-to-pack page: two short low tones made with the
 * Web Audio API (no audio file). A scanner chirps high on every read, so a low
 * double tone stands out as "wrong item" or "one too many". Silent when the
 * browser has no Web Audio or refuses to play: the page says the same in text.
 */

let context: AudioContext | null = null;

export function packBeep(kind: "wrong" | "over") {
  try {
    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    context ??= new Ctor();
    const ctx = context;
    // Created or resumed on a key press (the scan itself), which browsers accept as a gesture.
    if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
    const tones = kind === "wrong" ? [220, 165] : [294, 294];
    tones.forEach((frequency, i) => {
      const start = ctx.currentTime + i * 0.17;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "square";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.12, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.14);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.15);
    });
  } catch {
    /* refused: the red banner and its words still tell the packer */
  }
}

export class Svf {
  low = 0;
  band = 0;
  high = 0;
  private ic1 = 0;
  private ic2 = 0;

  constructor(private readonly sampleRate: number) {}

  process(input: number, cutoff: number, q: number): void {
    const nyquistSafe = Math.min(cutoff, this.sampleRate * 0.45);
    const g = Math.tan((Math.PI * nyquistSafe) / this.sampleRate);
    const k = 1 / q;
    const a1 = 1 / (1 + g * (g + k));
    const a2 = g * a1;
    const a3 = g * a2;
    const v3 = input - this.ic2;
    const v1 = a1 * this.ic1 + a2 * v3;
    const v2 = this.ic2 + a2 * this.ic1 + a3 * v3;
    this.ic1 = 2 * v1 - this.ic1;
    this.ic2 = 2 * v2 - this.ic2;
    this.low = v2;
    this.band = v1;
    this.high = input - k * v1 - v2;
  }
}

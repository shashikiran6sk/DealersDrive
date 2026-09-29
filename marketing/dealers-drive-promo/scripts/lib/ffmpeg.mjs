import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

function locate() {
  if (process.env.FFMPEG && existsSync(process.env.FFMPEG)) return process.env.FFMPEG;
  try {
    const bundled = execFileSync(
      'python3',
      ['-c', 'import imageio_ffmpeg as f; print(f.get_ffmpeg_exe())'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim();
    if (bundled && existsSync(bundled)) return bundled;
  } catch {
    // fall through to PATH
  }
  return 'ffmpeg';
}

export const FFMPEG = locate();

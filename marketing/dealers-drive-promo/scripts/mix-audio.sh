#!/usr/bin/env bash
# Mixes a recorded voice-over and a licensed music bed into a rendered export.
#   npm run mix -- --in=exports/dealers-drive-promo-4k.mp4
# Reads assets/audio/voiceover.wav and assets/audio/music.wav (either may be
# absent). Music is ducked under the voice and the result normalised to
# -14 LUFS, the level most social platforms play back at.
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
in=""
for arg in "$@"; do case "$arg" in --in=*) in="${arg#--in=}" ;; esac; done
[ -n "$in" ] || { echo "usage: mix-audio.sh --in=<video.mp4>"; exit 1; }
ffmpeg="${FFMPEG:-$(python3 -c 'import imageio_ffmpeg as f; print(f.get_ffmpeg_exe())' 2>/dev/null || echo ffmpeg)}"
vo="$here/assets/audio/voiceover.wav"
music="$here/assets/audio/music.wav"
out="${in%.mp4}-mixed.mp4"

norm="loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000,apad"
dur="$({ "$ffmpeg" -i "$in" 2>&1 || true; } | awk '/Duration/ { split($2, t, ":"); gsub(",", "", t[3]); print t[1] * 3600 + t[2] * 60 + t[3]; exit }')"
if [ -f "$vo" ] && [ -f "$music" ]; then
  "$ffmpeg" -y -i "$in" -i "$vo" -stream_loop -1 -i "$music" -filter_complex \
    "[1:a]asplit=2[v1][v2];[2:a]volume=0.35[m];[m][v1]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400[duck];[duck][v2]amix=inputs=2:duration=longest:normalize=0,$norm[a]" \
    -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 256k -t "$dur" -movflags +faststart "$out"
elif [ -f "$vo" ]; then
  "$ffmpeg" -y -i "$in" -i "$vo" -filter_complex "[1:a]$norm[a]" \
    -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 256k -t "$dur" -movflags +faststart "$out"
elif [ -f "$music" ]; then
  "$ffmpeg" -y -i "$in" -stream_loop -1 -i "$music" -filter_complex "[1:a]volume=0.8,$norm[a]" \
    -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 256k -t "$dur" -movflags +faststart "$out"
else
  echo "No audio in $here/assets/audio — add voiceover.wav and/or music.wav."
  exit 1
fi
echo "Wrote $out"

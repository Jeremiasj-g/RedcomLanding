export const hmsToSeconds = (hms: string) => {
  const s = String(hms ?? '0:00:00').trim();
  const [h, m, sec] = s.split(':').map((x) => parseInt(x, 10) || 0);
  return h * 3600 + m * 60 + sec;
};

export const secondsToHms = (seconds: number) => {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

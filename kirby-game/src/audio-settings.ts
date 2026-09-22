type Channel = 'music' | 'sounds';
export function readAudioSettings(channel: Channel, defaultVolume: number) {
  const result = { enabled: true, volume: defaultVolume };
  try {
    const saved = JSON.parse(localStorage.getItem(`kirby.audio.${channel}`) ?? 'null');
    if (typeof saved?.enabled === 'boolean') result.enabled = saved.enabled;
    if (typeof saved?.volume === 'number' && Number.isFinite(saved.volume)) result.volume = Math.max(0, Math.min(1, saved.volume));
  } catch { /* Storage may be unavailable or contain outdated data. */ }
  return result;
}
export function saveAudioSettings(channel: Channel, enabled: boolean, volume: number) {
  try { localStorage.setItem(`kirby.audio.${channel}`, JSON.stringify({ enabled, volume })); }
  catch { /* Audio controls still work when storage is unavailable. */ }
}

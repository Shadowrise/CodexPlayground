import { readAudioSettings, saveAudioSettings } from './audio-settings';
export const MUSIC_TRACKS = [
  ['meadow-day', 'День на поляне'],
  ['citrus-walk', 'Цитрусовая прогулка'],
  ['mint-breeze', 'Мятный ветерок'],
  ['berry-dance', 'Ягодный танец'],
  ['cloud-picnic', 'Пикник на облаках'],
  ['sunny-path', 'Солнечная тропинка'],
  ['firefly-waltz', 'Огоньки светлячков'],
  ['lagoon-bossa', 'Лазурная лагуна'],
  ['carousel-waltz', 'Вальс карусели'],
  ['button-swing', 'Пуговичный свинг'],
  ['kite-festival', 'Праздник воздушных змеев'],
  ['coconut-bay', 'Кокосовая бухта'],
  ['roller-disco', 'Роликовое диско'],
  ['wish-lanterns', 'Фонарики желаний'],
] as const;

/** Fourteen sequential tracks, starting at a random position each session. */
export class BackgroundMusic {
  private readonly audio = new Audio();
  private enabled = true;
  private started = false;
  private track = Math.floor(Math.random() * MUSIC_TRACKS.length);
  private playRequest = 0;

  constructor(private readonly button: HTMLButtonElement, volume: HTMLInputElement,
    previous: HTMLButtonElement, next: HTMLButtonElement, private readonly trackLabel: HTMLElement) {
    this.audio.preload = 'none';
    const saved = readAudioSettings('music', .25);
    this.enabled = saved.enabled;
    this.audio.volume = saved.volume;
    volume.value = String(Math.round(saved.volume * 100));
    this.loadTrack();
    previous.addEventListener('click', () => this.skip(-1));
    next.addEventListener('click', () => this.skip(1));
    this.audio.addEventListener('ended', () => this.skip(1));
    button.addEventListener('click', () => {
      this.enabled = !this.enabled;
      saveAudioSettings('music', this.enabled, this.audio.volume);
      if (this.enabled) void this.play(); else { this.playRequest++; this.audio.pause(); }
      this.updateButton();
    });
    volume.addEventListener('input', () => {
      this.audio.volume = Number(volume.value) / 100;
      saveAudioSettings('music', this.enabled, this.audio.volume);
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { this.playRequest++; this.audio.pause(); }
      else if (this.started && this.enabled) void this.play();
    });
    this.audio.addEventListener('error', () => {
      this.enabled = false;
      this.updateButton();
      this.button.title = 'Не удалось загрузить музыку. Нажмите, чтобы повторить.';
    });
    this.updateButton();
  }

  start() { this.started = true; if (this.enabled) void this.play(); }

  private skip(direction: number) {
    this.track = (this.track + direction + MUSIC_TRACKS.length) % MUSIC_TRACKS.length;
    this.loadTrack();
    if (this.enabled) void this.play();
  }

  private loadTrack() {
    this.playRequest++;
    this.audio.pause();
    this.audio.src = `${import.meta.env?.BASE_URL ?? '/'}audio/${MUSIC_TRACKS[this.track][0]}.wav`;
    this.audio.loop = false;
    this.trackLabel.textContent = `${this.track + 1} / ${MUSIC_TRACKS.length} · ${MUSIC_TRACKS[this.track][1]}`;
  }

  private async play() {
    if (!this.started || !this.enabled || document.hidden) return;
    const request = ++this.playRequest;
    try { await this.audio.play(); }
    catch { if (request === this.playRequest) this.enabled = false; }
    this.updateButton();
  }

  private updateButton() {
    this.button.textContent = this.enabled ? '♫ Музыка: вкл' : '♫ Музыка: выкл';
    this.button.setAttribute('aria-pressed', String(this.enabled));
    this.button.title = this.enabled ? 'Выключить фоновую музыку' : 'Включить фоновую музыку';
  }
}

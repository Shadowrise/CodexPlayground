import {t,onLocaleChange} from './i18n';
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
  ['accordion-stroll', 'Лёгкий аккордеон'],
] as const;

const MUSIC_ASSET_REVISIONS: Partial<Record<typeof MUSIC_TRACKS[number][0], string>> = {
  'meadow-day': 'acoustic-20261021',
  'button-swing': '2',
};

/** Sequential tracks, starting at a random position each session. */
export class BackgroundMusic {
  private readonly audio = new Audio();
  private eventAudio?:HTMLAudioElement;
  private eventActive:boolean|'celebrate'|'knight'=false;
  private enabled = true;
  private volume = .25;
  private mix = 1;
  private started = false;
  private track = Math.floor(Math.random() * MUSIC_TRACKS.length);
  private playRequest = 0;

  constructor(private readonly button: HTMLButtonElement, volume: HTMLInputElement,
    previous: HTMLButtonElement, next: HTMLButtonElement, private readonly trackLabel: HTMLElement) {
    this.audio.preload = 'none';
    const saved = readAudioSettings('music', .25);
    this.enabled = saved.enabled;
    this.volume = saved.volume;
    this.applyVolume();
    volume.value = String(Math.round(saved.volume * 100));
    this.loadTrack();
    previous.addEventListener('click', () => this.skip(-1));
    next.addEventListener('click', () => this.skip(1));
    this.audio.addEventListener('ended', () => this.skip(1));
    button.addEventListener('click', () => {
      this.enabled = !this.enabled;
      saveAudioSettings('music', this.enabled, this.volume);
      if (this.enabled) void this.play(); else { this.playRequest++; this.audio.pause();this.eventAudio?.pause(); }
      this.updateButton();
    });
    volume.addEventListener('input', () => {
      this.volume = Number(volume.value) / 100;
      this.applyVolume();
      saveAudioSettings('music', this.enabled, this.volume);
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { this.playRequest++; this.audio.pause();this.eventAudio?.pause(); }
      else if (this.started && this.enabled) void this.play();
    });
    this.audio.addEventListener('error', () => {
      this.enabled = false;
      this.updateButton();
      this.button.title = t('Не удалось загрузить музыку. Нажмите, чтобы повторить.');
    });
    this.updateButton();
    onLocaleChange(()=>{this.updateButton();this.updateTrackLabel();});
  }

  /** Temporary attenuation on the existing frame clock; the saved slider value stays intact. */
  updateDucking(ducked:boolean,dt:number){
    const target=ducked?.2:1;
    if(this.mix===target)return;
    this.mix+=(target-this.mix)*(1-Math.exp(-Math.max(0,dt)/(ducked?.09:.3)));
    if(Math.abs(this.mix-target)<.001)this.mix=target;
    this.applyVolume();
  }
  /** Preserve pitch while the final duel phase gradually gains tempo. */
  updateKnightPhase(phase:number,dt:number){
    const audio=this.eventAudio;if(!audio||this.eventActive!=='knight')return;
    audio.preservesPitch=true;const target=phase===3?1.10:1;
    const rate=audio.playbackRate+(target-audio.playbackRate)*(1-Math.exp(-Math.max(0,dt)/.65));
    audio.playbackRate=Math.abs(rate-target)<.0005?target:rate;
  }
  private applyVolume(){
    this.audio.volume=this.volume*this.mix;
    if(this.eventAudio)this.eventAudio.volume=this.audio.volume;
  }

  /** Event soundtrack follows the same saved music toggle and volume. */
  setEvent(active:boolean|'celebrate'|'knight'){
    if(active===this.eventActive)return;
    this.playRequest++;this.audio.pause();this.eventAudio?.pause();this.eventActive=active;
    if(active&&!this.eventAudio){
      const event=this.eventAudio=new Audio();event.preload='none';event.volume=this.audio.volume;
      event.addEventListener('error',()=>{this.eventActive=false;if(this.enabled)void this.play();});
    }
    if(this.eventAudio)this.eventAudio.playbackRate=1;
    if(active&&this.eventAudio){this.eventAudio.loop=active!=='celebrate';const file=active==='knight'?'meta-knight-duel':`topotushka-${active==='celebrate'?'victory':'play'}`;this.eventAudio.src=`${import.meta.env?.BASE_URL??'/'}audio/${file}.wav`;}
    this.updateTrackLabel();
    if(this.enabled)void this.play();
  }
  start() { this.started = true; if (this.enabled) void this.play(); }
  stop() { this.started=false;this.playRequest++;this.audio.pause();this.eventAudio?.pause();this.eventActive=false;this.mix=1;this.applyVolume(); }

  private skip(direction: number) {
    this.track = (this.track + direction + MUSIC_TRACKS.length) % MUSIC_TRACKS.length;
    this.loadTrack();
    if (this.enabled) void this.play();
  }

  private loadTrack() {
    this.playRequest++;
    this.audio.pause();
    const file = MUSIC_TRACKS[this.track][0];
    const revision = MUSIC_ASSET_REVISIONS[file];
    this.audio.src = `${import.meta.env?.BASE_URL ?? '/'}audio/${file}.wav${revision ? `?v=${revision}` : ''}`;
    this.audio.loop = false;
    this.updateTrackLabel();
  }
  private updateTrackLabel(){this.trackLabel.textContent=this.eventActive==='knight'?t('Галаксия — Рыцарь звёзд'):`${this.track+1} / ${MUSIC_TRACKS.length} · ${t(MUSIC_TRACKS[this.track][1])}`;}

  private async play() {
    if (!this.started || !this.enabled || document.hidden) return;
    const request = ++this.playRequest;
    try { await (this.eventActive?this.eventAudio!:this.audio).play(); }
    catch { if (request === this.playRequest) this.enabled = false; }
    this.updateButton();
  }

  private updateButton() {
    this.button.textContent = t(this.enabled ? '♫ Музыка: вкл' : '♫ Музыка: выкл');
    this.button.setAttribute('aria-pressed', String(this.enabled));
    this.button.title = t(this.enabled ? 'Выключить фоновую музыку' : 'Включить фоновую музыку');
  }
}

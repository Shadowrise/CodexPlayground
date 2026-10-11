export const TUTORIAL_KEY='kirby-tutorial-completed-v1';
export const TUTORIAL_STEPS=['welcome','score','interact','adventures','route','chat','good-luck'] as const;
export type TutorialStep=typeof TUTORIAL_STEPS[number];
export type TutorialScheme='keyboard'|'gamepad'|'touch';

/** Browser-local onboarding; unavailable storage must never interrupt the game. */
export class TutorialProgress {
 active=false;completed=false;index=0;
 constructor(private storage?:Pick<Storage,'getItem'|'setItem'>){
  try{this.completed=storage?.getItem(TUTORIAL_KEY)==='1';}catch{}
 }
 get step(){return TUTORIAL_STEPS[this.index];}
 start(force=false){if(this.completed&&!force)return false;this.index=0;this.active=true;return true;}
 next(){if(!this.active)return;if(this.index<TUTORIAL_STEPS.length-1)this.index++;else this.finish();}
 skip(){if(this.active)this.finish();}
 cancel(){this.active=false;}
 private finish(){this.active=false;this.completed=true;try{this.storage?.setItem(TUTORIAL_KEY,'1');}catch{}}
}

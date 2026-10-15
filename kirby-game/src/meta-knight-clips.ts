/** Shared names and playback rules for the GLB, controller and workshop. */
export const META_KNIGHT_CLIPS = [
  {name:'Idle',label:'Ожидание',group:'movement',duration:2.8,loop:true},
  {name:'Walk',label:'Ходьба',group:'movement',duration:1.04,loop:true},
  {name:'Run',label:'Бег',group:'movement',duration:.72,loop:true},
  {name:'WalkBackward',label:'Шаг назад',group:'movement',duration:1.2,loop:true},
  {name:'RotateLeft',label:'Поворот влево',group:'movement',duration:.8,loop:false},
  {name:'RotateRight',label:'Поворот вправо',group:'movement',duration:.8,loop:false},
  {name:'Jump',label:'Прыжок',group:'movement',duration:1.05,loop:false},
  {name:'Fly',label:'Полёт',group:'movement',duration:.9,loop:true},
  {name:'Swim',label:'Плавание',group:'movement',duration:1.6,loop:true},
  {name:'Push',label:'Выпад мечом',group:'actions',duration:.62,loop:false},
  {name:'Attack',label:'Взмах мечом',group:'actions',duration:.85,loop:false},
  {name:'Eat',label:'Ест фрукт',group:'actions',duration:1.5,loop:false},
  {name:'Death',label:'Сбит с ног',group:'actions',duration:1.1,loop:false},
  {name:'Roll',label:'Перекат',group:'actions',duration:.95,loop:true},
  {name:'Sitting',label:'На лавочке',group:'rides',duration:3.2,loop:true},
  {name:'Swing',label:'На качелях',group:'rides',duration:2.8,loop:true},
  {name:'Cart',label:'В вагонетке',group:'rides',duration:2.4,loop:true},
  {name:'Boat',label:'В лодочке',group:'rides',duration:3.2,loop:true},
  {name:'Balloon',label:'В корзине шара',group:'rides',duration:3.2,loop:true},
  {name:'FireflyRide',label:'На светлячке',group:'rides',duration:2.4,loop:true},
  {name:'Sleep',label:'Сон',group:'rides',duration:4.2,loop:true},
  {name:'Wake',label:'Просыпается',group:'rides',duration:2.2,loop:false},
  {name:'Climb',label:'Подъём',group:'rides',duration:1.3,loop:true},
  {name:'Lookout',label:'На смотровой площадке',group:'rides',duration:4.2,loop:true},
  {name:'LeafDive',label:'В куче листьев',group:'rides',duration:1.5,loop:true},
  {name:'Trampoline',label:'На батуте',group:'rides',duration:1.15,loop:true},
  {name:'Hello',label:'Привет',group:'emotions',duration:2.7,loop:false},
  {name:'Joy',label:'Радость',group:'emotions',duration:2.4,loop:false},
  {name:'Fear',label:'Испуг',group:'emotions',duration:2.4,loop:false},
  {name:'Anger',label:'Гнев',group:'emotions',duration:2.4,loop:false},
  {name:'Sad',label:'Грусть',group:'emotions',duration:2.4,loop:false},
] as const;

export type MetaKnightClipName = typeof META_KNIGHT_CLIPS[number]['name'];
export const META_KNIGHT_CLIP_BY_NAME = Object.fromEntries(META_KNIGHT_CLIPS.map(clip => [clip.name,clip])) as Record<MetaKnightClipName,typeof META_KNIGHT_CLIPS[number]>;
export const META_KNIGHT_CLIP_GROUPS = {movement:'Движения',actions:'Действия',rides:'Позы и развлечения',emotions:'Эмоции'} as const;

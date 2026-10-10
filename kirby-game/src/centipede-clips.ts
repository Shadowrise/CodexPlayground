export const CENTIPEDE_CLIPS=[
 {name:'Idle',label:'Отдыхает',phase:0,duration:4,loop:true,description:'Дышит, моргает и шевелит усиками.'},
 {name:'Walk',label:'Идёт',phase:1,duration:2,loop:true,description:'Волна шагов проходит по всем башмачкам.'},
 {name:'Run',label:'Бежит',phase:1,duration:1.2,loop:true,description:'Быстрый перебор лапок и изгибы тела.'},
 {name:'TurnLeft',label:'Поворот влево',phase:1,duration:3.2,loop:false,description:'Голова начинает поворот, хвост следует за ней.'},
 {name:'TurnRight',label:'Поворот вправо',phase:1,duration:3.2,loop:false,description:'Плавный поворот всем телом.'},
 {name:'ChargeAnticipation',label:'Готовит рывок',phase:1,duration:1.4,loop:false,description:'Приподнимает голову, набирает воздух и приседает.'},
 {name:'Charge',label:'Рывок',phase:1,duration:.8,loop:true,description:'Вытягивается и быстро перебирает лапками.'},
 {name:'Exhausted',label:'Переводит дух',phase:1,duration:2.4,loop:true,description:'Хвостовой бубенчик открыт для толчка.'},
 {name:'TailTickle',label:'Щекотно!',phase:1,duration:2,loop:false,description:'Прыжок от щекотки и волна подскакивающих башмачков.'},
 {name:'CoilArena',label:'Сворачивается вокруг арены',phase:2,duration:2.4,loop:false,description:'Сворачивает тело в широкую горизонтальную дугу.'},
 {name:'Stomp',label:'Топочет',phase:2,duration:2.4,loop:true,description:'Два заметных замаха лапками и удара о землю.'},
 {name:'LowerBack',label:'Опускает спину',phase:2,duration:1.8,loop:false,description:'Сегменты выстраиваются в короткую лестницу к колокольчику.'},
 {name:'BackVulnerable',label:'Лестница к колокольчику',phase:2,duration:3,loop:true,description:'Стоит смирно, чтобы Кирби мог забраться по спине.'},
 {name:'BellHit',label:'Колокольчик звенит',phase:2,duration:1.4,loop:false,description:'Вздрагивает и смешно встряхивается.'},
 {name:'Rise',label:'Снова поднимается',phase:2,duration:1.8,loop:false,description:'Возвращается из лестницы в дугу для топота.'},
 {name:'CurlWheel',label:'Сворачивается колесом',phase:3,duration:2.4,loop:false,description:'Поджимает лапки и сворачивается в вертикальное колесо.'},
 {name:'WheelRoll',label:'Большой перекат',phase:3,duration:2,loop:true,description:'Полный оборот колеса; перемещение по арене задаётся игрой.'},
 {name:'WheelDizzy',label:'Кружится голова',phase:3,duration:2.4,loop:true,description:'Качается после переката, бубенчик доступен для мяча.'},
 {name:'WheelHit',label:'Мяч попал!',phase:3,duration:1.2,loop:false,description:'Колесо пружинит, башмачки раскрываются веером.'},
 {name:'Uncurl',label:'Разворачивается',phase:3,duration:2.4,loop:false,description:'Возвращается из колеса на все лапки.'},
 {name:'Sneeze',label:'Победное апчхи',phase:3,duration:2.6,loop:false,description:'Набирает воздух и чихает — момент для будущего конфетти.'},
 {name:'Celebrate',label:'Добрый финал',phase:3,duration:4,loop:true,description:'Улыбается и танцует после победы игроков.'},
] as const;
export type CentipedeClip=typeof CENTIPEDE_CLIPS[number]['name'];
/** Gameplay hooks for the later boss controller; seconds inside each clip. */
export const CENTIPEDE_MARKERS={ChargeAnticipation:{warning:.25,ready:1.3},TailTickle:{bounce:.5},Stomp:{wave1:.72,wave2:1.92},BellHit:{bell:.2},WheelHit:{impact:.16},Sneeze:{confetti:1.45}};
export const CENTIPEDE_PHASE_DEMOS:CentipedeClip[][]=[
 ['Walk','Run','ChargeAnticipation','Charge','Exhausted','TailTickle'],
 ['CoilArena','Stomp','Stomp','LowerBack','BackVulnerable','BellHit','Rise'],
 ['CurlWheel','WheelRoll','WheelRoll','WheelDizzy','WheelHit','Uncurl','Sneeze','Celebrate'],
];

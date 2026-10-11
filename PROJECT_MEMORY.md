# Память проекта Kirby

## Щелчки шагов в Firefox: воспроизведены и исправлены — 2026-10-03

Предыдущие оптимизации/тени/удаление музыки опубликованы коммитом `29f2b10`
в origin/main. Новый звуковой фикс ниже пока локальный.

Пользователь сообщил: любой голос/эффект щёлкает поверх шагов, при ходьбе хуже,
чем при спринте. Уточнил: только Firefox, в Chrome чисто. Причина подтверждена
реальным браузерным тестом Firefox157: шаги проходят через StereoPanner, прочие
звуки часто mono. GainNode по умолчанию max, compressor clamped-max: подключение
и удаление шагов переключало общий тракт 1↔2 канала. Firefox при этом пересоздаёт
DynamicsCompressor и теряет содержимое look-ahead, обрывая ВСЕ текущие эффекты.
Источник: https://searchfox.org/firefox-main/source/dom/media/webaudio/DynamicsCompressorNode.cpp
в ProcessBlock при смене channelCount создаётся новый компрессор.

- Новый `src/sound-output.ts`: общий stereo bus, channelCount=2,
  channelCountMode=explicit, channelInterpretation=speakers на master/headroom/
  limiter. `sfx.ts` использует эту функцию при создании контекста.
- Громкости, threshold/knee/ratio/attack/release, синтез шагов/эмоций и панорама
  не менялись. Не возвращать очередное приглушение как решение этого бага.
- `scripts/audio-mix-browser.mjs`: тест реального AudioContext, без GPU-сцены
  и без вывода звука в динамики. Тихий постоянный mono сигнал + почти неслышные
  stereo подключения/отключения, регистрация через ScriptProcessor (только тест).
  В production нет ScriptProcessor, фонового пробного тона, таймеров или записи.
- Firefox: старый mono контроль —0 провалов; старый смешанный тракт —5120
  провалившихся samples из76800, скачок .035917; исправленный —0 провалов,
  max скачок0. Chrome154 во всех трёх случаях0. Значит причина изолирована
  от clipping, волн шагов, FPS сцены и громкости.
- Запуск: Vite5173, `node scripts/audio-mix-browser.mjs` (Chrome), либо
  PowerShell `$env:AUDIO_BROWSER='firefox'; node scripts/audio-mix-browser.mjs`.
  Firefox запускается headless с отдельным временным профилем, пользовательский
  профиль не изменяется. Временные профили остаются в TEMP, процесс закрывается.
- 8 tests sound-events/audio-settings/water-sounds и production build прошли.
  Пользователю осталось оценить исправленную игру в своём Firefox; локальный
  браузерный тест подтвердил исчезновение именно воспроизведённых разрывов.

## Удаление двух мелодий — 2026-10-03

Пользователь подтвердил, что последние изменения теней «гораздо лучше».
По его просьбе удалены «Игрушечный парад» (toy-parade) и «Свет калимбы»
(kalimba-glow): записи плейлиста, WAV-файлы и рецепты в make-light-music.cjs.
В игре теперь 16 треков. «Лёгкий аккордеон» и «Свист у берега» сохранены
без изменения аудио; теперь это позиции 15 и 16. Старое описание 18 треков
ниже — история. Публикации этих локальных изменений пока не было.

## Дополнительная экономия и стабильность теней — 2026-10-03

После PCFSoft пользователь отметил небольшую просадку FPS и остаточное мерцание
краёв. Не считать прежний локальный Chrome-замер доказательством отсутствия
регрессии на его Firefox. Проверены варианты в опциональном профайлере:
512 для дальней карты и PCF radius=1 не дали устойчивого выигрыша; НЕ включены.

Новые локальные изменения:
- Дальность CSM 300→200 метров, прежние 2×1024 карты, PCFSoft, fade, normalBias.
  Более плотные тексели вокруг камеры, меньше дальних casters. Компромисс:
  дальние тени плавно исчезают раньше, дальность самих объектов не меняется.
- `stable-shadows.ts`: StableCSM расширяет штатный CSM. Сохраняет fitting
  фрустумов/привязку к целым текселям, но использует up, перпендикулярный орбите
  солнца (-.4,0,.85), для расчёта карты и shadow.camera. Штатный up=(0,1,0)
  становился параллельным лучам в полдень/полночь и мог разворачивать карту на 180°.
  Новая версия не имеет этой особенности; направление/позиция солнца не меняются.
  Размер текселя берётся из реального mapSize соответствующего каскада.
- Профайлер получает CSM вместо callback; сравнивает дальность 300 с текущей 200.
  `profile-scene.mjs` умеет PERF_SCREENSHOT. Снимок просмотрен: тени на месте,
  без явных артефактов. Статический снимок не доказывает полное отсутствие мерцания.
- %TEMP%/kirby-stable-shadow.json: 2324 calls, 9,535,976 triangles, 10.9→11.0 мс.
  SAME-RUN дальность300: 2526 calls, 10,012,488 triangles, 11.4 мс при контролях
  11.0/10.9 (порядка4% времени). Не сравнивать эти абсолютные времена с отдельными
  запусками, машина меняет частоты/нагрузку. errors=[], состояние восстановлено.
- Сборка и 5 тестов дня/теней прошли, включая непрерывность ориентации около
  .25/.75 и сохранение дробной координаты shadow texel у неподвижной точки
  при перемещении камеры. Последняя правка профайлера только обновляет CSM при
  временном изменении разрешения, на обычную игру не влияет.
Всё пока локально, без commit/push/deploy. Остаточное субпиксельное мерцание
при непрерывном вращении света нельзя обещать устранённым на любом устройстве;
пользователь должен оценить тот же ракурс в своём браузере.

## Приоритет пользователя и плавность теней — 2026-10-03

Пользователь проверил последнюю оптимизацию: «супер, стало лучше». В дальнейшей
работе уделять оптимизации основное внимание: сохранять FPS, особенно на телефонах;
при графических изменениях следить за вызовами, геометрией, тенями и замерами.

По просьбе сгладить квадратные ступеньки теней локально заменён PCFShadowMap
с radius=2 на PCFSoftShadowMap (встроенная интерполяция, 16 выборок вместо 17
в установленном Three r180). Radius больше не задаётся — этот фильтр его игнорирует.
Карты 1024, два каскада, стабильные формы теней, normalBias=.12, fade и обновление
солнца/луны каждый кадр сохранены. Нет временного шума, дополнительных проходов
или увеличения карт. Профайлер умеет сравнивать старый фильтр с новым и возвращает
исходный тип/радиусы. Скрипт проверяет также восстановление shadowMap.type.
Замер %TEMP%/kirby-soft-shadow.json: новый 14.2→14.1 мс; same-run старый 13.8 мс,
контроли нового 14.2/13.5 мс — различие в пределах шума (~0.4%), calls/triangles
одинаковы, ошибок Three/WebGL нет. Отсутствие мерцания на всех устройствах этим
замером не доказано: визуальную плавность пользователь проверит на своём экране.
Изменения пока локальные, без новой публикации.

## Получен пользовательский FPS-отчёт — 2026-10-03

Файл `C:/Users/VE/Downloads/kirby-performance.json`, Firefox, 2509×991, DPR 1.
Камера [-174.8126,6.8377,159.6348], quaternion [-.11716,-.33935,-.04264,.93236].
Это широкий обзор поляны. Исходный кадр стабилен: 23 мс, 2890 вызовов,
11,777,336 треугольников с тенями. Отключение обновления теней даёт 17 мс;
половина разрешения не помогает. Тропа целиком 22→21 мс, звезда 22→23 мс
(шум): звезда не объясняет просадку. Лес, декорации, светлячки и тени вместе
создают нагрузку; нельзя складывать проценты отключений.

Новые ЛОКАЛЬНЫЕ изменения, пока без commit/push/deploy:
- `maze.ts`: листва видна в прежней детализации, но отбрасывают тень простые
  сплошные формы стен. Тени лабиринта 1,501,944 → 4,896 треугольников.
- `landmarks.ts`: видимые декорации сгруппированы по геометрии/roughness,
  исходные цвета перенесены в instanceColor. Разделение на пространственные
  клетки и интерактивные обводки сохранены. В воспроизведённом ракурсе вызовы
  декораций вместе с тенями 584 → 349.
- `profile-scene.mjs` принимает PERF_REFERENCE (JSON пользователя), восстанавливает
  viewport и камеру. Положение игрока приближено к камере; мир/анимации/время суток
  из старого отчёта точно не восстановить. Поэтому сравнивать абсолютные цифры
  пользователя и этого скрипта как идентичные сцены нельзя.
- Профайлер теперь берёт контроль до И после каждого отключения; при расхождении
  >15% помечает строку нестабильной. Есть сравнение с подробными тенями лабиринта.
- Локальные отчёты %TEMP%/kirby-user-before.json, kirby-user-after.json,
  kirby-user-verified.json. Последний запуск без параллельной сборки: 16.7→17.2 мс,
  2526 вызовов, 10,012,488 треугольников, errors=[], восстановление сцены проверено.
  До правок: 2738 вызовов, 11,458,364 треугольников, 19.5–20.2 мс. Отдельные
  запуски шумные: не обещать точный прирост FPS. В same-run сравнении подробные
  тени лабиринта 16.6 мс против новых ~16.0 мс: выигрыш геометрии большой,
  времени на данном устройстве небольшой. Следующий резерв — количество вызовов,
  особенно лес, светлячки, горки; не упрощать звезду ради неподтверждённого эффекта.
- Build и 10 тестов maze/landmarks/forest-spacing/interaction-outline прошли.
  Сервер не менялся. Пользователю нужно проверить локальную сцену в своём Firefox.

## Продолжение после паузы — 2026-10-03

Пользователь вернулся («продолжим»), пауза снята. Локально реализована оптимизация
теней леса и декоративных точек интереса; коммита/деплоя этих изменений пока нет.

- Новый `scenery-shadows.ts`: простые формы для теней с общим материалом,
  разбитые на пространственные клетки. Видимые модели/текстуры не упрощаются.
- Лес: тени стволов/крупных ветвей — отдельные цилиндры 6 сегментов, хвои —
  конусы 8 сегментов без лишних вертикальных делений. Тонкие веточки, полоски коры
  и фрукты внутри крон не рисуют самостоятельные тени. Прежние непрерывные формы
  теней лиственных крон сохранены; обновление света/теней по-прежнему каждый кадр.
- Декоративные точки интереса: тени объединены по форме независимо от цвета.
  Детали меньше .6 мировых единиц и декоративные кольца не отбрасывают тень;
  мосты, скамейки, крупные грибы, камни/руины сохраняют её. Примитивы теней
  упрощены, геометрия видимых моделей остаётся прежней.
- `interaction-outline.ts` игнорирует материалы colorWrite=false, чтобы
  невидимые формы для теней не участвовали в подсветке лавочек. Добавлен тест.
- В диагностике добавлено переключение «Старые подробные тени (сравнение)»:
  временно возвращает исходные castShadow и убирает новые формы, затем полностью
  восстанавливает сцену. Это позволяет сравнивать в одном кадре/запуске.
- Полный кадр у тропы: 1013 → 800 вызовов, 6,088,955 → 3,705,863 треугольников.
  Тени леса 1,492,396 → 243,956 треугольников, декораций 1,251,268 → 63,448.
  Раздельные запуски дали 9.6 → 6.1 мс, но более надёжное сравнение в одном
  запуске дало старые 8.8 / новые 7.6 мс (~14% меньше времени отрисовки).
  Не обещать 35% прироста реального FPS: абсолютные времена машины шумные.
- Отчёты в %TEMP%: kirby-shadow-before.json, kirby-shadow-after.json,
  kirby-shadow-comparison.json. Последний browser-проход успешно проверил
  восстановление видимости/теней/обработчиков/разрешения, errors=[].
- TypeScript, build и проверки леса/декораций/дня-ночи/обводки прошли;
  после добавления последнего теста обводки запустить его повторно.
- Дальнейшие крупные расходы в тенях: фрукты (~769 тыс. треугольников), модель
  игрока (~518 тыс.), NPC. Их внешний вид пока не меняли. Для конкретного ракурса
  пользователя всё ещё полезен отчёт через локальный `http://127.0.0.1:5173/?perf=1`.

## Предыдущая точка паузы — 2026-10-03

Ниже историческая запись о паузе; актуальное продолжение описано выше.

### Что опубликовано

В `main` отправлены `28f7587` (общий cooldown толчка 100 мс) и `7779981`
(оптимизация Небесной тропы и этот файл). Vercel Production для `7779981` подтвердил
success. Cloudflare Worker опубликован: версия `a5cacf2a-d495-4043-bc26-5b87fcf6ee03`,
health ответил ok. Пользователь сообщил, что реального улучшения FPS почти нет:
75 при взгляде в гору, 42 при взгляде на Небесную тропу.

### Текущая незавершённая задача

Диагностика **полной** сцены, поиск истинного источника просадки, включая соседние
модели и звезду. Предыдущий изолированный benchmark тропы не доказывал улучшения
полной игры. Пока НЕ сделан новый фикс теней и НЕ установлена точная причина
именно пользовательского перехода 75 → 42: ракурс/устройство отличаются.

### Локальные изменения после последнего деплоя (не закоммичены)

- `kirby-game/src/scene-profiler.ts`: новый opt-in профайлер, доступный с `?perf=1`.
  Кнопка «Найти нагрузку» фиксирует сцену/камеру в одиночной игре и поочерёдно
  отключает группы/эффекты. Есть «Скачать отчёт», текущие времена обновления и
  отправки кадра, счётчики геометрии. В обычной игре модуль не загружается.
- Замеры: 5 прогревочных + 12 измеряемых кадров, медиана render + gl.finish;
  отдельный свежий baseline перед каждым исключением. `renderer.info.autoReset`
  временно выключен, чтобы считать ОБА каскада теней и основной проход.
  В конце восстанавливаются видимость, castShadow, callbacks, разрешение,
  autoReset и shadowMap.autoUpdate. Сетевой режим не позволяет заморозить сцену.
- `main.ts`: динамическое подключение профайлера, ранний выход из игрового цикла
  во время замера, CPU-индикаторы; названия «Игрок» и «Фрукты на поляне» для отчёта.
  FPS-счётчик сбрасывается во время паузы, чтобы не показать ложную просадку после.
- `sky-trail.ts`: имя `Sky Trail summit reward` для отдельного отключения звезды.
- `scripts/profile-scene.mjs`: Playwright-проверка в отдельном Chrome-профиле;
  запускает соло, сохраняет позицию у тропы, задаёт фиксированную камеру и вызывает
  `window.kirbyPerformance.run()`. Теперь также проверяет полное восстановление
  изменённых флагов/колбэков после замера.
  PERF_VIEW=mountain выбирает противоположный ракурс, PERF_OUTPUT задаёт JSON-путь.
  По умолчанию пишет `%TEMP%/kirby-scene-profile.json`.

### Наблюдения (главное для продолжения)

- Повторные полные замеры в сторону тропы устойчиво указывают на пересчёт карт
  теней: примерно 800 дополнительных draw calls и 5 млн треугольников каждый кадр.
  Заморозка пересчёта теней (уже готовые тени остаются) снижала время render на
  38–50%. Это диагностическое отключение, не готовое решение: нельзя просто
  навсегда заморозить тени, когда двигаются камера, свет и персонажи.
- Последний замер: 1013 calls / 6,088,955 triangles, без обновления теней
  213 calls / 1,093,851 triangles; baseline 6.6 мс → 4.1 мс. Абсолютные времена
  плавают с нагрузкой машины, это НЕ измеренный FPS телефона/браузера пользователя.
- Верхняя звезда — всего 2 calls и 692 triangles; отдельное отключение давало
  около 0–2%, в пределах шума. Тропа после оптимизации также не главный расход
  в выбранном ракурсе. Проценты маленьких разниц и ранжирование отдельных групп
  шумные: иногда даже внекадровая группа показывает «улучшение». Не выдавать
  такой результат за доказанную причину; повторять A/B/A или получить отчёт пользователя.
- Перехват `onBeforeShadow` на один кадр показал основные группы теней:
  лес 181 вызов / 1,492,396 треугольников; декоративные точки интереса (пруды,
  камни, грибы, руины и пр.) 259 / 1,251,268; фрукты 86 / 768,992;
  игрок 34 / 518,144; отдельные NPC по 81–163 тысяч треугольников.
- Противоположный контрольный ракурс в нашей тестовой позиции оказался тяжелее,
  а не легче (до 10.9 млн треугольников с тенями); пользовательский конкретный
  сценарий 75 → 42 пока не воспроизведён. Нельзя утверждать, что он уже исправлен.
- В `forest.ts` уже есть упрощённые прокси теней лиственных крон, геометрия
  `createCanopyShadowGeometry()` (Icosahedron detail=2). Coaster уже имеет
  стабильную оболочку тени вместо мелких рельс/шпал. Не вернуть старое дребезжание.
- `spatialInstances()` разбивает лес/декорации на клетки 64; фрукты объединены
  глобально по геометрии/материалу, что может рисовать дальние экземпляры в тенях.

### Проверки и файлы результатов

TypeScript и production build профайлера прошли до последних небольших правок
(добавление тестов источников света/названий и сброс FPS); при продолжении ещё раз
проверить tsc/build. Последний `profile-scene.mjs` завершился успешно, errors=[],
восстановление состояния также прошло. Запущенных замеров больше нет.
Полные отчёты: `C:/Users/VE/AppData/Local/Temp/kirby-scene-profile.json` и
`C:/Users/VE/AppData/Local/Temp/kirby-mountain-profile.json` (второй более ранний).
Локальный Vite на 5173 был запущен в этой сессии; перед продолжением проверить,
жив ли он. Неотслеживаемую `.wrangler/` не коммитить.

### Следующий шаг после возвращения

Закончить проверку профайлера и решить по фактическому полному кадру, как облегчить
тени (геометрия/дальность/группировка/прокси), сохранив плавную смену дня и ночи
и стабильность теней. Для точного проблемного ракурса дать пользователю режим
`?perf=1` с экспортом отчёта; в production он пока НЕ опубликован. Не обещать
выигрыш от изолированного теста или автоматически деплоить без нового запроса.

Обновлено 2026-10-03 по просьбе пользователя: изучить изменения, сделанные отдельно.
Проверены история и изменения исходников всех 18 коммитов после `e78c364` до
`9db46d1c805ba856b4510a989fc66ba90d0ca212` включительно. Это новая точка отсчёта
для следующего просмотра незнакомых коммитов.

## Состояние репозитория при просмотре

- Ветка `main`; локальные `HEAD`, `origin/main`, `origin/HEAD` указывают на `9db46d1`.
  Это состояние локальной ссылки remote-tracking; отдельный fetch не выполнялся.
- До записи этого файла отслеживаемые файлы были чистыми; присутствовала
  неотслеживаемая `.wrangler/`. Её не менять и не добавлять в коммиты.
- В этой задаче исходники игры не изменялись, тесты не запускались, публикация
  не выполнялась. Наличие новых коммитов не подтверждает версию production.
- Клиент: `kirby-game` (Three.js + TypeScript + Vite). Сервер: `game-server`
  (Cloudflare Worker / Durable Objects). Общие игровые типы и часть логики
  импортируются сервером из `kirby-game/src`.

## Итог новых изменений

### Производительность

Коммиты: `abb7e03`, `8beeb10`, `14d1c87`, `e1e13c2`, `5302436`, `d2b7a2a`.

- `main.ts`: pixel ratio ограничен 1 и на компьютере, и на телефоне, в том числе
  после resize. `powerPreference: 'high-performance'` запрашивает производительный GPU.
- **Сглаживание включено** (`antialias: true`). Эксперимент с выключением MSAA
  отменён коммитом `14d1c87`: качество краёв ухудшилось без существенной выгоды FPS.
- Объёмная трава в `environment.ts` больше не принимает тени; не путать с землёй.
- `FruitWorld.bakeInstances()` объединяет повторяющиеся части фруктов по геометрии
  и материалу в InstancedMesh, включая части, уже представленные инстансами.
  `syncInstances()` скрывает съеденные/невидимые экземпляры и обновляет матрицы
  только при смене видимости; вызывается после distance culling и при restore.
  Логические объекты фруктов и их туманы остаются отдельными.
- Невидимые туманы фруктов не анимируются. Фонтан проверяет frustum и пропускает
  обновление капель/колец/пузырьков вне кадра, сохраняя ход времени.
- Чат сравнивает ID последних 10 сообщений вместо JSON.stringify каждый кадр.
  Подсказки управления, DOM-ссылки и временные векторы кэшируются; текст статистики
  и подсказок записывается только при изменении. Звёзды не создают новый вектор
  на каждый экземпляр каждый кадр.

### Звуки

Коммиты: `3880e93`, `c354ca7`, `31e75c4`; основной файл `src/sfx.ts`.

- Для эффектов добавлен запас громкости (gain .35) и жёсткий limiter:
  threshold -2 dB, ratio 20, knee 0, attack 0, release .05.
- Звуки хранятся вместе со своими GainNode; общий запуск плавно поднимает gain
  за .025 с, вытеснение старого звука затухает за .04 с вместо резкого обрыва.
- Шаги стали мягким шумовым шорохом: плавная атака .04 с, удалён тон 115 Hz,
  добавлена фильтрация низкочастотной составляющей. Это исправление наложения
  шагов и голосов/эмоций — не возвращать прежний тональный удар.

### Толчок и перекатывание

Коммиты: `0d8424e`, `b2ca828`, `d8e014f`, `f9d712d`, `bab3592`, `0e65d73`.

- Во время толчка можно двигаться и поворачивать. В движении сохраняется цикл ног
  Run/WalkBackward, руки накладывают позу толчка через `applyPushArms`; стоя
  проигрывается отдельный Push. Внутренние имена attack/hit сохранены.
- Новый отдельный нажим допускается клиентом через .1 с, а не после окончания
  всей анимации. Удерживание само по себе не повторяет толчки (edge-trigger).
- Контакт теперь происходит сразу при начале толчка (`attackHit = true`),
  не через .23 с; длительность визуальной анимации .62 с сохранена.
- `push-target.ts`: обычная цель — сфера радиуса 1.5 × размер вокруг центра
  тела на высоте .9 × размер. Проверяется пересечение с направленным вперёд
  отрезком длиной 3.1 × размер толкающего; выбирается ближайшая допустимая цель.
  Для FireflyRide сохранена отдельная проверка дистанции/высоты/направления.
- Перекат длится .95 с, перемещает на 4.2 × размер; easing `1-(1-u)^2`
  сразу даёт движение с последующим замедлением, вместо медленного старта.
- Исправлено 2026-10-03 по следующему запросу пользователя: клиент и сервер теперь
  используют общую `PUSH_COOLDOWN_MS = 100` из `push-target.ts`. Сервер принимает
  повтор ровно через 100 мс (`>=`), блокируя более частые и дубли в одном кадре.
  Добавлена серверная регрессия для границ 99/100 мс.
- Предыдущая механика доброго толчка сохранена: отталкивание/сбивание со светлячка,
  без отнимания жизней и усыпления от ударов.

### Домик Кирби

Коммит `ca33931`; `src/kirby-home.ts`.

- Домик растёт до размера спящего (минимум ×1), крыша остаётся видимой.
- Кровать, дверь, позиция сохранения и коллизии учитывают масштаб домика.
- При завершении вставания домик возвращается к ×1, Кирби ставится у обычной двери.

### Изменение размера из админки

Коммит `6679648`; клиент + Worker + тесты.

- Online показывает размер игрока и кнопки +50% / −50%. Шаг аддитивный: ±.5
  исходного размера, диапазон админского изменения 10–1000%.
- Общий `src/body-size.ts`: MIN_BODY_SIZE=.1, MAX_BODY_SIZE=10, stepBodySize().
  Это ограничение admin resize, не новый общий предел роста от фруктов.
- POST `/admin/api/online/resize`: roomId, playerId, delta (.5 либо -.5).
  Существующая защита входа в админку сохраняется. Проверяются актуальность
  комнаты, наличие готового игрока и пределы размера.
- Сервер обновляет размер и progress, отправляет игроку событие `resize`, другим
  игрокам frame, а в чат — цветное событие от Ветерка. `adminSize` защищает новый
  размер от устаревших кадров до подтверждения клиентом и учитывает сбор фруктов.
- `NetworkSession.onResize` вызывает `CharacterController.resizeTo`: плавное
  изменение с сохранением целевого размера; фрукты/очки не начисляются.
- Фонтан теперь тоже уменьшает до 10%, а не до прежних 100%; тесты это закрепляют.
- В admin-page удалены confirm-диалоги у Disconnect, пересоздания комнаты,
  запуска звездопада и завершения игры; кнопки выполняют действие сразу.

### Музыка

Коммит `9db46d1`.

- Плейлист теперь содержит **18**, а не 14 треков. Случайный старт и последовательное
  циклическое переключение сохранены.
- Новые: «Игрушечный парад» (`toy-parade`, glock/clarinet), «Свет калимбы»
  (`kalimba-glow`, flute/kalimba), «Лёгкий аккордеон» (`accordion-stroll`,
  violin/accordion), «Свист у берега» (`shore-whistle`, whistle/uke).
- WAV лежат в `kirby-game/public/audio/`; воспроизводимый генератор —
  `kirby-game/scripts/make-light-music.cjs`. У каждой мелодии свои фразы, гармонии
  и темп; стерео, плавные края, нормализованный пик .68.
- Обновлены проверки наличия аудио и переключения всех 18 треков.

## Проверки в новых коммитах

Изучены изменения тестов combat, fountain, music, network-rejoin и новый size.test.ts.
Они покрывают немедленный контакт толчка, уменьшение до 10%, плейлист из 18 треков,
границы admin resize и защиту от устаревшего размера в сетевых кадрах.
Это описание исходников тестов, а не утверждение об их запуске в текущей задаче.

## Правила продолжения

### Локальная оптимизация Небесной тропы (2026-10-03)

По следующему запросу пользователя добавлен `src/sky-trail-visuals.ts`:
лёгкое цветное стекло с подсветкой края вместо MeshPhysicalMaterial/clearcoat;
верхняя грань подсвечивается тем же проходом, без отдельной двусторонней плоскости.
Прозрачные кубики остаются отдельными для корректной сортировки. Статические рамки,
кольца и радуга объединены по высотным секциям; вращающиеся фигуры инстансированы
по форме/высоте. Светящиеся детали используют unlit-материалы без расчётов CSM.
Металлические детали каждого батута объединены внутри его группы; подвижная ткань
и возможность интерактивной обводки сохранены. Геометрия маршрута/коллизии не менялись.

Воспроизводимый изолированный браузерный замер: `scripts/sky-trail-browser.mjs`
(нужен Vite на 5173, Chrome; SKY_SCREENSHOT задаёт путь снимка). При 960×640 и
двух каскадах теней обзор тропы: 429 → 98 draw calls, 198 → 38 геометрий;
медиана замера render + gl.finish на данном компьютере 3.9 → 1.1 мс.
Эти времена не являются FPS полной игры или замером реального телефона.
TypeScript, production-сборка и 7 тестов sky-trail прошли. Статус публикации
проверяется отдельно от этих локальных замеров.

Сначала читать этот файл и сравнивать будущую историю с последней отмеченной точкой.
Не отменять перечисленные самостоятельные изменения пользователя при следующих
правках. Не хранить пароли, токены и содержимое `.dev.vars` в памяти/репозитории.

## 2026-10-03 — HUD alignment and mobile chat
- Desktop day/night dial now shares a flex corner container with the statistics/sidebar: aligned top edges, 12px gap, dial immediately on the left. Layout is CSS-only; no per-frame measurements. Touch layout keeps its original dial position.
- Mobile message history is inside the Chat composer, below input/actions, with the latest 10 messages scrollable. Settings no longer reveals history and closes the mobile composer when opened. Desktop chat behavior is preserved.
- Mobile composer tracks visualViewport height/offset while open to fit above the software keyboard.
- Validation: client build passed; Playwright Chrome checked desktop alignment (28px top, 12px gap), touch Chat/settings visibility, sending messages, 10-message cap/overflow, landscape 844x390, portrait 390x844 and a short 844x260 viewport. No page errors. Actual iPhone/Android keyboard remains a device check.
- User confirmed the preceding Firefox stereo bus audio fix eliminated the clicks. Both audio and these UI changes remain local; no commit/push requested in this UI turn.

## 2026-10-03 — Sky Trail summit star power
- Collecting the summit star now calls the same CharacterController.activateStarPower() as the solo/network maze star: existing sparkle aura, double movement speed and jump height for 30 seconds. Existing starRemaining serialization carries the effect through network state/saves without protocol/server changes.
- Sky reward remains one-time and independent of maze completion/cooldown; standing at the summit cannot keep refreshing the bonus.
- Validation: 12 Sky Trail/maze tests passed, including power expiry, aura visibility, network state restore and independent achievements; client production build passed.

## 2026-10-03 — Fruit bite sound
- Fruit counter increases now emit a separate eat sound event (player and NPC), using a cached 0.42s apple-like crunch in fruit-bite.ts: rounded noise grains, softer chew, DC filtering and faded tail, slight playback-rate variation.
- Star pickups still use the original grow/bell buffer. No changes to task rewards/other effects or the fixed stereo Firefox output bus. Resizing alone does not trigger eating.
- Validation: 9 sound/audio-settings/water tests passed; sample peak 0.614, RMS 0.105, near-zero DC, silent boundaries; production build passed. Listening preference remains for user review in game.

## 2026-10-03 — Size-aware Sky Trail support
- Replaced centre-point cube/rainbow support with a rotated elliptical standing footprint derived from neutral GLB feet bounds (x ±0.95, z -0.45..0.81). It follows actual actor scale, including growth/shrink, and yaw; animation does not change support to avoid footstep jitter.
- Exact ellipse/rectangle edge tests avoid phantom square-corner support. Cheap axis bounds reject distant platforms first. Sky Trail broad-phase bounds also include actor size; one-way vertical landing checks are unchanged.
- Validation: all 11 Sky Trail tests passed, including 700% edge landings, rotated footprint, rainbow edges, shrink causing loss of support and no landing from below; production build passed. Client only, no server protocol changes.

## 2026-10-03 — Replace synthetic fruit crunch with a CC0 recording
- User disliked the synthesized bite. Replaced it with Apple Bite by AntumDeluge (OpenGameArt), an excerpt of sonicmariobrotha's apple bite (Freesound #333825). Both source pages explicitly license it CC0. Provenance/license links recorded in kirby-game/ASSET_CREDITS.md.
- Downloaded https://opengameart.org/sites/default/files/apple_bite_0.ogg; converted to mono 22050 Hz PCM WAV, trimmed quiet edges, peak .55, 6ms fade-in/35ms fade-out. public/audio/apple-bite.wav is 34,806 bytes, ~0.788s.
- Removed unused synthetic fruit-bite.ts. Fetch recording once during menu creation, decode/cache on audio start. Failed download/decode silently skips only eating audio, never blocks game/other effects. Separate eat event retained; stars still use original grow chime. Fixed Firefox stereo output bus preserved.
- Validation: build, six sound-event/settings tests, browser WAV decoding + separate chime buffers + aborted audio-download fallback passed. No commit/push requested.

## 2026-10-03 — Biome undergrowth and circular river
- Added meadow-decor.ts: seeded grass patches, flowers, mushrooms, stumps with growth rings, leafy bushes and spruce ferns. Palettes follow biomeAt: dark moss/spruce, light birch with white/blue flowers, green/pink orchard, ochre/rust autumn. New bushes/stumps are also fruit-placement obstacles.
- Grass remains within the previous 144,000-blade budget, grouped into three-blade tufts. Static plant geometry is merged per 48m cell; grass uses spatial instancing. Distance LOD (145m with hysteresis), smooth grass reduction at 65–105m, opaque Lambert materials, no added shadow passes or animation updates.
- Closed the lake chain with a winding eastern/northern return channel and two additional bridges (15 total). Routing avoids fountain/Sky Trail as well as existing attractions. Shared shoreline simplified to 4cm tolerance keeps terrain below the existing 2,000-triangle test budget.
- dryGround checks full object footprints against spatially indexed water edges; homogeneous water cells are cached. Existing landmark flowers, reeds and rocks cannot overhang water. outsideLandmarks handles river displacement pushing trees back into attraction clearances.
- Validation: production build and 16 pond/bridge/forest/fruit/landmark/decor tests passed. Daytime views checked in all four biomes; mobile Chrome emulation 844x390 loaded with no page errors. Controlled frozen scene A/B: all new grass+decor adds 15–16 draw calls and 54–90k visible triangles in two ground views; one warmed view measured ~0.5ms additional render submission+gl.finish. These are desktop samples, not a real-phone FPS guarantee. Overview distance culls all undergrowth.
- Client changes remain local; current landscaping request did not ask for commit/push/deploy. No boats implemented.

### Denser ground cover follow-up
- Replaced purely random grass distribution with a jittered 2.8m base grid plus denser random patches. Total stays at 144,000 blades; dry banks, trunks and attraction clearances remain protected.
- Shrubs and mushrooms are placed explicitly around actual trees, and an irregular shrub belt runs along all four mountain edges. Current seeded scene has 1,049 bushes, 440 in the outer 20m belt, shrubs beneath 393 of 446 crowns. Biome palettes retained.
- Reduced tiny flower pollen/bush-leaf geometry to offset added shrubs. Entire grass/decor geometry is ~1.33m triangles across the whole map, spatially culled as before; no new materials, lights or shadow passes.
- Four relevant tests passed, including sampled bare-ground coverage, all four borders, crown coverage and a 1.4m whole-map geometry ceiling with actual forest. Production build passed; browser scene checked at ground level/foothills without page errors. No claim of unchanged real-device FPS. No commit/deploy requested.

## 2026-10-03 — NPC navigation, greetings and stationary network animation
- Removed WalkBackward from autonomous NPC action selection. Walking/running now probes the same maze/home/mill/treehouse constraints used for movement, selects a clear heading and smoothly turns before continuing. Remote players also count as neighbours. Balloon approaches reject paths through solid obstacles; blocked firefly approaches abort, and waiting for a firefly uses Idle.
- Greetings have an explicit Hello actor state throughout the jump/wave. Host can greet nearby remote players too. Existing pose arrays carry the five greeting nodes; NpcSnapshots interpolates them at the unchanged 5Hz world cadence. The retired npcLife damage slots carry greeted/elapsed for host recovery without changing the 15-number row or server contract.
- SoundEvents emits one NPC Hello on the visible state transition, including guests; audible up to 32m to cover the 24m greeting radius. Hello bypasses ambient throttles and protected greeting/emote voices cannot be interrupted when player footsteps hit the active-sound limit. Previously the oldest active voice could be cut off by a step.
- Guest NPC locomotion uses actual rendered displacement: stationary/held network positions blend to Idle, then resume Walk/Run when moving. Does not extrapolate through walls or add network requests. Firefly/balloon approach states map to forward Walk on guests.
- Validation: production build and 35 NPC/ride/sound/network tests passed, including real maze walls at sizes 100/400%, wave+Hello replication, stationary snapshot animation and greeting payload budget. Browser WebAudio check confirmed Hello survives concurrent steps, plays once at 24m, and scene starts without page errors. Full live two-human online verification remains a user check. Client only; no commit/push/deploy requested in this turn.

## 2026-10-03 — NPC swimming
- Ponds.apply now accepts a structural swimmer and keeps independent bridge/support state in a WeakMap. Player and NPCs use the same lake/river/fountain waterline, central fountain collision, bridge decks/rails and shore exits. NPC flight height follows its support surface too.
- Added shared swimClip for player/NPCs. Wet NPCs use Swim, paddle slowly and wear the same rainbow ring; dry NPCs resume Walk. Rides hide the ring. Guests infer Swim/ring from the existing actor state and position, with no protocol or message-frequency changes.
- makeSwimRing batches the detailed colored sections, rope, handles and badges into a single mesh with vertex colors; geometry is cached across swimmers, materials cloned per actor. One draw per visible ring, no extra lights/shadows. Browser screenshot checked appearance and waterline.
- NpcSwimming host-only planner occasionally sends at most two NPCs to safe lake/fountain bathing spots, rests 8–16 seconds, returns ashore, then waits 90–150 seconds before another personal visit. Routes use existing solid-obstacle constraints; blocked/interrupted trips time out. Incidental river crossings swim automatically too.
- Production build and 40 pond/fountain/NPC-swimming/ride/network tests passed. Tests cover multiple simultaneous swimmers, 100/400% waterline, bridges, intentional bath/return/cooldown, guest animation/ring and player regressions. Browser started without errors. Changes remain local; no commit/push/deploy requested.

## 2026-10-03 — River bridges and dry coaster foundations
- Reduced bridges to three: near the watermill (34,50), northern river (-99,-226), eastern river (226,79). Candidate selection verifies dry land across both full-width landings and approaches; bridges are separated by at least 110m. Scenery clearance protects approaches from foliage.
- River half-width increased from 2.8 to 3.5m, bridge arch height from 2.8 to 3.5 local units. Shared shore contours, water collisions and terrain cutouts use the new width. Terrain remains 1,527 triangles, below the 2,000 budget.
- Coaster support candidates search nearby dry banks for their foundations, keeping vertical columns and connected angled rail heads. All 75 foundations are dry with 1.6m clearance; passenger clearance and support spacing remain validated. Placement is computed at initialization, with no new per-frame work or shadow passes.
- Production build and 32 pond/NPC-swimming/coaster/forest/decor/fruit/landmark tests passed. Browser screenshots checked all three bridges and nearby supports; no page errors. No commit/push/deploy requested.

## 2026-10-03 — Rainbow Kirby
- Appended selectable variant index 15, Радуга. Seven horizontal classic rainbow bands use a shared 4x896 sRGB texture with height UVs on body/arms; violet boots. Seven-point golden crown with multicolored gems follows Body_motion, including emotes. Crown geometry is cached and merged into two meshes; no extra lights/shadow passes.
- Crown/rainbow portraits appear in selection, player/remote statistics and festival results. Desktop selection is four columns, gamepad navigation reads actual responsive grid columns and variant count. Header updated to sixteen choices.
- Ambient NPC count remains fourteen (first fourteen unselected variants), preserving old saves, world payload and rendering budget. Rainbow player saves are accepted with the existing format.
- Shared actor, festival and history validators plus Worker join accept all palette entries. BUILD bumped to meadow-network-5, smoke scripts/docs aligned, to prevent older clients that cannot render index 15 from joining the updated server. Client AND Worker must be published together; not deployed in this turn.
- Client build, Worker TypeScript check and 23 model/NPC/save/network/history/festival tests pass. Browser checked actual crown/bands, menu selection and gameplay portrait without page errors. No commit/push requested.
- Follow-up: user found the boots too blue/dark; changed model and portrait boots to brighter red-shifted violet #b33ee6. User requested committing/pushing all accumulated work; deployment not requested.

## 2026-10-04 — Mobile chat remains open after sending
- Mobile chat submission clears the input and dismisses its keyboard while preserving the conversation panel. Both Send and Enter behave this way; Cancel closes the panel. Mobile Escape no longer dismisses it, and Settings cannot close it behind the user's back. End-of-round forced dismissal remains intact.
- Desktop submission/Escape behavior is unchanged. Existing render scrolling exposes the newest sent message; no network changes.
- Production build passed. Browser checks with mobile viewport/touch and desktop verified submission, consecutive messages, visible sent text, cleared input, cancellation and desktop auto-close without page errors. No commit/push/deploy requested.

## 2026-10-04 — Colourful river boats
- Added eight evenly spaced rounded boats with eight paint colors, slatted cushioned benches, striped domed umbrellas, offset brass poles, oars, lifebuoys, mooring cleats/rope and small wakes. Solid cockpit decks sit above the waterline. Four permanent seated Kirby passengers blink/breathe; the four even-index boats are available for players.
- boat-route.ts follows all five lakes/tails and the closed river, rounds sharp routing corners and caches metre-spaced samples for smooth constant 3.4m/s travel. Circuit is about 1,538m / 7.5 minutes. Tested full hull footprints in water, all three bridge clearances; removed lilies and lower bridge posts inside the navigation corridor. Rail foundations already remain clear.
- E / gamepad action / touch action boards a nearby free boat and exits to the nearest dry bank with short hop animations. Prompt shows lap progress. Large Kirby's visual model fits under the canopy while saved/stat size remains unchanged and returns on exit. Saving aboard restores a shore position. Added boat achievement/task Проплыть круг на лодочке, +3 once after a full continuous lap from boarding; fourteen tasks now gate the finale.
- Network boats derive position from room epoch and synchronized server time, with no boat world snapshots or new update cadence. Existing resource locks cover boat:0/2/4/6; permanent NPC seats reject claims. One number in the existing rider payload distinguishes boarding/seated/exiting phases; guests attach seated players to the same smooth boat trajectory. BUILD is meadow-network-6, smoke scripts/docs updated. Requires coordinated client/Worker publication, not deployed this turn.
- Rendering: shared hull/detail geometry, four draws per boat including wake; no added lights/cast shadows. Boat passengers sample original mesh grids and merge rigid parts per animation pivot (17 to 9 draws, retaining eyelids and mouth morphs). Entire fleet including passengers is ~85k triangles/68 meshes, culled at 280m (passengers 120m), hidden passenger animation skipped. A mobile-emulation scene comparison added 10 draws/~9.4k triangles in one view; this is not a real-device FPS guarantee.
- Client production build, Worker typecheck and 38 related tests passed, including round trip reward, 700% rider size restoration, safe exit, rendering budget, water/bridge geometry and network wire/save compatibility. Browser keyboard/touch boarding and exit checked without errors; local Worker two-socket test confirmed shared epoch, exclusive boat ownership and release/reboarding. No commit/push/deploy requested; previous mobile chat fix remains uncommitted too.

## 2026-10-04 Boat wake softened
- Previous boats/mobile chat published as f58f1b6; Vercel Production succeeded; Worker version d855cdb5-2305-4abe-8d50-50b39a82102d, health OK.
- User disliked two dashed wake lines. Replaced them with 18 small, soft animated foam rings per boat: expand, drift aft, gently appear and dissolve. Shared Lambert material follows scene lighting/fog; wake stays flat at WATER_Y+.028 despite hull rocking.
- New boat-wake.ts: shared geometry and GPU time uniform, no textures, particle objects, new lights, shadows or network messages; same one draw per wake, 36 triangles instead of 20. Existing total model budget still passes.
- Production build, four river boat tests, browser shader compilation and visual preview passed. Changes local; no new commit/deploy requested this turn.

## 2026-10-04 Rainbow mill quest (local, not yet published)
- Replaced the one-click lever reward with four stages, begun at the existing lever: push three forked twigs out of a shallow stone intake; cycle the gate low/excessive/balanced and hold balanced for three seconds; auto-pick three coloured stitched sacks and deliver via action button to the hopper in the displayed varying order; wheel lanterns, chimney bubbles and a short major-key tune celebrate completion. Wrong sacks spring back without a penalty. HUD prompts adapt to keyboard/gamepad/touch; carried sacks follow the owner and arms bend into a carrying pose.
- `mill-quest.ts` is a dependency-free shared reducer for solo and Worker: position/facing checks, owner, stages, timestamps, sack order, pickup/return/delivery. Online ownership is per initiating player, not host; other clients see the same state/props. Existing hit event handles twigs, action events ride existing frame batches. No new polling cadence. Gate settling/running expiry use existing frames/alarm. Completed mill runs for 60 seconds then can be started by another player. Incomplete quest releases on owner disconnect or 180 seconds without a quest action.
- Active achievement `millQuest` gives 6 once; retired `mill` still retains its earned 3 points in old saves, but does not satisfy the new task. All score displays, online ranking, solo/online finale and history now use shared `achievementPoints`. Server awards/preserves completion against stale actor frames. BUILD meadow-network-7; client AND Worker must deploy together. No new secrets/migrations.
- `mill-quest-decor.ts` batches static props, uses instanced lamps/bubbles; no new lights or shadow casters. Whole isolated mill screenshot: 75 draws / 49,286 triangles (bags stage), not a full-scene FPS benchmark. Hopper moved clear of old barrels, quest board moved left so it does not obscure the lever/gauge. Grounded 100%, 700%, 2000% Kirby can reach the lever outside the building collision.
- Checks: production build and Worker typecheck; 27 relevant tests (quest, watermill, score/tasks, network, starfall, saves) passed. `mill-quest-browser.mjs` injects test access ONLY into served Vite module, walks the full solo quest via real Q/E keys, confirms 6 points/no page or shader errors, saves TEMP previews. `mill-quest-smoke.mjs` verifies two real local Worker sockets, ownership, wrong sack, replicated stages, stale frames; MILL_RESTART=1 additionally waited the real minute, started as the other player, and verified disconnect releases quest. Updated starfall-smoke successfully completes the mill before triggering finale; it passed as well.
- No commit/push/deploy requested this turn. Preserve untracked root .wrangler/ as unrelated local state.

## 2026-10-04 Short boat quest and fixed-size attractions (local)
- Boat achievement now requires 10% of the closed route (~45 seconds at 3.4 m/s), still +3 once. Task label and ride progress mention 10%; completed riders can continue indefinitely or disembark. Existing earned boat achievements remain valid.
- `rider-size.ts` fits only animationRoot's parent model; actor scale and saved/growth size remain unchanged. Coaster caps visible rider to .9, balloons/home to 1. Balloon boarding/exit and home approach/waking interpolate the fit; canceling a bed approach starts restoration from the current fit. Exits from the home/balloon leave enough room for enlarged Kirby.
- Carts, balloons and house now always stay scale 1. Incoming obsolete enlarged cart/balloon snapshots are ignored, including occupied ones. Balloon NPCs use the same fit/restore behavior. Player camera fits normal-sized attractions during rides/rest.
- Optional `ActorState.fit` carries only the visual ratio in existing frames. Human and NPC snapshot buffers interpolate it; applyActor restores 1 when absent. Server validates its range and removes it from departed-player durable state. No new message cadence; pending release is still BUILD meadow-network-7 (mill quest has not yet been published).
- Client build and Worker typecheck passed. 31 related ride/boat/network tests covered behavior; one old assertion expecting remote enlargement was updated to the requested fixed-size behavior, then all 15 affected tests passed. New rider tests cover real 700% models, home access/exit at 100/700/2000%, player and NPC balloon landing, remote fit/restore and interpolation. Earlier mill quest edits remain uncommitted too. No commit/push/deploy requested this turn.

### Mill presentation refinement (2026-10-04, pending publication)
- Quest board moved behind hopper on right (58,35). Tailrace now runs under wheel at x42.8, z31.9..43.5, water y-.31; removed long green riser. Shared branch targets now z34.5/37.5/40.5, so publish backend together with client.
- Sack tied to animated Right_arm palm, only right shoulder posed. 96 instanced rainbow bubbles (was24), longer major-key victory fanfare.
- Reported wrong-blue-then-yellow delivery did not reproduce in shared reducer/browser/local two-client Worker: rejected sack leaves count unchanged. Added regression and explicit board required colour / rejection / current-step outline, plus carried colour in action prompt.
- Client build, Worker tsc, 9 targeted tests, complete browser quest (including wrong sack), two-client quest smoke passed. Visual screenshots in TEMP kirby-mill-carry/channel/bubbles.png. No commit/deploy requested for these refinements yet.

### Mill field sacks and event HUD (2026-10-04, local)
- Sacks moved to (68,54), (53,65), (76,69): 19-36m from hopper, dry ground checked. sceneryClearance reserves space around sacks for trees/decor. Client and Worker share these targets; deploy both when publishing.
- Removed quest instruction board from scene. MillQuestHud reuses starfall event-hud CSS and shows stage, flow timing, coloured delivery sequence/rejection. Only quest owner sees it; hidden in menus/settings and while starfall banner is active; celebration message lasts8s. Action prompt remains separate.
- Bubbles previously at chimney y12.5..20.5 outside normal view. 96 bubbles now rise beside hopper y1.6..8.6, with cheap unlit rainbow soap-film rim/highlight shader, single instanced draw, no new lights. Nonfinale splashes limited24.
- Client build, Worker tsc, quest/watermill tests passed; real browser full quest incl wrong sack passed without shader/errors. Final camera screenshot now clearly shows bubbles; HUD checked desktop and 844x390. Test updated to assert bubbles near player height.

### Unsupported coaster rails (2026-10-04, local)
- User requested zero track supports. Removed entire support generation (columns, braces, concrete footings), placement search and support metadata; fruit placement no longer reserves these absent footings. Removed obsolete support-specific tests. Depot floor/sign structures and track ties remain.

### Mill channel water (2026-10-04)
- Branch channel now shares the exact wheel/millrace ShaderMaterial. Pressure drives all ripples together: idle/blocked stops, low flow drifts, excessive pressure speeds up. Integrated phase avoids snapping/backward ripples when pressure changes; near-zero flow settles fully. No new geometry/draw calls/textures. Client-only change.

### Grounded mill hopper (2026-10-04)
- Lowered funnel bowl/rim by0.35m (rim1.55m), outlet now touches y0 and overlaps bowl neck. Four posts extended to1.42m so they physically enter cone wall; moved rivets and delivery drop animation with lowered bowl. Client visual change only.

### Mill grain crates (2026-10-04, local)
- Replaced five pale egg-like decorative sacks left of hopper with two open wooden grain crates: individual planks, corner posts, iron straps/rivets, wheat emblems and48 visible grain kernels per crate. Reuses existing mill instanced geometry/material batches; no new textures/lights.

### Surface shimmer fixes (2026-10-05, local)
- Kirby-home roof shimmer traced to differently coloured tiles overlapping in nearly coplanar planes (0.55 length at0.51 spacing). Same issue on treehouse/watermill roofs and fountain mosaic. Shared roofTileSpan/roofTilePitch adds narrow side joints and physical course step; home/treehouse have backing sheets. Fountain mosaic tiles narrowed.
- prepareSurfaceTextures runs during existing material setup, once per static surface texture: linear magnification, trilinear mipmaps and bounded2x anisotropy (preserves existing4x; device cap). Does not touch render targets, depth, video, compressed/cube or nonbyte data textures; no per-frame traversal or postprocessing. Fixes nearest-filtered pond water too.
- Build and12 relevant tests pass. Geometry regression inspects actual instanced tiles across3 roofs for nearly coplanar overlap. Browser isolated close-up verified (TEMP/kirby-home-stable-roof.png),29draws13986triangles, no errors. Not committed/published yet.

## Hardware-filtered shadows (2026-10-05, local)

- User reports large shadow edges shimmering and tiny shadows blinking. Existing texel snapping, stable orbit up vector, proxies, CSM fade and PCFSoft were already present; do not claim those were newly fixed.
- `shadow-filter.ts`: keep 2x1024 maps, 200m distance, same casters/passes. Attach comparison DepthTextures (UnsignedInt/24bit, linear, LessEqual) instead of shadow depth renderbuffers. Retain packed RGBA target for normal Three rendering and diagnostic fallback. No extra render pass or temporal history.
- Local material hook uses a continuous 5x5 weighted tent with 9 hardware bilinear depth comparisons instead of PCFSoft's 16 packed-depth fetch/unpacks. Hook preserves CSM and existing surface shader callbacks, leaves spot/point shadow code alone, no global shadow shader replacement. Shadows still track sun/moon continuously.
- StableCSM owns shared filter-enabled uniform and prepared depth samplers. Optional profiler can compare previous PCFSoft; old PCF experiments now disable hardware filtering and restore it. Normal game defaults enabled.
- Controlled 90-frame moving-sun test (big spheres and small casters), Chrome AND stock Firefox: peak pixel jump 21 ->13 (~38% reduction), summed temporal change 296448 ->295452 (largely unchanged); not proof of eliminating all shimmer. Screenshot `%TEMP%/kirby-shadow-filter.png`. Repro `scripts/shadow-filter-browser.mjs` uses a dedicated Vite5174, no main game state.
- Full frozen-scene Chrome A/B (two views, 1280x800, gl.finish): new6.8/6.4ms vs old6.5/6.8; new12.0/12.1 vs old12.2/11.8ms. Same640/1586 draws and2.45m/6.43m triangles respectively. No meaningful measured regression on this machine; not a mobile FPS guarantee. `%TEMP%/kirby-shadow-scene.png` reviewed; errors empty.
- Production build and9 targeted shadow/day/surface tests pass. Previous roof/texture fixes and these shadow changes are LOCAL, no commit/push requested yet. Root `.wrangler/` remains untracked and must not be committed.

## Kirby home bedding (2026-10-05, local)

- Previous roof/surface/hardware-shadow work published in `6ce5bc6` on origin/main.
- User requested non-flickering blue quilt edges, smaller pillow, and covering Kirby in bed. Old quilt box shared mattress side planes; old sphere pillow scale2.5 meant width5 vs mattress3.5.
- `bed-quilt.ts`: one 625-vertex deformable mesh, painted quilt seams/border, no separate coplanar seam strips. Top stays clear of mattress; side drape starts outside mattress width. No cast shadow/new lights; vertex/normals updates only while pose changes.
- Home pillow now2.7m wide. Rest root height1.58, z+.4, pitch-.38pi so back rests above mattress. Quilt folds down on approach, lifts/pulls over body .8-1.55sec, settles flat on wake; partial approach cancellation works. Large Kirby still fits visually without altering saved size/house.
- Remote bedding derives occupancy from existing home:0 lock and rendered Sleep actor near bed. Smooth visual cover/reset, no server/protocol/traffic changes.
- Build passes; 8 targeted bedding/rider/roof tests pass (plus earlier16 night/rider/surface checks). `scripts/bed-browser.mjs` creates isolated cutaway preview on own Vite5174; screenshot `%TEMP%/kirby-bed-covered.png`, empty/awake too, inspected; browser errors empty. Isolated38 draws including detailed Kirby, not whole-scene performance benchmark.
- Changes remain local; no commit/push requested for bedding yet. Exclude untracked root `.wrangler/` as always.

## Fitted quilt, safe bed exit and roof side faces (2026-10-05)

- Prior bedding changes published in `e354e64`. User requested closer cloth/body contact with mouth uncovered, then added remaining roof side-face flicker and walking through the quilt on wake. Commit/push requested for this batch.
- BedQuilt now bakes a small height field from reclining torso/boot envelopes with a breathing allowance and steep skirts onto the mattress. Same625 vertices/one mesh; no new scene passes or per-frame physics. Shared BED_REST/BED_COVER_FOLD keep character pose and cloth profile aligned; edge z=.065 leaves the mouth fully exposed.
- Wake sequencing: pull quilt past feet during0-.32s; stand during.32-.55s; move out.5-.95s, descend/restore visual size only after.7s. Spread quilt back after the body clears it. Existing actor state sends `Wake` (already allowed string field), allowing the remote bed to uncover too; no backend/protocol/request changes.
- roofTileLength now includes thickness and tilt when leaving slope gaps, with additional ridge spacing cap for the first row. Removes intersecting coplanar END/SIDE faces on home, treehouse, mill roofs; underlying roof sheets remain. Previous fix only tested top faces.
- Tests now verify disjoint tile OBBs across all3 roofs, mouth vs quilt edge and actual posed model vertices vs quilt triangle heights (including boots), cloth/body proximity, and delayed movement until quilt clears feet. Build and8 targeted bedding/rider/surface tests pass; earlier18 related checks also passed.
- `bed-browser.mjs` captures covered/uncover/stand/awake plus low roof-side view. All snapshots inspected, errors empty;38 draws with Kirby unchanged. This does not constitute a full-scene FPS benchmark. Root `.wrangler/` remains local/untracked.


## Centipede boss asset / Topotushka (2026-10-10, local)

- User accepted friendly 3-phase boss: dodge charge/push tail bell; jump stomp waves/climb lowered back/push back bell; dodge rolling wheel/push balls into bell while dizzy; uncurl, victory sneeze. Boss precedes final starfall. Award points by individual participation/performance; no ride reward. Current scope ONLY model and all animations, not gameplay integration.
- New procedural master src/centipede-model.ts, catalog centipede-clips.ts, offline scripts/make-centipede.ts, public/models/centipede-animated.glb (22 full-channel clips). 12 segments/22 boots, blink, face/brow/antenna rig, TailTarget/BackTarget anchors. Vertex colours, 2 materials, 68 merged meshes, 92k triangles, 6.4MiB GLB. Wheel contact baked offline, back-stair pose extends shins to ground.
- Separate centipede.html viewer: phase demos, individual clips, orbit/zoom/views, pause/speed/download. New vite.config.ts includes game, firefly and centipede pages in production build. Asset not imported by main game. Model notes public/models/centipede-model.md. No server changes, no commit/push/deploy requested yet.
- Validation: production build and exported GLB regression pass (22 clips, loop seams, blink, moving legs, wheel contact, mesh/triangle budget). Desktop phase controls and mobile layout tested in headless Chrome, no page errors. Preview and clean portrait PNG saved beside GLB. Own preview Vite port5174 is running.

### Centipede animation corrections (2026-10-10)
- Replaced pinned-tail turn sway with head-first traversal of a quarter-circle path; tail follows same path with arclength offset, animated stepping, centroid kept in place. Turn clips now3.2s and finish facing90deg. Future gameplay controller must account for endpoint local heading.
- CoilArena/LowerBack/Rise and CurlWheel/Uncurl integrate convex arc tangents with fixed link spacing, rather than linearly interpolating positions through the body. Wheel bends into an arch then rotates closed; inverse for uncurl. Ground clearance baked for every intermediate wheel pose.
- Stomp rear inversion came from assigning Euler rotation.z after yaw quaternion conversion: beyond90deg Euler decomposition contains x/z=pi. Local rotateZ/rotateX now compose orientation without destroying yaw.
- Exported GLB tests sample81 instants per affected clip, checking nonadjacent body-center clearance, link spacing, upright segments, and tail following during turns; existing loop/blink/wheel tests pass. Production build passes; Chrome renders intermediate top/side views with no errors. Geometry/material budget unchanged. No commit/push requested for these corrections.

## Topotushka arena (2026-10-10, local)

- User requested choosing and drawing a spacious boss arena on the existing map, moving trees if needed. No combat/event integration or publishing requested.
- boss-arena-site.ts reserves center(140,-45), radius46 in birch biome east of Sky Trail; playable diameter72m. Site scan found47m unobstructed radius here. No river/track/other attraction moved. Shared sceneryClearance/outsideLandmarks relocates trees and excludes grass/decor/fruit from the arena.
- boss-arena.ts builds opaque static arena: tiled short turf, flush rainbow outer path, centipede medallion,4 broad entrances, birch-and-brass entrance arch with readable Russian sign/centipede face,8 flower tubs and4 bunting runs.5 merged/static meshes,40528 triangles, no lights/animation/shadow casts. Added via addEnvironment. Structural posts collide with local player and host NPCs; open play area and entrances remain freely walkable.
- Added navigation destination Арена Топотушки to Куда пойдём. Boss itself is still only in centipede preview. No server/protocol changes.
- Validation: production build and7 arena/forest/fruit/decor regressions pass. scripts/arena-browser.mjs checks actual game scene:5 additional draw calls, zero crown overlaps, no page errors. Captures public/models/boss-arena-overview.png and boss-arena-entry.png. Current main game entry at port5174/ (same own Vite as model preview). No FPS guarantee on mobile; counted render cost only.

### Topotushka roaming on arena (2026-10-10, local)
- Added ArenaCentipede, loaded with existing startup GLBs; decorative only, no battle, damage, event or points yet. Uses Walk/Run/Idle with smooth acceleration/deceleration and short pose blends. Scale1.25. Head follows a bounded closed route; every segment samples the same route at a fixed trailing distance. Additional parent pivots keep route transforms separate from mixer-owned properties, preventing repeated-time/culling pose accumulation.
- Roaming schedule is a pure function of absolute elapsed time. Online uses existing serverNow-room.epoch (boatTime); solo uses performance.now. No new server state, packets or requests. Culls animation at actor visibility radius+arena radius and resumes deterministically.
- Detailed model casts no shadows; one12-instance low-poly body proxy casts soft shadows. Existing shared shadow material preparation handles the new GLB during loading.
- New tests verify state schedule, stopped distance during Idle, continuous travel, full mesh world bounds inside arena for300s, segment spacing, repeated-time stability and culling resume. Build and both tests pass. Full game browser checked: model present, no page errors, close view captured public/models/topotushka-on-arena.png; arena-browser.mjs now requires roaming model too. No commit/push/deploy requested.

### NPC arena exclusion (2026-10-10, local)
- User requested keeping other Kirby NPCs out of Topotushka's arena. Separate constrainNpcOutsideArena excludes radius46 plus NPC body clearance, independent of height. Existing NPC movement probes choose a free heading before crossing; normal post-movement collision also handles levitation/pushes. Player constraint still only blocks structural posts, so entrances remain open.
- Initial and restored NPC positions inside the arena are projected outside, including safe handling at the exact centre. Host uses the same constraint in multiplayer and sends existing snapshots; no server/protocol/traffic changes.
- Build and6 targeted arena/NPC/roaming tests pass, including walking/running enlarged NPCs turning and continuing outside. No commit/push/deploy requested.

### Removed Shore Whistle music (2026-10-10, local)
- User requested removing Свист у берега. Deleted shore-whistle.wav, playlist entry and generator recipe;15 tracks remain. Updated existing playlist assertions. Music tests, generator syntax check and production build pass. No publishing/commit requested.

## Topotushka ordinary play event — first phase (2026-10-10, local)

- User changed the earlier plan: Topotushka is an ordinary repeatable arena event started with the action button near her, not a boss before the finale. Only phase1 implemented now. Shared centipede-event.ts runs invitation, visible warning lane, targeted charge, exhausted tail bell, tickle and celebration; three tail pushes complete the event. Head and segments follow the same bounded travelled path; unsafe self-crossing charges are rejected. Charge contact gives a springy bump, no damage/lives.
- Added Подружиться с Топотушкой to tasks (15 active tasks). Every participant with a successful dodge or tail push gets completion. Third bell credits immediately, before celebration, so leaving the arena afterward cannot lose the reward. Event resets to roaming and can start again. Existing automatic starfall still follows all tasks.
- User explicitly requested points only on first completion. First participation earns2 per tail push and1 per dodge (12 participation points maximum), plus ordinary3 task points. Completed players can replay but gain zero additional points. eventPoints is included in score, saves, reconnects, history and finale totals. Server protects both this reward and achievement against stale/client actor reports.
- Original cheerful68.57s event soundtrack topotushka-play.wav, separate from the15-track playlist, uses existing music volume/mute/visibility controls and returns to prior track. Soft protected Web Audio cues for every stage. Visual hints use just3 meshes (warning ribbon, tail halo,32-instance confetti), no new lights/shadows/postprocessing. Existing detailed model and simple shadow proxies retained; stage clips blend over180ms.
- Solo and Worker import exactly the same dependency-free event rules. Online sends stage changes and participation through existing batched frames; clients derive body motion from shared path/server time. Single-player online host emits one deadline frame per stage, no continuous boss coordinate stream or new HTTP polling. Small event state stored only on changes, separately from16KiB socket attachments.
- Network BUILD is now meadow-network-8 (protocol2 unchanged); client and Worker must be published together. Updated existing smoke scripts and added real authoritative centipede helper to finale smoke. No commit/push/deploy requested for current event, all changes remain local. Never commit root .wrangler/.
- Validation: production build, Worker TypeScript,30 targeted tests (rules/path separation/audio/roaming/NPC exclusion/music/save/score/network/finale) pass. Real E/Q browser flow passes first completion, unchanged repeat score, soundtrack/cues and HUD bounds without page errors; screenshots in TEMP kirby-topotushka-*.png. Two real local WebSocket players pass first task/rewards, no repeat points, rejoin state and unchanged world contract. Full authoritative mill+centipede completion then starfall smoke passes countdown, late join, host departure and duplicate-star rejection. Local game remains at http://127.0.0.1:5174/.

### Arena medallion colour flicker (2026-10-10, local)
- Adjacent centipede emblem ovals overlapped at exactly y=.055 in the same merged mesh; shared polygon offset could not resolve the colour depth conflict. During static construction, existing polygon-clipping subtracts earlier same-height silhouettes and triangulates disjoint coloured regions. Preserves the flat emblem, face layers, materials and five arena meshes; no extra textures/passes or per-frame work.
- Production build passes. Browser geometry check found maximum differently coloured coplanar triangle overlap below3e-9 square metres (float rounding); render has no page errors and no extra draw calls. Close-up screenshot TEMP/kirby-arena-inlay.png inspected. Client visual fix only; no commit/push/deploy requested.

### Wide Topotushka routes and victory (2026-10-10, local)
- User requested longer winding yellow run warnings, use of the full arena, and a cheerful melody/fireworks on victory. Roaming route expanded1.4x, preserving model scale/proportions. Event uses eight compact knots for broad230-degree winding sweeps up to32m from centre; path arc length is cached, every body segment follows the exact travelled line. Solver checks body self-clearance before choosing inward bend depth. Yellow ribbon now has64 joined sections, still one mesh.
- Shared durations now warning1.8s, run6s, exhaustion10s (time to reach the tail on the larger field), victory10s. Travel history resamples36 points at fixed link spacing so longer runs never truncate the tail's path. Rules and wire cadence shared with Worker; eight knots sent on stage changes rather than streaming positions. First-only points unchanged.
- Added original10s stereo C-major topotushka-victory.wav and reproducible make-centipede-victory.cjs. Music switches from event loop to nonlooping victory fanfare, respecting existing saved volume/mute, then restores background. A GPU-instanced salute makes five coloured rocket/starburst sequences with soft comet trails:430 billboards, one draw, no lights/shadows, only a clock uniform changes per frame. Personal decorative celebration anchors ahead of the observer once on victory, so it is visible with normal follow camera; does not follow camera movement afterward or affect gameplay/network state.
- Validation:10 relevant rule/model/music tests pass, including >75m curved runs, >57m coverage on both axes, body self-clearance, actual animated mesh bounds inside72m arena, victory WAV headroom, mute/volume and effect budget. Client build/Worker TypeScript pass. Actual browser E/Q completion/replay, victory track and visible one-draw salute pass without page/shader errors; screenshots TEMP/kirby-topotushka-*.png inspected. Two real local WebSocket players pass longer phases, first-only points and reconnect progress. Current changes remain local; no commit/push/deploy requested.

### Topotushka first-phase dodge balls (2026-10-10, local)
- User requested another dodge mechanic and a longer first phase. After each run, a new12.5s balls stage plays three Sneeze clips with1.45s warning before each fan. Three five-ball waves launch2.6s apart toward the arena centre, with alternating gaps. Ground ribbons preview each fan. Striped colourful rubber balls bounce/roll across the arena, disappear at its boundary, and gently spring-push Kirby; no lives or damage. The tail bell opens only after all waves. Adds37.5s to a normal three-bell event.
- Shared centipedeBalls and centipedeContact derive paths/collision keys from stage time; Worker and solo use the same rules. One bump per participant per wave (bitmask reset for all participants each cycle), airborne/rolling players excluded. Client collision requests deduplicate by stage/wave key through existing batched frames, no coordinate stream or new HTTP polling. A clean wave stage earns one dodge point within the existing12-point first-only limit; repeat completion still gives zero new points.
- Arena model turns head/neck toward the fan, uses existing Sneeze GLB clip for three timed releases, and adds soft cached inhale/ap-choo cues. CentipedeBallsView uses one instanced opaque ball mesh plus one instanced warning mesh,15 balls maximum, procedural cream stripe with derivative smoothing. No new lights, shadow casters, postprocessing or bitmap assets. Both meshes hidden outside the stage.
- Validation:20 relevant rules/model/audio/music/network tests, client build and Worker TypeScript pass. Browser real E/Q first completion and replay, visible balls, cue buffers, music/fireworks and mobile HUD pass without page/shader errors. TEMP kirby-topotushka-balls.png inspected. Local two-player network smoke passes shared waves, exactly one authoritative bump despite repeated contact frames, task completion, unchanged repeat scores and rejoin state. A first run was interrupted by dev Worker hot reload; a clean run passes. No commit/push/deploy requested; current changes remain local.

### All three Topotushka phases and minute rest (2026-10-10, local)
- Added phase2:5s gather into the accepted coil pose,6 expanding stomp rings with rotating safe gaps, then16s to fly up and push the back bell. Three bell hits progress to phase3. Arena-only air push on Q/gamepad/touch keeps flight and wing motion rather than interrupting it. Missed windows repeat the hazards without restarting the event.
- Phase3 is the hardest: tall rolling wheel follows changing broad zigzags while3 faster, narrower-gap ground rings spread. Ordinary flight clears rings but cannot pass through the wheel; sideways dodging is required. When dizzy, a glossy seven-colour ball appears7.5m toward centre; approach, face the wheel and push it. Animated ball flight and wheel reaction lead to the next round; after3 hits it unfolds and celebrates.
- Cumulative hits9, three per phase. Friendship/task/salute/victory fanfare wait for final unfold; participation cap remains12 plus3 first-only task points. Replays retain score. After10s celebration, Topotushka walks to a quiet part of the arena and rests60s; E cannot restart, departure cannot cancel the cooldown, and Worker durable restoration retains it.
- All timing, wheel/ring trajectories, collision masks, targets and progress remain in shared dependency-free centipede-event.ts, used by client and Worker. No streamed boss/wave/ball coordinates or new request cadence. All22 existing accepted GLB clips loaded; whole-body coil/wheel/rest clips no longer have segment positions overwritten by ground routing. Shadow proxies follow Motion/form transforms. Rings use one active instanced draw, ball one glossy mesh, no new lights/shadows/postprocessing.
- Validation:44 relevant client/shared/actual-Worker tests pass, client production build and Worker TypeScript pass. Browser actual E/Q/Space completes9 hits, no early task/salute, real double flight/back push, final fanfare, visible one-draw fireworks, mobile HUD, full cooldown and unchanged replay score; no page/shader errors. Two mock sockets exercise actual Worker replication, final-only awards, persistence/recreation during rest and replay. Existing real-socket smoke/helper updated for all3 phases (not rerun their full real-time minutes this turn). TEMP kirby-topotushka-stomp/wheelRoll/rainbow-ball screenshots inspected. Local game remains at http://127.0.0.1:5174/. No commit/push/deploy requested for this turn; all accumulated boss work remains local. Preserve unrelated root .wrangler/.

### Topotushka release (2026-10-10)
- User authorized commit/push and publication of ALL accumulated changes: full model/viewer, arena/roaming, NPC exclusion, three-phase event, first-only rewards, music/cues, fireworks/cooldown and removal of Shore Whistle. BUILD meadow-network-8, shared client/Worker logic; no secrets/migrations added.
- Full release regression:253/253 tests pass, client production build and Worker TypeScript pass. Updated old Worker mock storage/context APIs and seeded the two authoritative quest achievements in the finale fixture. Shore-rock regression now reads actual per-instance colours rather than the white batch material. Fixed a real existing large-Kirby bed exit overlap with the recently added dog house: exit projection clears both buildings before waking/restoring size.
- Cloudflare published successfully: Worker version0ba26e9d-69e6-4dfe-9460-6219fb5e6ef2 at https://kirby-game-server.kirby-game-server.workers.dev. Client uses existing GitHub main -> Vercel Production autodeploy. Vercel MCP unavailable this session; inspect commit/deployment statuses through GitHub API rather than creating another project. Root .wrangler/ remains unrelated/untracked and excluded from this release.

### Russian / English / Bulgarian localization (2026-10-10, local)
- Welcome screen now has three accessible flag buttons (CSS flags render correctly on Windows too): Русский, English, Български. Manual selection persists in localStorage `kirby-language-v1`. boot.ts reads saved choice before importing the scene; otherwise detects the first supported navigator.languages regional tag, falling back to English. Blocked storage cannot prevent playing. Language switches immediately without rebuilding or reloading the scene.
- src/i18n.ts and i18n-catalog.ts translate menu, character colour names, settings, keyboard/controller/touch help, tasks, navigation, action prompts, notifications, mill/Topotushka/starfall HUDs, results, canonical network events/errors and world signs. Tasks sort with a cached collator for the selected language, completed last. Player names and authored chat stay verbatim. Variant names, score-action IDs, save schema and server/network strings remain canonical Russian for backwards compatibility; do not translate domain identifiers. New displayed strings should get catalog entries; dynamic domain prompts/events can use known anchored catalog templates, whose player-name slots are not translated.
- Static DOM traversal runs only at boot and language switches. Dynamic text uses a bounded cache. localized-sign.ts redraws existing canvas textures only when the locale changes; no new geometry, lights, per-frame texture work or HTTP polling. All visible world sign lettering supports live switches. Music changes labels without restarting tracks; live player counts reuse the cached result on a locale switch.
- Validation:259/259 tests pass, including6 locale preference/template/name preservation/sorting tests; production build passes. scripts/i18n-browser.mjs passes browser Bulgarian detection, English fallback, persisted override/reload, flags/signs/scene reuse, unchanged nickname/chat, translated actual E mill quest and mobile Bulgarian chat. TEMP kirby-i18n-mobile.png visually checked. Headless scene construction can outlast initial presence fetch timeout; smoke refreshes via existing visibility handler after loader before checking count.
- No server/protocol changes and no commit/push/deployment requested for localization yet. All work stays local; game at http://127.0.0.1:5174/. Preserve unrelated root .wrangler/.
- User refined the language UI: it is now a single compact three-flag segmented switch on the right of the welcome heading, with no visible language names or separate button borders. A sliding selected indicator, radio semantics/roving focus and arrow/Home/End keyboard controls preserve accessibility. RU/BG flags retain their appearance; UK flag is anti-aliased inline SVG instead of layered diagonal CSS gradients. Desktop and375px portrait alignment/persistence checks and production build pass; TEMP kirby-language-toggle-desktop/mobile.png inspected.
- The gear settings now reuse the same compact three-flag switch below the input-device selector, on desktop and touch. Both switches share one stored locale and update together; only one static DOM translation listener runs per switch. Gamepad left/right changes the focused flag group, with existing up/down and confirm support. No scene restart, added requests or per-frame translation scan.
- Settings validation: production build and updated scripts/i18n-browser.mjs pass actual live settings changes, synchronized welcome selection, saved preference, unchanged nickname/chat/mill quest, mobile taps and keyboard arrows. Event HUDs are intentionally hidden while settings are open and refresh when shown again. TEMP kirby-settings-language-desktop/mobile.png visually checked. Vite restarted at http://127.0.0.1:5174/. No publication requested; localization remains local.

### Topotushka gameplay and visual fixes (2026-10-10, local)
- Event HUD has an explicit centred420px width. Arena entrance board is3.2m tall; its11.5x2.875m label matches the1024x256 canvas aspect ratio, with localized text fitted within the board. Yellow warning ribbons now have golden fill and dark edging in the same draw and stronger daytime opacity. Rainbow ground waves have a constant1.3m width and a shallow curved crest through the existing instanced vertex shader, still one draw per active wave type, no lights/shadows.
- Shared centipedeSegments bends a connected five-link front arc inward for the sneeze, then relaxes it smoothly. Ball fans originate from the bent head on every client and on the Worker. Outgoing nonlooping clips now clamp to their final frame during blending rather than wrap to frame0; fixes the second coil and second lowering motion without modifying accepted GLB animations.
- Shared event rules now start emptySince when no human remains within the full46m arena, wait10 seconds before clearing, and cancel the countdown on return. Temporary unavailable/rolling characters still count as physically present. Victory/rest retain the full existing cooldown. HUD shows translated return/countdown text. Worker persists the clock only when it changes, schedules an exact deadline alarm, accounts for disconnects and retains the earlier alarm when its housekeeping runs. Host sends at most one extra deadline frame, no continuous coordinates/polling.
- Client suppresses repeated start requests while awaiting acknowledgement and removes play prompts for active events. Worker rejects simultaneous/stale start requests without replacing the event and replies with current room state to repair stale prompts; tests exercise a second player's repeat requests and alarm reset with no incoming frames.
- New centipede-collision.ts uses twelve cached body ellipsoids from the same animated matrices as body shadow proxies. Bodies block side passage, catch descending feet, carry a standing player with the segment, preserve flight launch height through the ordinary ground pass, and apply gravity on leaving a back. Handles solo/online player movement locally, adding no network payloads, geometry scans or raycasts. Rides/sky trail bypass these surfaces.
- Validation:265/265 tests pass, client production build and Worker TypeScript pass. Real E/Q/Space browser flow completes all nine hits, cooldown and unchanged replay score without errors. Additional actual-game checks pass back landing/re-jumping, return cancellation and empty reset, centred HUD and daytime effects. TEMP kirby-topotushka-day-lane/bent-head/arena-sign/stomp/wheelRoll images inspected. No commit/push/deployment requested this turn; client and server fixes remain local together with pending localization. Preserve unrelated root .wrangler/.

### First-visit browser language diagnosis (2026-10-10, local)
- User reports Russian initially in English Chrome/OS incognito. No application detection failure reproduced: actual full scene in fresh Chrome en-US has saved=null, html.lang=en and Welcome!, without page errors. Five isolated boot cases pass EN first with RU secondary, RU first, BG, unsupported-language EN fallback and explicit saved RU override. Added mixed EN/RU priority assertions to existing locale tests; all six tests pass.
- Read only the local Chrome language preference fields. Interface app_locale=en, selected_languages=en-US,en, but accept_languages still begins ru-RU,ru. This mismatch is a possible explanation, not a verified navigator value from the user's failing incognito tab. An isolated Chrome profile with those fields normalizes to EN on startup; do not claim the current tab necessarily reports Russian.
- The first console JSON attempt returned a SyntaxError; a simpler navigator.languages command succeeded. User confirmed the failing incognito tab reports [ru-RU,ru,en-US,en]. Diagnosis complete: Russian is the browser's first content-language preference, so selecting RU is correct despite English UI/OS. Explain separate Chrome preferred web-content languages and suggest moving English first/reopening incognito or choosing the stored English flag. No application precedence change needed. Saved manual choice still wins; no automatic locale persistence occurs. No production logic, Chrome settings, commit or deployment changed.

### Natural Topotushka transitions and rounded blue warnings (2026-10-10, local)
- Phase2 gather now walks along one forward-only, tangent-continuous head path; each body link follows by travelled distance instead of interpolating/compressing all links to the centre. Cached turn/straight/turn candidates check arena bounds and body clearance. Gather lasts12s; feet advance with travelled distance. Final third-phase unfold and celebration keep the wheel's actual location/heading, then a12s walk carries her to the quiet corner within the unchanged60s rest cooldown. Path-driven world transforms reset the previous form offset atomically, avoiding double translation during the first rest frames. Accepted GLB coil/uncoil clips unchanged.
- The empty-arena10s countdown stays visible at any distance while playing, independently of effect culling; returning cancels it without resetting progress. Shared client/Worker rules remain deterministic, with no new payload fields or packet cadence. Shared timing/path changes must be published on client and Worker together when requested.
- New centipede-warning-geometry.ts makes continuous run ribbons with smooth bends and semicircular caps, still one draw rebuilt only on route changes. Ball warning lines use full-sized capsule geometry in the existing instanced draw. Latest user refinement replaces bright yellow with muted blue #86c1d6, quiet edging #31576a and opacity around.6 (.46 during travel); unlit/toneMapped:false remains readable at night without lights or glow. RU/EN/BG warning hints now refer to the blue path.
- Validation:270/270 full-suite tests passed before the colour-only refinement;8 relevant geometry/localization checks and the production build passed after it. Worker TypeScript passes. Actual GLB transitions sampled at60FPS test body spacing/continuity through gather/fold/lower/rise/wheel/uncurl/rest; shared gather regression covers7 incoming routes and serialized late joins. scripts/centipede-fixes-browser.mjs passes real back landing/jump, centred HUD, far-away countdown, returning/reset, natural transition snapshots and muted blue day/night renders without page/shader errors. TEMP kirby-topotushka-day-lane/night-lane/rounded-run/rounded-balls images inspected. Local game remains at http://127.0.0.1:5174/. No commit/push/deployment requested for this turn; pending localization and boss fixes remain local. Preserve unrelated root .wrangler/.

### Localization and Topotushka fixes release (2026-10-10)
- User authorized publishing all accumulated localization/Topotushka fixes, commit and push. Final release regression:270/270 tests pass; client production build and Worker TypeScript pass. Origin/main was fetched and matches the previous release before commit. No new protocol version, bindings, secrets or migrations.
- Cloudflare deployment succeeded: Worker version8be109d1-5610-4a55-b310-369686828456 at https://kirby-game-server.kirby-game-server.workers.dev. Existing GitHub main -> Vercel Production autodeploy publishes the client after push; verify the new commit's GitHub deployment/status rather than assuming push is deployment confirmation. Root .wrangler/ remains local/untracked and must be excluded from Git.
- Release commit9a09eabfedb3b9c8fbb35df56e56fe0e59ca51dc pushed to origin/main. GitHub Vercel status and Production deployment6985081275 both confirm success. Public game https://codex-playground-rust.vercel.app responds200 with the new game/main/i18n bundles; individual hashed Vercel deployment URLs redirect to Vercel SSO, so use the public homepage for checks. Cloudflare /health and /players respond normally.

### Calm meadow style — first pass (2026-10-10, local)
- User accepted trying a calmer, coherent scene. Start with ground and biome palettes as proposed; paths/new plant arrangements are later options, not implemented in this pass. New biome-style.ts centralizes ground/grass/shrub/flower/mushroom/deciduous crown colours. Four biomes retain cool spruce green, soft birch green/ivory/blue, fresh orchard green/pink and muted autumn ochre. Pink tree crowns and spruce colours retain their existing appearance; playable characters/rewards stay bright.
- Repainted existing512px grass detail into curved fans, soft tuft creases and short grass, now6m per tile. Broad tonal variation stays baked in the existing512px biome map. Reduced yellow cast and grain, kept smooth biome blends, mipmaps/trilinear filtering/anisotropy. Same two1MiB raw texture buffers and two texture samples, opaque single ground draw; no normal maps, postprocessing, extra lights or shadows. Generation occurs only at scene construction, using simple squared distance/masked seamless brush wrapping.
- Existing144,000 grass blades made shorter/wider/curved with softer base shading, keeping exactly the same vertices/triangles/instances, seeded placements, distance fading, LOD and dry-ground/attraction clearances. Existing shrub/flower/mushroom geometries only recoloured; tree geometry/layout and gameplay unchanged. Client visual changes only; no server/protocol changes and no publishing/commit requested yet.
- Validation: production build and4 relevant forest/decor placement/render-budget tests pass. scripts/meadow-style-browser.mjs checks four real-scene biome views and night without errors; also844x390 touch-browser emulation (not a real-phone FPS test). Photos in TEMP kirby-meadow-before/after[-mobile]-*.png inspected. Optional STYLE_BASELINE points to saved compiled old ground module; A/B renders old/new/old material in one frozen scene. Quiet repeat: identical calls/triangles for every A/B; render+gl.finish medians old controls/new roughly8.05/8.3ms spruce,8.25/8.4ms birch,15.3/15.5ms orchard,14.3/14.5ms autumn. Small differences do not establish a real FPS regression or improvement; earlier concurrent-build samples had unstable controls and were discarded. Local game remains at http://127.0.0.1:5174/.

### Natural meadow groups, trails and river banks (2026-10-10, local)
- User accepted all follow-up landscape ideas: winding paths, naturally grouped plants, ground treatment near buildings, softer shores and calmer distant mountains. During implementation explicitly requested natural riverbanks/bends rather than a vertical trench or spoon-shaped corners. All implemented locally; no commit/push/deployment requested in this turn. No Worker code or wire contract changed. Preserve unrelated root .wrangler/.
- New MeadowLayout builds a deterministic startup-only trail network linking actual doors, ladder/swing, depot approach, balloon ports, benches, maze/sky-trail entrances, fountain and arena entry. Heap-based grid routing avoids water except the three existing bridges, solid buildings and actual tree trunks. Local validated rounding and metre spacing keep bends smooth and lookup size bounded. Existing trees are retained; paths use shared branches and narrow approaches. Worn entrance/bench clearings and soft irregular trail edges are baked into the existing 512px biome map; map alpha controls how strongly the existing grass-detail sample affects soil. Opaque material, same two texture samples/two texture buffers, no overlay planes, bump maps, lights or shadow passes.
- Grass retains its 144,000-blade ceiling and spatial LOD/fade. Broad seeded density fields and elliptical plant groups replace uniform random patches; dense understorey grass, shrubs and occasional ferns/mushrooms follow crowns. Small flower gardens frame doors/benches/depot without blocking approaches. Sparse reed pockets stand on flat dry land beside the actual shore. Detailed plants still merge into existing 48m cells, now capped at850,000 triangles. BIOME_TERRAIN coordinates restrained earth/shore/foothill/rock shades; mountain geometry unchanged and texture contrast reduced.
- Rivers now relax routing-grid corners into broader curves and use a gentler closing route. The final lake outlet continues downstream before a wide bend, avoiding a boat hairpin. Rounded shared water contours remove sharp lake/channel joins. Matching irregular 1.35-1.95m banks replace vertical walls; offset self-crossings resolve with existing polygon-clipping before one indexed bank mesh is triangulated. Bank reuses the ground material/maps. Whole water/terrain remain one closed circuit and three bridges; boat hull/umbrella clearance and smooth heading tests pass.
- BankSupport indexes rendered triangles in4m cells once; player/NPC walking follows the actual visible bank height, with no per-frame raycasts. dryGround retains its original dry-land semantics (including sloping dry banks), preserving mill quest zones. New flatGround is used for y=0 scenery and bridge landings, preventing hovering flowers/rocks/plants on slopes. Degenerate polygon holes are filtered; bank faces point up and ray-based regression tests verify no missing sampled triangles and matching support.
- Final validation:272/272 full-suite tests and production build pass; diff whitespace check clean. scripts/meadow-style-browser.mjs adds entrance/bridge/river-bend/overview captures, mobile emulation and STYLE_COMPARE=1. The comparison compiles HEAD's old ground/decor into temporary browser routes and renders old/new/old in one frozen current world. It isolates ground/decor changes, not the old river geometry. Total decor triangles old1,321,100/new1,281,942; four views have identical calls except+1 spruce draw. Stable old-controls/new render+gl.finish medians roughly5.8/6.0ms spruce,5.9/5.9 birch,12.55/12.5 orchard,11.0/10.9 autumn. Close timings do not prove real-phone FPS equivalence. Actual local day/night/bridge/home/mill/river views have no page or shader errors; screenshots in TEMP kirby-meadow-landscape-*.png. Local game remains http://127.0.0.1:5174/.

### Textured, gently winding meadow paths (2026-10-10, local)
- User requests more natural paths: visible texture instead of plain grey, and broad bends rather than ruler-straight stretches. Added constrained world-space meanders (up to6.5m/6m displacement), softened long corners and slowly varying width. Door/junction endpoints and bridge approaches remain pinned; displacement fades near obstacles and short spans are checked against the same dry-bank/tree clearance. meadowPathHalfWidth is shared by the ground raster and plant-clearance index so the visible edge and vegetation agree.
- Path colours now use warmer biome-matched earth. Fine soil grain, shallow rounded pebbles and grass fragments pack into the existing512px turf tile: R retains original seeded grass, G earth relief, B stones/stems. Shader still fetches the same two textures; no added geometry, overlays, lights, shadows or texture memory. All layout/texture generation happens at startup, not per frame or in network messages.
- Validation:6 relevant layout/decor/forest tests pass; strengthened path test samples variable width and points inside every span, keeping trunks and water clear. Final production build passes. Local desktop/day/night and844x390 phone emulation renders have no page/shader errors; close path screenshots inspected in TEMP kirby-meadow-path-detail and kirby-meadow-paths-final-mobile. Same-frozen-scene material A/B keeps identical calls/triangles, render medians remain within control noise (not proof of real-phone FPS). Diagnostic script supports STYLE_PATHS=1 and passes current layout to baseline material. All landscape changes remain local at http://127.0.0.1:5174/; no commit/push/deploy requested and no Worker changes. Preserve unrelated root .wrangler/.

### Browner paths with soft earth edging (2026-10-10, local)
- User requested more brown and an edge border on paths. Updated only BIOME_TERRAIN.path colours to warm brown variants; baked a soft irregular dark earth rim from the combined wear mask into the existing biome map. The union mask prevents inner outlines at path intersections. Existing layout, grass, shore palette, packed detail texture, shader and draw budget stay unchanged; no per-frame work or server changes.
- Production build and2 relevant meadow-layout/bank tests pass. Actual day/night close-path browser renders have no page/shader errors; inspected TEMP kirby-meadow-brown-rim-path-0/path-1/night.png. Changes remain local, no commit/push/deploy requested.

### Clear paths of existing scenery (2026-10-10, local)
- User noticed decorative objects/flowers on paths. Legacy createLandmarks previously lacked the shared MeadowLayout used by the newer undergrowth. Environment now passes the same layout and actual tree positions to both. Old flowers, reeds, stones/moss and mushrooms relocate as whole objects to nearby dry verges; picnic blankets and baskets move together while interactive benches/seat coordinates remain fixed. Placement avoids water, trees, structural footprints, attraction approaches and already relocated decor. sceneryClearance has an optional own landmark exemption for its own decorative groups; default gameplay/tree/fruit semantics unchanged.
- MeadowLayout.clearOfTrails now includes1.4m for the painted irregular edge/filter fringe, plus object radius. Segment indexing reaches6m beyond the edge to support large picnic footprints. Shared moveOffTrail performs a bounded deterministic nearest-ring search up to24m and rejects solids. New meadow plants use the same relocation helper; grass stays off the wider clear corridor. All work is startup-only; spatial batching, grass144k-blade limit, detailed-plant850k-triangle ceiling and LOD remain.
- Validation: relevant decor/path/landmark/shore tests pass, plus forest/fruit layout regressions; final production build passes. Regression checks actual instanced flower stem positions as well as whole-object metadata, dry land, tree clearance and bounded movement. Grass coverage regression excludes intentionally bare paths. Actual-game diagnostic audits1198 legacy decorative objects and2414 new plant sites,128 legacy objects relocated, zero path/rim overlaps, no page/shader errors. Day/night close-path screenshots in TEMP kirby-meadow-clear-paths-final inspected. Changes remain local at http://127.0.0.1:5174/; no Worker changes or requested commit/push/deploy. Preserve unrelated root .wrangler/.

### Continuous filtered path edging (2026-10-10, local)
- User reports stepped/dotted path rims and requests a smooth gradient into grass. The narrow dark border was baked into the512px world map before filtering, so some approximately1m texels missed it. Map alpha now packs signed distance to the union of path/clearing edges in metres[-4,4]; the existing filtered sample forms a continuous soft rim and soil-to-grass gradient in the fragment shader. Raster sampling uses texel centres; low-frequency edge irregularities replace short noisy ripples and varying rim intensity. No internal border at branch joins. Warm brown biome palette and fine packed grass/soil tile retained.
- Same two512px RGBA textures, two texture samples, opaque geometry and shadow/draw budget. One vertex varying damps grass detail on sloping banks. No extra texture buffers, overlays, lights or per-frame scene scans; path-distance generation remains startup-only. Client visual change only; no Worker/protocol changes.
- Validation: production build and6 relevant meadow-layout/decor tests pass. Actual-game day/night close-path captures in TEMP kirby-meadow-smooth-rim inspected, no page/shader errors or decorative path overlaps. Same-frozen-scene old/new/old material comparison retains identical calls/triangles in all three views; old controls/new medians8.7-9.3/8.5ms,9.2-9.5/9.3ms,6.2-6.6/6.4ms. Timings remain within control noise, not proof of real-phone FPS equivalence. Changes stay local at http://127.0.0.1:5174/; no commit/push/deploy requested. Preserve unrelated root .wrangler/.

### Dense woodland groves and path-side shrubs (2026-10-10, local)
- User requested trees/bushes alongside paths, groups of trees rather than isolated placements and roughly five times as many trees, with continued priority on performance. Forest now has2229 trees instead of446. Mature anchors (including153 foothill trees) and the established path layout are preserved;1783 younger trees form seeded elliptical groves around anchors, along both verges and in open woodland pockets. Broad density fields retain clearings between copses. Species/palettes follow the four existing biomes, with varied heights and slightly narrower young deciduous crowns; mature wide birches and spruces retain their proportions. Entire crowns keep tree/track/attraction/shore/path clearance. All planning is startup-only and deterministic.
- forest-lod.ts batches each material into64m cells with three distance/hysteresis levels. Close deciduous crowns retain their original folded leaves; middle/far crowns use28%/7.5% as many larger leaves, bounded in width. Far twigs/bark/ornamental fruit disappear; pines drop small sprays and cone subdivisions. Equal-instance levels share matrix/colour buffers. Separate continuous crown/trunk shadow silhouettes stay independent of visible LOD; pine shadow proxies use the main seven tiers. No added lights, textures or HTTP/network payloads.
- Meadow undergrowth adds138 direct path-side shrub sites and distributes bushes beneath mature crowns and beside young spruces. Bush prototypes use52 larger leaves and five orchard berries instead of80/12, allowing more shrubs within the unchanged850k detailed-plant triangle cap; grass remains144k blades. Static MeadowIndex queries replace whole-map scans for trunks, plant overlap, rails and fruit obstacles. Reserve70 fruit clearings before grove/undergrowth placement. An actual startup failure from exhausting fruit locations was caught and fixed by keeping shrubs off those clearings; full combined tree+bush fruit-placement regression now checks all70 remain accessible. Early triangle-budget rejection prevents wasted relocation searches after a plant budget fills.
- Validation: final production build and6 forest/decor/fruit regressions pass; the broader path/landmark/fountain/treehouse run passed its other16 checks before final density tuning. Tests check near-fivefold population, grouping, all-biome/foothill coverage, full crown/track/path clearance, three LOD levels with hysteresis, distant forest under1.5M triangles, actual world-space crown positions, dense undergrowth/grass coverage and all70 fruits with the real combined obstacle list. No Worker imports the changed placement code; no Worker/protocol changes.
- scripts/forest-groves-browser.mjs compares saved pre-change Vite modules from TEMP kirby-forest-groves-before.js and kirby-decor-groves-before.js in one frozen real scene (forest+undergrowth only), with warm old/new/old controls. Final five captures inspected in TEMP kirby-forest-groves-*.png; game loads and starts, original anchors match exactly, no page/shader errors or path-obstructing new trees/shrubs. Stable old-controls/new render+gl.finish medians: spruce6.9-7.2/7.0ms, birch10.3-10.4/11.0ms, orchard8.3/8.3ms, autumn7.1-7.5/7.7ms, full overview22.2/23.4ms. Overview triangles fall8.67M->6.45M despite the fivefold population; ordinary view draw counts change by-3 to+27. This headless desktop comparison is not a real-phone FPS guarantee. All landscape work remains local at http://127.0.0.1:5174/; no commit/push/deploy requested. Preserve unrelated root .wrangler/.

### Close crown LOD and biome undergrowth colours (2026-10-11, local)
- User reports missing/incomplete crowns even close to trees, bright green shrubs under spruces and requests slightly darker ground in every biome. Diagnosed centre-based hysteresis in the new 64m forest cells: the return threshold shrank by 15% of the entire cell-centre distance, retaining sparse distant leaves near outer crowns. Actual-game audit of101 deciduous batches /202 approaches found12 such near approaches. ForestLOD now measures camera distance to the cell's bounding surface, then applies the existing6m/65m detail distances with hysteresis based only on those gaps. Full crowns return beside cell-edge trees from either direction; distant geometry still uses28%/7.5% leaves and stable shadow proxies stay separate. Instanced middle/far meshes compute their own shape bounds once at startup rather than sharing a different level's sphere; regular frustum culling is retained. No per-tree scans, new draws, lights or textures.
- Shared BIOME_STYLE ground colours are modestly darker for all four zones. Grass/bush/fern/reed leaves follow subdued cool deep greens in spruce, soft olive greens in birch, richer greens in orchard and warm olive/ochre in autumn. Crown/flower/fruit colours, ground detail/path texture, biome boundaries, geometry budgets, placements and gameplay unchanged. Plants retain their cheap unshadowed Lambert rendering.
- Validation: production build and8 targeted LOD/forest/decor/fruit checks pass. New forest-lod tests cover approaching both outer trees after starting far away, exactly one active level and actual camera-frustum/vertex bounds at all levels. scripts/forest-crowns-browser.mjs audits202 approaches and actual renderer LOD updates, captures all four biome views and night, and replays old/new/old thresholds in the same frozen scene. Desktop and844x390 touch emulation have no page/shader/startup errors; all202 approaches restore full crowns. Captures inspected in TEMP kirby-forest-crowns[-mobile]-*.png. A/B keeps identical draw counts in each view; triangles change0 to~0.9% where full detail returns sooner. Timing samples are noisy (including unchanged-geometry views), not proof of real-phone FPS equivalence. No Worker/protocol changes; all landscape changes remain local at http://127.0.0.1:5174/. No commit/push/deploy requested. Preserve unrelated root .wrangler/.

### Natural darker lake and river water (2026-10-11, local)
- User requests more natural, textured and darker water, removing the mirror-like sun glint while prioritising performance. The shared Ponds lake/river surface previously used a simple128px colour tile, roughness0.2 and metalness0.22. New water-surface.ts bakes one512px seamless tile: RG stores ripple slopes, B tonal variation, A roughness variation. Periodic domain warping and mostly aligned wavelets of several sizes avoid a regular crosshatched grid. Deep/crest teal colours are darker and less saturated. Standard material metalness0, roughness~0.68 produces soft illumination from the existing sun/moon; packed slopes perturb the lighting normal using the same map sample as colour, without a second normal texture/sample, reflection pass, new lights or geometry.
- Texture remains opaque and mipmapped with bounded anisotropy; moving the existing UV offset animates both tone and ripple lighting without uploading texture data per frame. Main shadow/material preparation continues composing onBeforeCompile with CSM. Existing water mesh/banks/bridges/boats/swimming geometry and interactions unchanged; fountain and mill falling-water effects retain their specialised materials. One512px RGBA texture plus mipmaps replaces the128px tile (about1.33MiB versus0.083MiB); draw count, triangles and texture fetch count unchanged. No Worker/protocol changes.
- Validation: final production build (176 modules) and15 existing pond/bridge/swimming/boat regressions pass. scripts/meadow-style-browser.mjs adds STYLE_WATER=1 to recreate the exact previous water material with matching shadow/texture setup, compare old/new/old in the same frozen scene, and capture both versions plus night. Final desktop and844x390 touch emulation captures in TEMP kirby-meadow-water-final-* and kirby-meadow-water-ripples-mobile-* inspected; the final mobile captures use the aligned warped ripple field. No page/shader/startup errors. All four A/B views keep identical draw/triangle counts; final mobile render+gl.finish medians new24.1/24.0/30.3/19.9ms versus old controls22.7-24.9/23.2-24.5/30.1-31.4/20.1-20.6ms, within control noise. This desktop touch-emulation benchmark is not real-phone FPS evidence. Changes remain local at http://127.0.0.1:5174/; no commit/push/deploy requested. Preserve unrelated root .wrangler/.

### Wider tree detail, visible orchard fruit and softer water (2026-10-11, local)
- User still dislikes close tree/leaf detail changes, wants the same distance as visible firefly models (ACTOR_DISTANCE=168m, not halo84m), and reports tree fruit appearing only immediately nearby. Forest batches now use shared ACTOR_DISTANCE for full detail and2*ACTOR_DISTANCE for middle-to-far detail instead of6m/65m. Decorative fruit previously disappeared at the first6m transition along with bark/fine twigs; it now remains in full detail throughout the168m range. Distances remain measured from batch bounds, conservatively keeping outer trees detailed. Hysteresis extends the outward threshold by15%, while approaching restores detail at the full advertised range, including when approaching directly from the farthest level. Shape-specific bounds, instancing, frustum culling and separate stable shadow silhouettes remain.
- Tests cover both ends of a64m cell, fruit visibility after distant approach, the168m boundary, departure hysteresis and all-level mesh/frustum bounds. Production build and3 LOD tests pass; other16 forestry/pond/boat checks also passed during this change. scripts/forest-crowns-browser.mjs now audits real orchard fruit as well as crowns:122 batches including21 fruit batches,244 close and244 range approaches pass with no page/shader errors. Desktop and844x390 touch emulation old/new/old comparisons replay the previous6m/65m surface-distance behaviour in the same frozen scene. Wider detail increases visible triangles materially (roughly1.4-1.8x in sampled views); mobile-sized desktop medians new6.4/7.7/19.4/12.7ms vs old controls6.0-6.6/7.4-8.7/18.7-19.1/12.3-12.4ms. Do not claim unchanged workload or real-phone FPS; user's performance priority remains important. Images TEMP kirby-forest-crowns[-mobile]-*.png inspected.
- User noticed little diamonds/lines in the water and requested further darkening. Replaced superimposed sinusoidal wavelets with seeded seamless, warped multiscale gradient noise baked once into the same512px packed RG slope/B tone/A roughness texture. Slightly broader10m repeat, softer slopes, narrower dark teal palette#1c515b/#326d75 and roughness.76 remove the regular crossing-wave lattice and weaken highlights. Same single texture sample, buffer size, opaque water draw, geometry, lighting and UV animation; no per-frame generation or uploads. Fountain/mill specialised water unchanged.
- Actual-game close/lake/night captures TEMP kirby-meadow-water-soft-noise-mobile-*.png inspected: no regular diamonds, dark soft ripples, no page/shader/startup errors. Against the diagnostic's original pre-water material, all four frozen views retain identical calls/triangles and comparable render times (new18.2/15.5/26.4/15.4ms, controls17.9-18.7/15.2-15.4/26.6-26.8/15.1-15.3ms). Final client bundle main-CGYUxeFO.js. No Worker/protocol changes or requested commit/push/deploy; accumulated landscape work remains local at5174. Preserve unrelated root .wrangler/.

### Planted Topotushka boots, prompt tail bell and darker arena (2026-10-11, local)
- User reports floating/moving feet while standing, excessive waiting after phase-one sneezes, and overly bright arena colours/floor in daylight. Master centipede-model.ts now suppresses lateral body undulation in Idle/Exhausted/Sneeze and counterposes legs against body breathing/scaling/height. Offline geometry bounds supply the actual sole height; compensating transforms are baked into existing animation tracks, keeping sole bottoms at0.02 model metres /0.025 arena metres. Blinking, head/antenna movement and breathing remain. Regenerated centipede-animated.glb has the same68 meshes /92,268 triangles,6,907,540 bytes vs6,863,852 previously (about43KiB extra tracks). No runtime vertex scans, added geometry, draws or lights.
- Shared CENTIPEDE_TIMES.balls now derives from3*2600ms sneezes+700ms, giving8500ms instead of12500ms. The bell opens about0.7s after the final sneeze instead of4.7s, preserving all three launched ball fans. Other phase timings, rewards and60s cooldown unchanged. This shared file is imported by the Worker, so publish client and Worker together at the next requested release; no wire/state/cadence changes. No deployment requested this turn.
- Arena turf uses darker moss/olive base#4b613a with subdued detail, centre background#657b50, darker cream/earth rings and muted rainbow colours. Existing256px turf texture, materials and merged geometry/draw budget unchanged. Final colours were tuned against the actual sunny scene rather than only their raw RGB values.
- Validation:27 boss/model/arena/collision/shared-Worker checks pass, including actual exported/interpolated GLB soles and motion across three stationary clips, all existing coil/wheel/grounding/transition checks, early tail push, cooperative phases and server cooldown/replay rules. Client final build and Worker TypeScript pass. Updated scripts/centipede-fixes-browser.mjs checks the real solo loop opening the bell and pressing Q, all22 stationary boots in the actual arena (ground error<0.000001m, sliding<0.0000001m), and retains previous UI/collision/countdown/transition checks. Final day captures TEMP kirby-topotushka-planted-feet.png /kirby-topotushka-dark-arena.png inspected; no page/shader errors. Final main bundle main-DPv6g3u4.js. All changes remain local at5174 together with pending landscape edits; no commit/push/deploy requested. Preserve unrelated root .wrangler/.

### Mill sack mat moved off the trail (2026-10-11, local)
- User reports one mill quest sack mat sitting on a path. Actual MeadowLayout identified the red sack at [68,0,54]. Moved its shared MILL_BAGS anchor to [76,0,61], moving the woven mat, visible sack, pickup validation and rejected-sack return together. Other two mats stay in place. Shared rules are also imported by the Worker: deploy client and Worker together at the next requested release.
- landmarks.ts retains the old [68,0,54] vegetation clearing as well as the new sack locations. Without this, deterministic mature-tree placement changes and reroutes paths elsewhere; the final version preserves 446 mature /2229 total trees and the existing path layout. All three entire 1.6m mats clear paths including their soft rim, banks and trees. Red mat centre is 3.25m outside the path edge and 12.88m from the nearest trunk. No added meshes, lights or per-frame work.
- Client mill-quest-browser.mjs now reads shared MILL_BAGS instead of duplicated coordinates; Worker mill-quest-helper.mjs updated. Build and six existing mill quest/forest spacing checks pass. Actual local-game browser verifies all mats clear, red sack pickup succeeds, no page errors; TEMP/kirby-mill-bag-grass.png inspected. Final main bundle main-C6g2RJHU.js. No commit/push/deploy requested; all accumulated work remains local at5174. Preserve unrelated root .wrangler/.

### River banks corrected and accumulated meadow release (2026-10-11)
- User reports dry river banks dipping below the water level and requests publishing all accumulated work, commit and push; explicitly leaves client checks to their own testing. bankHeight now slopes down only to WATER_Y+0.02 instead of WATER_Y-0.10. Rendered bank triangles and BankSupport share these heights, keeping every dry bank edge above the water while preserving smooth contours, bridges, swimming and the same geometry/draw budget. Existing bank regression expectation tightened to the new minimum. No client tests or browser checks run for this release at the user's request; the existing Vercel deployment performs its build.
- Release includes the pending biome meadow/plant groups, winding textured paths and soft banks, dense forest groves, longer crown/ornamental-fruit LOD ranges, darker irregular water, planted Topotushka feet/darker arena/earlier phase-one bell, and red mill sack relocation with its common pickup anchor. Preserve unrelated root .wrangler/ and exclude it from Git.
- Worker TypeScript passes. Origin/main fetched and matches HEAD before release. Cloudflare deployment succeeded: Worker version9fc9d728-628b-4b3f-92a9-07f6e28e5509 at https://kirby-game-server.kirby-game-server.workers.dev; no new secrets/bindings/migrations. Client publishes through the existing GitHub main -> Vercel production integration at https://codex-playground-rust.vercel.app; verify deployment status for the release commit after push.

### Stone arena and clearer phase-three wheel routes (2026-10-11)
- Previous release ad4a855699651cfe7d11ffc0584249d624ffc6b3 was pushed; the user confirmed its client was published and asked to stop waiting for Vercel.
- User reports wheel route warnings disappearing over the small central arena disc at some angles, and asks for wider, less intersecting phase-three routes. The disc's existing negative polygon offset could occlude the unbiased transparent ribbon. CentipedeEventView now gives the ribbon a stronger -4 factor/-4 units bias, preserving depth testing/writing behaviour so it remains a floor marker. Isolated actual-arena GPU comparison reproduces the old failure (8/21 centre samples visible) and confirms 21/21 visible with the fix at camera heights0.65/2/7m. No new draws, shaders or per-frame geometry work.
- Shared aimWheel replaces repeated criss-cross chords with eight compact knots forming a broad <one-turn sweep and one inward bend. Starts exactly at the last stop, keeps the previous clockwise/counterclockwise heading, reaches31m from arena centre and varies the inward bend between18/20/22m. The8.5s roll, rings, rewards/cooldown and network cadence remain unchanged; only one extra compact knot per route transition. Twelve successive rolls pass self-intersection, inner/outer coverage, >130m distance, 32m bound, >60m two-axis coverage, stop continuity and JSON late-join determinism checks.
- Additional user request: stone arena floor. New arena-stone-texture.ts bakes periodic irregular Voronoi flagstones, muted slate/earth variation, fine grain, weathering, hairline cracks and narrow grout into one512px mipmapped repeating colour texture. Roughness remains1, anisotropy2; no normal/roughness maps, extra lights or stone meshes. Centre and outer stone surface share one merged floor draw and world-aligned UVs; the centre emblem remains, its flat green backing removed. Decorative central ring keeps a geometry gap to avoid coplanar floor overlap. Floor texture replaces the old256px turf map; about1MiB additional mipmapped texture memory and ~42 net triangles, no extra draws.
- Validation:24 existing/added centipede model/gameplay/shared Worker/warning checks pass; client build and Worker TypeScript pass. Focused actual-arena browser rendering has no page/shader errors. TEMP/kirby-arena-stone-overview.png, kirby-arena-stone-close.png and kirby-arena-warning-centre.png inspected. Main bundle main-DPpufcbn.js. Cloudflare published versiond654f0b8-1b5a-487a-9264-394c894fb3b6 at https://kirby-game-server.kirby-game-server.workers.dev. Client releases through GitHub main -> existing Vercel production integration. Preserve unrelated root .wrangler/; exclude it from this commit.

### Forward-rolling Topotushka wheel (2026-10-11)
- Previous stone-arena release a6821f9 was pushed and Vercel Production deployment6987550229 confirmed success.
- User reports phase-three wheel rotation opposing travel and requests immediate deployment, commit and push. Changed the master WheelRoll animation's Motion X rotation from -phase to +phase: the model's forward axis is +Z. Regenerated public/models/centipede-animated.glb so the game and preview both receive the fix. Ground-contact offsets are baked offline for the corrected orientation. Same6,907,540 bytes,68 meshes and92,268 triangles; route, speed, timing, geometry and runtime work unchanged.
- Added an actual exported-GLB/ArenaCentipede regression: a material point at the bottom must rotate opposite the wheel centre's forward translation. Samples two differently oriented straight routes and a broad curved route at five times. Reproduced the original failure before the fix; all nine focused model/arena tests and client production build pass afterwards.
- Client-only asset/master/test change; no Worker, protocol or shared-rule changes, so no Cloudflare redeployment needed. Publish through the existing GitHub main -> Vercel Production integration at https://codex-playground-rust.vercel.app. Preserve unrelated root .wrangler/ and exclude it from Git.

### Directional sunlight and moonlight (2026-10-11, local)
- The previous wheel fix was committed/pushed as9513fcf. Waiting was interrupted, but the next turn confirmed GitHub's Vercel status is success, so that asset fix is published.
- User wants natural directional light from a visible moving sun by day and moon by night, with one main source. Removed the2.4 daytime/.7 nighttime HemisphereLight. CelestialLighting drives the existing CSM cascades together as one physical source, using warm4.6 sunlight or cool2.2 moonlight, fading at the horizon as before. The same direction positions the visible celestial body and drives both direct illumination and shadows. Local firefly light pool unchanged.
- A small non-emitting LightProbe approximates diffuse sky/ground reflection so shaded faces remain readable. Only constant/vertical SH coefficients are active. Per-material shader composition reduces its evaluation to two coefficients and one dot product with the view-space sky axis, avoiding nine-coefficient evaluation and an unnecessary normal transform/normalization. Existing texture/custom surface shaders and stable hardware shadow filter compose without global Three shader changes. No environment maps, extra textures, shadow maps or render passes.
- Celestial orbit is now a unit great circle tilted35deg over the mountain horizon rather than passing directly overhead; opposite moon follows the same plane. StableCSM's up vector derives from the shared perpendicular orbit normal, retaining noon/midnight stability and texel snapping. Day/night timing, saved/room phases and networking unchanged; the Worker does not import day-cycle.ts, so no server change. Sun disc radius19 instead of15; cheap material-only cloud scattering keeps their undersides softly lit.
- Validation:20 focused lighting/day-cycle/night/shadow tests and client production build pass; main-DwPeKZZM.js. Actual-game headless captures day/night/sun/moon/sunrise/sunset have no page/shader errors. TEMP/kirby-celestial-lighting-*.png inspected. Diagnostic scripts/celestial-lighting-browser.mjs keeps a repeatable9513fcf baseline and optional LIGHTING_BASELINE_REF override. Frozen A/B/control views keep identical calls/triangles and two1024 maps. Optimized run render+gl.finish medians new25.5/27.2/9.1/8.1ms vs bracketed old25.1-25.2/24.6-24.8/8.0-8.6/7.8-8.5ms. Do not claim zero FPS impact or real-phone measurements; no structural render-budget increase, some samples a few ms slower. Local Vite was restarted at http://127.0.0.1:5174/ (session22191). Lighting changes are local; no new commit/push/deploy requested this turn. Preserve unrelated root .wrangler/.

### Matte earth and paths (2026-10-11, local)
- User likes the directional lighting but reports a lacquer-like highlight on dry ground/paths; water is acceptable. Replaced the shared biome ground/path material with MeshLambertMaterial, removing view-dependent specular reflection while retaining both procedural textures, grass/soil/rim shader, lighting and stable CSM shadow composition. Actual sloping river banks share this material; their fallback and the outer perimeter ground also use Lambert. Water, fruit and other intentional glossy materials unchanged. No geometry, gameplay, networking or Worker changes.
- Production build and three focused celestial-lighting checks pass; main-BC4Vg3Z3.js. Temporary actual-game check TEMP/kirby-matte-ground-check.mjs compares old HEAD ground material against the new material in the same frozen scene with current celestial lighting. Orchard/birch paths day/night render with no page/shader errors, identical calls/triangles and the same two1024 shadow maps; images TEMP/kirby-matte-ground-*.png inspected. Render+gl.finish medians before19.3/19.8/11.9/10.3ms vs after19.1/17.3/11.6/11.2ms (short headless samples, no real-device FPS claim). No new textures or passes; Lambert removes the specular calculations. Local changes include the previous approved lighting work; no commit/push/deploy requested for this turn. Preserve unrelated root .wrangler/.

### Clearer Topotushka arena, drum and closed waves (2026-10-11, local)
- User wants a quiet floor matching the perimeter, a darker central emblem, only one bell so phase-one target is obvious, and a less silly finale message. Replaced arena-stone-texture.ts with arena-floor-texture.ts: one512px mipmapped colour texture with fine grain and very faint broad interwoven curves. Matte Lambert floor keeps the existing single merged floor draw, warm beige paving and darker olive centre via vertex colours. Existing inlays, depth bias, boundaries, collisions and layout unchanged; arena remains5 meshes/40,527 triangles.
- Master centipede-model.ts now has a single TailBell and a turquoise BackDrum with cream membrane, brass rims/lugs and diagonal rope lacing, seated on its existing pad. BackTarget position and internal BellHit/stage bell IDs stay compatible; the drum gently recoils/compresses on a hit and plays a soft three-beat drum sound. Regenerated GLB has all23 clips,68 meshes and93,312 triangles vs92,268 (+1044,~1.1%);6,963,652 bytes vs6,907,540 (+56KiB). Offline grounding remains baked, no new per-frame model work/draws. Phase hints, animation preview labels, progress title and victory HUD are consistent with the drum; all game prompts have English/Bulgarian translations. Solo and Worker completion log now reads: «прошёл все три испытания и подружился с Топотушкой!».
- Additional user request during work: phase-two/three waves should have no gaps and push from the centre too. Shared centipede-event.ts derives closed rings starting at0.8m instead of leaving an initial3/5m hole. Each birth also pushes grounded players inside the crest for650ms (tolerates missed/delayed frames); flights above0.95m remain safe, one gentle bump per wave and rewards/cadence unchanged. Direction is radially outward, or the player's facing at the exact centre. Wave rendering merges a faint filled birth pulse into the same instanced draw (80 extra triangles/ring,560 total); per-instance age smoothly fades the pulse and collapses its geometry after650ms to avoid invisible full-disc overdraw. No new draw, light, shadow map or network state. Updated hints instruct jumping/flying, without safe-gap advice.
- Validation:38 focused model/arena/collision/gameplay/Worker/localization/sound checks pass, plus final-model nine-check rerun after seating the drum. Client production build main-BRyW_WzR.js and Worker TypeScript pass. Temporary actual-game script TEMP/kirby-topotushka-polish-check.mjs starts through E, confirms real centre pushes on both phases (about5.9m/4.2m), one bell/drum, full rings/pulse,5-mesh arena and actual flag-switch victory text in ru/en/bg. TEMP/kirby-topotushka-polish-*.png/json inspected; no page/shader errors. For locale checks use existing UI flag click, since unversioned dynamic imports in a hot Vite session can create another locale-module instance.
- Everything remains local at5174 alongside approved lighting/ground work; no commit/push/deploy requested. At the next requested release deploy client and Worker together because wave rules are shared and the Worker completion text changed. Preserve/exclude unrelated root .wrangler/.

### Matte player and other Kirby surfaces (2026-10-11, local)
- User asks for the same matte treatment as earth/paths because the player and other Kirby characters look overly glossy. Shared cloneVariant now converts Kirby body/arms, Feet, Cheeks, Smile and Tongue materials from Standard/Physical to Lambert, removing specular/clearcoat layers while preserving original linear colour, vertex colours, textures, emissive properties, alpha/depth settings, directional illumination and CSM shadows. All local NPCs, remote players and permanent coaster/boat passengers use this same factory. Eye materials and the rainbow crown retain their small purposeful highlights. No geometry/animation/network/Worker changes, new textures, lights or rendering passes.
- Rainbow skin accepts Lambert and only assigns its shared seven-band map; it no longer forces glossy roughness/metalness. Boat passenger batching types support both material classes. Maze/summit star blessing now includes Lambert surfaces, preserving the golden glow and restoring original emissive settings when its timer expires. Existing maze regression uses the real cloned player and checks glow/restore; rainbow and boat tests retain colours/shared assets/render budget.
- Client production build main-kE7FWO84.js and12 focused rainbow/maze/river-boat/celestial-lighting checks pass. Temporary actual-game diagnostic TEMP/kirby-matte-characters-check.mjs renders pink/orange/blue/rainbow clones under current day/night lighting, compares the original GLB glossy surface in the same frozen scene, verifies actual player star glow/expiry and reports no page/shader errors. TEMP/kirby-matte-characters-{day-before,day,night}.png inspected. Calls/triangles identical before/after (day435/4,795,244; night436/4,800,044). Short desktop headless medians old11.6/11.1ms vs matte11.5/11.5ms; do not claim real-device FPS or a measured speedup. Lambert removes specular/coat shader calculations without adding render work.
- Changes remain local at http://127.0.0.1:5174/ alongside prior approved lighting/Topotushka work; no commit/push/deploy requested for this turn. Next requested accumulated release still needs both client and Worker due to pending shared boss rules. Preserve unrelated root .wrangler/.

### Saturated sneeze balls and clearer boat task progress (2026-10-11, local)
- User reports washed-out/white Topotushka phase-one balls and asks for stronger colour. CentipedeBallsView keeps its same palette, sphere geometry, instancing and two-draw ball/warning budget, but uses Lambert to remove white specular glare. The equator now only lightens the ball's own hue (16% white rather than93% cream); alternating panels are less dim (.82/1 vs.68/.91). A small0.12 emissive contribution is multiplied by the final instance-tinted diffuse colour in the existing shader, keeping saturated night visibility without white emission or additional lights/maps/passes. Custom shader cache key bumped to v2; warning timing/colour and all physics unchanged.
- Renamed task label from «Проплыть10% круга на лодочке» to «Поплавать на лодочке», English «Take a boat ride», Bulgarian «Поплавай с лодка». Stable score/save ID boat and first-time3-point reward unchanged. Boarding prompt now maps the existing10%-lap goal to1..100% displayed progress, caps at100 and continues displaying it alongside task complete. A fresh ride resets its counter to1 even when already rewarded; no duplicate points. Required real distance, boat speed and ride clock unchanged. New progress/completion templates translated in all three languages.
- Client production build main-usFwQMhA.js and28 focused boss/boat/tasks/i18n checks pass. Existing boat regression covers1%, midpoint~50%, completion exactly at the old10% threshold, cap, repeat riding and no repeat reward. Temporary actual-game diagnostic TEMP/kirby-balls-boat-check.mjs verifies real component/UI start1/half50/goal100/beyond100, task labels and prompts through actual ru/en/bg flag switches, and old/new ball rendering in identical frozen day/night arena views. TEMP/kirby-balls-boat-balls-{day-before,day,night}.png inspected; no page/shader errors. Same draws/triangles before/after: day253/1,855,915; night254/1,860,715. No Worker/protocol/request changes for these two edits.
- Remains local at http://127.0.0.1:5174/ with preceding approved lighting/matte character/boss work. No new commit/push/deploy requested this turn. Next accumulated release still needs client and Worker for previous shared wave changes. Preserve unrelated root .wrangler/.

### Natural phase-two coiling and unfolding (2026-10-11, local)
- User asks for Topotushka to coil/uncoil like an animal walking, rather than all links being bent and moved around a fixed centre. Replaced phase-two CoilArena/LowerBack/Rise horizontal pose morphs with a forward crawl: the head enters/leaves a circular path, every segment follows the same travelled path at a fixed distance, and the tail bends last. No per-frame recentering, sliding the whole body, body crossings, or inverted boots. LowerBack walks out to the existing central staircase; Rise first settles onto its feet, walks back into the arc, and coils progressively. The phase-three wheel and all interaction targets remain compatible.
- Baked foot placement into existing leg tracks: feet plant at fixed path contacts during stance, then lift and swing into the next step, with staggered left/right legs along the body. Generator uses distance-driven stepping instead of stretching one foot cycle across the whole animation. No runtime IK, vertex scans, added meshes/draws/lights or extra network state. GLB still23 clips/68 meshes/93,312 triangles, now7,858,672 bytes (+~874KiB for longer leg/path tracks).
- Shared gather destination now aligns the body tangentially with the beginning of the coil. ArenaCentipede captures the actual outgoing segment poses and briefly blends their small walking sway into the baked coil, avoiding double application of the old path offsets. Coiling takes6.5s, exiting to staircase12s, returning to coil16s, so it has time to walk its real path rather than visibly slide or teleport. Solo/Worker share these clocks through centipede-event.ts; next requested release must deploy both client and Worker together.
- Validation:29 focused gameplay/model/arena/collision/Worker tests pass, including new head-history and planted-foot regressions against the exported interpolated GLB. Existing60fps full-event transition regression checks no body squeezing or abrupt segment jumps. Client production build main-DApZU7ls.js and Worker TypeScript pass. Temporary actual-game browser diagnostic TEMP/kirby-crawl-check.mjs samples15 poses across all three crawl transitions; TEMP/kirby-crawl-poses.png inspected, no page/shader errors. No real-device FPS claim.
- Local game remains http://127.0.0.1:5174/. This turn does not request commit/push/deploy; retain all preceding approved pending changes and unrelated root .wrangler/.

### Clear flower garden beside the Shiba cottage (2026-10-11, local)
- User reports flowers growing through the dog house beside Kirby home. Moved the right home flower bed from HOME_SITE+(7.8,6) to HOME_SITE+(12.3,5.6), keeping its original1.5x2.7m shape and the existing deterministic merged flower rendering. It now sits to the right of the cottage with a visible gap from the walls, roof and porch; the left home garden is unchanged. No new meshes, animation-loop work or server changes.
- Client TypeScript passes. Temporary actual-game browser diagnostic TEMP/kirby-dog-garden-check.mjs confirms11 nearby flower sites, none intersecting the cottage footprint (including flower radius), no page errors. TEMP/kirby-dog-garden.png inspected and shows the flowers clear of the porch. Remains local; no commit/push/deploy requested this turn.

### Matte edible fruits and rebuilt pineapple (2026-10-11, local)
- User requests removal of highlights from the fruits Kirby eats and a recognisable detailed pineapple. All10 edible fruit types now use Lambert diffuse materials, including their leaves/stems/seeds and existing strawberry/banana/watermelon geometry. Watermelon painted rind and all vertex colours/maps are preserved. FruitWorld instancing recognises the same material class so every fruit remains batched and visible. Fruit mist, ornamental tree fruit, placement, picking, growth, sounds and networking are unchanged.
- New pineapple.ts replaces the smooth oval/dots/cones with an elongated oval carrying132 staggered raised diamond scales, darker seams, tiny brown eyes, subtle ripe/olive colour variation, and22 folded, curved pointed leaves in three crown tiers. Rind+eyes share one vertex-coloured mesh; crown one DoubleSide mesh. No image textures, lights or animation-loop work. Total7,644 triangles per pineapple vs old13,080; two instanced parts instead of nine, reducing the whole edible fruit batch count from43 to36.
- Production build main-DPcMMTCQ.js and5 existing fruit pickup/layout regressions pass. Actual-game diagnostic TEMP/kirby-matte-fruit-check.mjs confirms70 fruits,36 instanced meshes, all using matte Lambert, no page/shader/geometry errors. TEMP/kirby-pineapple-{day,night}.png inspected; new shape, attached crown and raised rind read clearly under both lighting modes. No measured real-device FPS claim. Changes remain local; no commit/push/deploy requested for this turn, no Worker edits for these fruits.

### Accumulated lighting, boss and fruit release (2026-10-11)
- User requests publishing all accumulated work, explicitly says not to wait for or verify Vercel deployment: push the existing main branch and they will check the client themselves. Use existing GitHub-to-Vercel integration; no new Vercel project or deploy polling.
- Release scope: directional sun/moon lighting and stable shadows; matte earth, paths, all Kirby variants and edible fruits; quieter arena floor, tail bell plus back drum, closed centre-pushing waves, vivid sneeze balls; natural phase-two head-following crawl with planted feet and shared clocks; clearer boat task/progress; garden clear of the dog cottage; rebuilt detailed pineapple. Includes regenerated centipede GLB, source, regression checks, diagnostics and project memory. Preserve unrelated root .wrangler/ outside the commit.
- Cloudflare Worker published successfully via the existing game-server deploy command: version18c95eff-ca30-4ff4-9842-e86f54d85fb4 at https://kirby-game-server.kirby-game-server.workers.dev. Shared boss rules are bundled with the server, including closed waves and longer crawling transitions. No storage migrations or protocol-field additions.
- Latest client production build main-DPcMMTCQ.js and prior focused checks recorded above passed before this release; do not repeat browser verification or poll the Vercel deployment. Commit title: Refine celestial lighting, matte surfaces and Topotushka animations.

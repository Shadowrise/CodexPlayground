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

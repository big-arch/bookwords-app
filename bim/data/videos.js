window.BIM_CONTENT = window.BIM_CONTENT || { courses: [], glossary: [], videos: [] };

// Каталог видеоуроков.
// Ссылка строится как поиск на YouTube по запросу query — так подборка не «ломается»
// со временем, а всегда показывает актуальные уроки по теме.
// Свои конкретные ссылки можно добавить в приложении: раздел «Видео» → «Добавить своё видео».
window.BIM_CONTENT.videos.push(
  { id: "v-bim-1", course: "bim", lesson: "bim-01", title: "Что такое BIM: объяснение на примерах", level: "База", description: "Базовое видео для старта: чем модель отличается от чертежа и зачем это заказчику.", query: "что такое BIM информационное моделирование простыми словами" },
  { id: "v-bim-2", course: "bim", lesson: "bim-02", title: "BEP и роли в BIM-проекте", level: "База", description: "Как устроен план реализации проекта и кто за что отвечает в команде.", query: "BIM Execution Plan BEP что это роли в проекте" },
  { id: "v-bim-3", course: "bim", lesson: "bim-03", title: "LOD: уровни проработки модели", level: "База", description: "Разбор шкалы LOD 100-500 и матрицы уровней проработки по стадиям.", query: "LOD уровни проработки BIM модели 100 200 300 400 500" },
  { id: "v-bim-4", course: "bim", lesson: "bim-04", title: "IFC: экспорт и проверка", level: "Средний", description: "Настройка экспорта IFC и проверка результата в независимом просмотрщике.", query: "экспорт IFC из Revit настройка проверка" },
  { id: "v-bim-5", course: "bim", lesson: "bim-05", title: "Координация разделов и работа с коллизиями", level: "Средний", description: "Как выстроить процесс координации в реальном проекте.", query: "BIM координация разделов коллизии регламент" },
  { id: "v-bim-6", course: "bim", lesson: "bim-06", title: "4D и 5D: модель на стройке", level: "Средний", description: "Связь модели с календарным планом и объёмами.", query: "4D 5D BIM моделирование календарный план объёмы" },
  { id: "v-bim-7", course: "bim", lesson: "bim-07", title: "ТИМ в России: требования и нормативка", level: "Средний", description: "Обзор требований к информационной модели для госзаказа.", query: "ТИМ информационная модель требования постановление 331" },

  { id: "v-revit-1", course: "revit", lesson: "revit-01", title: "Revit с нуля: интерфейс и первые шаги", level: "База", description: "Лента, браузер проекта, свойства, навигация по видам.", query: "Revit с нуля интерфейс урок для начинающих" },
  { id: "v-revit-2", course: "revit", lesson: "revit-02", title: "Уровни, оси и координаты в Revit", level: "База", description: "Правильный старт проекта и настройка общих координат.", query: "Revit уровни оси базовая точка проекта общие координаты" },
  { id: "v-revit-3", course: "revit", lesson: "revit-03", title: "Стены и перекрытия: типы и слои", level: "База", description: "Создание своих типов конструкций со слоями и материалами.", query: "Revit стены типы слои структура перекрытия урок" },
  { id: "v-revit-4", course: "revit", lesson: "revit-04", title: "Семейства Revit: полный курс основ", level: "Средний", description: "Редактор семейств, параметры типа и экземпляра, общие параметры.", query: "Revit семейства с нуля параметры редактор семейств" },
  { id: "v-revit-5", course: "revit", lesson: "revit-05", title: "Виды, диапазон вида и шаблоны видов", level: "Средний", description: "Почему элемент не виден на плане и как настроить оформление один раз.", query: "Revit диапазон вида шаблоны видов фильтры видимость" },
  { id: "v-revit-6", course: "revit", lesson: "revit-06", title: "Спецификации в Revit", level: "Средний", description: "Создание спецификаций, расчётные поля, аудит модели таблицами.", query: "Revit спецификации schedule расчётное поле урок" },
  { id: "v-revit-7", course: "revit", lesson: "revit-07", title: "Совместная работа и рабочие наборы", level: "Продвинутый", description: "Центральная модель, локальные копии, синхронизация, гигиена файла.", query: "Revit совместная работа рабочие наборы центральная модель" },
  { id: "v-revit-8", course: "revit", lesson: "revit-08", title: "Листы, печать и выдача из Revit", level: "Средний", description: "Сборка листов, экспорт DWG/IFC/NWC и печать комплекта.", query: "Revit листы печать экспорт DWG IFC NWC" },

  { id: "v-navis-1", course: "navisworks", lesson: "navis-01", title: "Navisworks с нуля: форматы и интерфейс", level: "База", description: "NWC, NWF, NWD и чем отличаются Manage, Simulate, Freedom.", query: "Navisworks с нуля урок nwc nwf nwd" },
  { id: "v-navis-2", course: "navisworks", lesson: "navis-02", title: "Сборка сводной модели в Navisworks", level: "База", description: "Append моделей, координаты, обновление файлов.", query: "Navisworks сборка сводной модели append урок" },
  { id: "v-navis-3", course: "navisworks", lesson: "navis-03", title: "Наборы и поиск элементов (Search Sets)", level: "Средний", description: "Find Items и поисковые наборы — основа работы координатора.", query: "Navisworks search sets find items наборы урок" },
  { id: "v-navis-4", course: "navisworks", lesson: "navis-04", title: "Clash Detective: полный разбор", level: "Средний", description: "Настройка тестов, допуски, группировка, отчёты и статусы.", query: "Navisworks Clash Detective коллизии настройка отчёт" },
  { id: "v-navis-5", course: "navisworks", lesson: "navis-05", title: "TimeLiner: 4D-симуляция стройки", level: "Средний", description: "Импорт графика, привязка наборов, симуляция и экспорт видео.", query: "Navisworks TimeLiner 4D симуляция урок" },
  { id: "v-navis-6", course: "navisworks", lesson: "navis-06", title: "BCF и обмен замечаниями", level: "Средний", description: "Как передавать замечания из Navisworks в Revit и обратно.", query: "BCF обмен замечаниями Navisworks Revit" },

  { id: "v-acad-1", course: "autocad", lesson: "acad-01", title: "AutoCAD с нуля: интерфейс и настройка", level: "База", description: "Командная строка, режимы, единицы, настройка рабочего файла.", query: "AutoCAD с нуля урок интерфейс настройка для начинающих" },
  { id: "v-acad-2", course: "autocad", lesson: "acad-02", title: "Точные построения: координаты и привязки", level: "База", description: "Абсолютные, относительные и полярные координаты, OSNAP.", query: "AutoCAD координаты привязки полярное отслеживание урок" },
  { id: "v-acad-3", course: "autocad", lesson: "acad-03", title: "Основные команды AutoCAD", level: "База", description: "Практика: полилиния, offset, trim, fillet, array и выбор объектов.", query: "AutoCAD основные команды практика урок полилиния offset trim" },
  { id: "v-acad-4", course: "autocad", lesson: "acad-04", title: "Слои и стандарты оформления", level: "База", description: "Диспетчер слоёв, ByLayer, типы линий и масштаб LTSCALE.", query: "AutoCAD слои ByLayer типы линий LTSCALE урок" },
  { id: "v-acad-5", course: "autocad", lesson: "acad-05", title: "Блоки, атрибуты и внешние ссылки", level: "Средний", description: "Динамические блоки, атрибуты, XREF и ETRANSMIT.", query: "AutoCAD блоки атрибуты динамические блоки xref урок" },
  { id: "v-acad-6", course: "autocad", lesson: "acad-06", title: "Листы, видовые экраны и печать в PDF", level: "Средний", description: "Настройка листов, масштабы, аннотативность, PUBLISH.", query: "AutoCAD листы видовые экраны печать PDF масштаб урок" },
  { id: "v-acad-7", course: "autocad", lesson: "acad-07", title: "Ускорение работы в AutoCAD", level: "Средний", description: "Горячие клавиши, алиасы, PURGE, OVERKILL, чистка файла.", query: "AutoCAD горячие клавиши ускорение работы алиасы purge overkill" },

  { id: "v-civil-1", course: "civil3d", lesson: "civil-01", title: "Civil 3D с нуля: интерфейс и стили", level: "База", description: "Toolspace, стили, шаблоны и логика объектов.", query: "Civil 3D с нуля интерфейс toolspace стили урок" },
  { id: "v-civil-2", course: "civil3d", lesson: "civil-02", title: "Точки и построение поверхности", level: "База", description: "Импорт съёмки, группы точек, TIN, брейклайны, границы.", query: "Civil 3D поверхность точки брейклайны TIN урок" },
  { id: "v-civil-3", course: "civil3d", lesson: "civil-03", title: "Трассы и продольные профили", level: "Средний", description: "Alignment, вид профиля, проектная линия, критерии проектирования.", query: "Civil 3D трасса профиль alignment profile урок" },
  { id: "v-civil-4", course: "civil3d", lesson: "civil-04", title: "Коридоры и поперечные конструкции", level: "Продвинутый", description: "Assembly, subassembly, targets, поверхность коридора.", query: "Civil 3D коридор assembly subassembly урок" },
  { id: "v-civil-5", course: "civil3d", lesson: "civil-05", title: "Объёмы земляных работ и сечения", level: "Средний", description: "Sample lines, material list, ведомости объёмов, Mass Haul.", query: "Civil 3D объёмы земляных работ сечения ведомость урок" },
  { id: "v-civil-6", course: "civil3d", lesson: "civil-06", title: "Сети и вертикальная планировка", level: "Средний", description: "Pipe networks, feature lines, grading, проверка стоков.", query: "Civil 3D сети pipe network вертикальная планировка grading урок" },
  { id: "v-civil-7", course: "civil3d", lesson: "civil-07", title: "Связка Civil 3D и Revit по координатам", level: "Продвинутый", description: "Передача поверхности, посадка здания, общие координаты.", query: "Civil 3D Revit общие координаты топоповерхность связь" }
);

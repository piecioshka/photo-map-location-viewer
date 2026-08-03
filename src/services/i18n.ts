/**
 * Tiny i18n: a flat EN/PL dictionary, a persisted language setting
 * ("auto" follows the browser) and helpers for static HTML (elements
 * annotated with data-i18n / data-i18n-title / data-i18n-aria).
 */

export const LANGUAGES = ["auto", "en", "pl"] as const;
export type Language = (typeof LANGUAGES)[number];

const MESSAGES = {
  en: {
    addPhotos: "Add photos",
    addFolder: "Add folder",
    addFolderTitle:
      "Import a whole folder at once — e.g. your phone's camera folder",
    driveTitle: "Add photos from Google Drive",
    newSessionTitle: "Start a new session (removes all photos)",
    settingsTitle: "Map settings",
    appearance: "Appearance",
    darkTheme: "Dark theme",
    accentColor: "Accent color",
    dateFormat: "Date format",
    mapSection: "Map",
    travelRoute: "Travel route",
    routeView: "Route view",
    widgets: "Widgets",
    photoList: "Photo list",
    timeline: "Timeline",
    calendar: "Calendar",
    storage: "Storage",
    keepOriginals: "Keep original files",
    originalsNote:
      "Originals power the magnifier after a reload but use the most space. Thumbnails are always kept.",
    geocodingNote:
      "City names are looked up online — only coordinates are sent, never photos.",
    privacyDetails: "Privacy details",
    version: "Version",
    emptyTitle: "Add photos to the map.",
    emptyHint: "Photos stay on your device.",
    emptyDemo: "…or try with sample photos",
    dropHere: "Drop photos here",
    photos: "Photos",
    onTheMap: "On the map",
    noLocation: "No location",
    noLocationHint:
      'Photos marked "No location" have no GPS coordinates — screenshots and images shared via messaging apps usually have location data stripped.',
    removePhoto: "Remove this photo",
    renamePlace: "Rename this place",
    newPlaceName: "New place name",
    exportGeojsonTitle: "Download the trip as GeoJSON",
    exportKmlTitle: "Download the trip as KML (Google Earth)",
    onMapCounter: "on map",
    newSessionQuestion: "Start a new session?",
    newSessionWarning:
      "All photos will be removed from the map. This cannot be undone.",
    cancel: "Cancel",
    startNewSession: "Start new session",
    privacy: "Privacy",
    close: "Close",
    storageAlmostFull: "Local storage is almost full",
    storageAdvice: "Turn off 'Keep original files' in settings to save space.",
    visitedAsStop: "Visited as stop",
    openOriginal: "Open original photo",
    openInGoogleMaps: "Open in Google Maps",
    searchPlaces: "Search places…",
    language: "Language",
    privacyStaysTitle: "Stays on your device:",
    privacyStaysPhotos:
      "your photos, thumbnails and originals (browser storage only)",
    privacyStaysExif: "EXIF data — GPS and capture time are read locally",
    privacyStaysSettings: "all settings",
    privacyLeavesTitle: "Leaves your device:",
    privacyLeavesCoords:
      "photo coordinates — sent to BigDataCloud to resolve city names (never the photos themselves)",
    privacyLeavesTiles:
      "map viewport — tile requests go to OpenStreetMap / Esri / OpenTopoMap",
    privacyLeavesSearch: "place-search queries — sent to Photon (komoot.io)",
    privacyLeavesDrive:
      "with Google Drive import: the standard Google sign-in and read-only Drive API requests",
    privacyFooter: "No analytics, no accounts, no server of ours.",
    driveMyDrive: "My Drive",
    driveBack: "Back to the parent folder",
    driveClose: "Close",
    driveSelectFolder: "Add photos from this folder",
    driveLoading: "Loading folders…",
    driveListFailed: "Could not list folders.",
    driveEmpty: "No subfolders here.",
    driveNoPhotos: "No photos in this folder.",
    driveImportFailed: "Google Drive import failed.",
    previousMonth: "Previous month",
    nextMonth: "Next month",
  },
  pl: {
    addPhotos: "Dodaj zdjęcia",
    addFolder: "Dodaj folder",
    addFolderTitle:
      "Zaimportuj cały folder naraz — np. folder aparatu w telefonie",
    driveTitle: "Dodaj zdjęcia z Google Drive",
    newSessionTitle: "Rozpocznij nową sesję (usuwa wszystkie zdjęcia)",
    settingsTitle: "Ustawienia mapy",
    appearance: "Wygląd",
    darkTheme: "Ciemny motyw",
    accentColor: "Kolor akcentu",
    dateFormat: "Format daty",
    mapSection: "Mapa",
    travelRoute: "Trasa podróży",
    routeView: "Widok trasy",
    widgets: "Widgety",
    photoList: "Lista zdjęć",
    timeline: "Oś czasu",
    calendar: "Kalendarz",
    storage: "Pamięć",
    keepOriginals: "Zachowuj oryginały",
    originalsNote:
      "Oryginały zasilają lupkę po odświeżeniu, ale zajmują najwięcej miejsca. Miniatury są zapisywane zawsze.",
    geocodingNote:
      "Nazwy miast są pobierane online — wysyłane są wyłącznie współrzędne, nigdy zdjęcia.",
    privacyDetails: "Szczegóły prywatności",
    version: "Wersja",
    emptyTitle: "Dodaj zdjęcia do mapy.",
    emptyHint: "Zdjęcia zostają na Twoim urządzeniu.",
    emptyDemo: "…albo wypróbuj przykładowe zdjęcia",
    dropHere: "Upuść zdjęcia tutaj",
    photos: "Zdjęcia",
    onTheMap: "Na mapie",
    noLocation: "Brak lokalizacji",
    noLocationHint:
      "Zdjęcia w grupie „Brak lokalizacji” nie mają współrzędnych GPS — zrzuty ekranu i obrazy z komunikatorów zwykle mają usunięte dane lokalizacji.",
    removePhoto: "Usuń to zdjęcie",
    renamePlace: "Zmień nazwę miejsca",
    newPlaceName: "Nowa nazwa miejsca",
    exportGeojsonTitle: "Pobierz podróż jako GeoJSON",
    exportKmlTitle: "Pobierz podróż jako KML (Google Earth)",
    onMapCounter: "na mapie",
    newSessionQuestion: "Rozpocząć nową sesję?",
    newSessionWarning:
      "Wszystkie zdjęcia zostaną usunięte z mapy. Tego nie można cofnąć.",
    cancel: "Anuluj",
    startNewSession: "Nowa sesja",
    privacy: "Prywatność",
    close: "Zamknij",
    storageAlmostFull: "Lokalna pamięć jest prawie pełna",
    storageAdvice:
      "Wyłącz „Zachowuj oryginały” w ustawieniach, aby zaoszczędzić miejsce.",
    visitedAsStop: "Przystanek numer",
    openOriginal: "Otwórz oryginalne zdjęcie",
    openInGoogleMaps: "Otwórz w Google Maps",
    searchPlaces: "Szukaj miejsc…",
    language: "Język",
    privacyStaysTitle: "Zostaje na Twoim urządzeniu:",
    privacyStaysPhotos:
      "zdjęcia, miniatury i oryginały (wyłącznie pamięć przeglądarki)",
    privacyStaysExif: "dane EXIF — GPS i czas wykonania odczytywane lokalnie",
    privacyStaysSettings: "wszystkie ustawienia",
    privacyLeavesTitle: "Opuszcza Twoje urządzenie:",
    privacyLeavesCoords:
      "współrzędne zdjęć — wysyłane do BigDataCloud po nazwy miast (nigdy same zdjęcia)",
    privacyLeavesTiles:
      "widoczny fragment mapy — kafelki pobierane z OpenStreetMap / Esri / OpenTopoMap",
    privacyLeavesSearch:
      "zapytania wyszukiwarki miejsc — wysyłane do Photon (komoot.io)",
    privacyLeavesDrive:
      "przy imporcie z Dysku Google: standardowe logowanie Google i zapytania do Dysku tylko do odczytu",
    privacyFooter: "Bez analityki, bez kont, bez naszego serwera.",
    driveMyDrive: "Mój dysk",
    driveBack: "Wróć do folderu nadrzędnego",
    driveClose: "Zamknij",
    driveSelectFolder: "Dodaj zdjęcia z tego folderu",
    driveLoading: "Wczytywanie folderów…",
    driveListFailed: "Nie udało się wczytać folderów.",
    driveEmpty: "Brak podfolderów.",
    driveNoPhotos: "Brak zdjęć w tym folderze.",
    driveImportFailed: "Import z Dysku Google nie powiódł się.",
    previousMonth: "Poprzedni miesiąc",
    nextMonth: "Następny miesiąc",
  },
} as const;

export type MessageKey = keyof (typeof MESSAGES)["en"];

const LANGUAGE_KEY = "photo-map:language";

let active: "en" | "pl" = "en";

export function sanitizeLanguage(value: unknown): Language {
  for (const language of LANGUAGES) {
    if (language === value) return language;
  }
  return "auto";
}

export function loadLanguage(): Language {
  try {
    return sanitizeLanguage(localStorage.getItem(LANGUAGE_KEY));
  } catch {
    return "auto";
  }
}

export function saveLanguage(language: Language): void {
  try {
    localStorage.setItem(LANGUAGE_KEY, language);
  } catch {
    // storage unavailable — the choice just won't persist
  }
}

export function resolveLanguage(language: Language): "en" | "pl" {
  if (language !== "auto") return language;
  return navigator.language.toLowerCase().startsWith("pl") ? "pl" : "en";
}

export function setLanguage(language: Language): void {
  active = resolveLanguage(language);
  document.documentElement.lang = active;
  applyStaticTranslations();
}

export function t(key: MessageKey): string {
  return MESSAGES[active][key];
}

/** The active UI language tag, for Intl formatters. */
export function currentLocale(): string {
  return active === "pl" ? "pl-PL" : "en-US";
}

const PHOTO_COUNT_FORMS = {
  en: { one: "photo", other: "photos" },
  // Polish needs the genitive plural: 1 zdjęcie, 2 zdjęcia, 5 zdjęć
  pl: { one: "zdjęcie", few: "zdjęcia", many: "zdjęć", other: "zdjęcia" },
} as const;

/** "3 photos" / "3 zdjęcia", with correct plural forms per language. */
export function photoCount(count: number): string {
  const rule = new Intl.PluralRules(currentLocale()).select(count);
  const forms: Record<string, string> = PHOTO_COUNT_FORMS[active];
  return `${count} ${forms[rule] ?? forms.other}`;
}

function isMessageKey(value: string | undefined): value is MessageKey {
  return value !== undefined && value in MESSAGES.en;
}

/** Applies the dictionary to HTML annotated with data-i18n attributes. */
export function applyStaticTranslations(): void {
  for (const el of document.querySelectorAll<HTMLElement>("[data-i18n]")) {
    if (isMessageKey(el.dataset.i18n)) el.textContent = t(el.dataset.i18n);
  }
  for (const el of document.querySelectorAll<HTMLElement>(
    "[data-i18n-title]",
  )) {
    if (isMessageKey(el.dataset.i18nTitle)) el.title = t(el.dataset.i18nTitle);
  }
  for (const el of document.querySelectorAll<HTMLElement>("[data-i18n-aria]")) {
    if (isMessageKey(el.dataset.i18nAria)) {
      el.setAttribute("aria-label", t(el.dataset.i18nAria));
    }
  }
}

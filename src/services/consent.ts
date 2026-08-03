/**
 * Cookie consent banner (vanilla-cookieconsent), matching the one on
 * piecioshka.pl: a box in the bottom-right corner with accept / reject /
 * customize. Analytics only starts once the visitor accepts.
 */
import * as CookieConsent from "vanilla-cookieconsent";
import "vanilla-cookieconsent/dist/cookieconsent.css";
import { disableAnalytics, enableAnalytics } from "./analytics";
import { resolveLanguage, type Language } from "./i18n";

export function initConsent(language: Language): void {
  void CookieConsent.run({
    guiOptions: {
      consentModal: { layout: "box", position: "bottom right" },
      preferencesModal: { layout: "box" },
    },
    categories: {
      necessary: { enabled: true, readOnly: true },
      analytics: {
        autoClear: {
          cookies: [{ name: /^_ga/ }, { name: "_gid" }],
        },
      },
    },
    language: {
      default: resolveLanguage(language),
      translations: { en: EN, pl: PL },
    },
    onConsent: syncAnalytics,
    onChange: syncAnalytics,
  });
}

function syncAnalytics(): void {
  if (CookieConsent.acceptedCategory("analytics")) enableAnalytics();
  else disableAnalytics();
}

/** Opens the preferences dialog — wired to the privacy dialog link. */
export function openConsentPreferences(): void {
  CookieConsent.showPreferences();
}

const EN = {
  consentModal: {
    title: "We use cookies",
    description:
      "This site uses cookies for traffic analysis (Google Analytics). Your photos are never uploaded — that stays true either way.",
    acceptAllBtn: "Accept all",
    acceptNecessaryBtn: "Reject all",
    showPreferencesBtn: "Manage preferences",
  },
  preferencesModal: {
    title: "Cookie preferences",
    acceptAllBtn: "Accept all",
    acceptNecessaryBtn: "Reject all",
    savePreferencesBtn: "Save preferences",
    closeIconLabel: "Close",
    sections: [
      {
        title: "Strictly necessary",
        description:
          "Needed for the app to work — your photos, settings and map state are stored on this device only.",
        linkedCategory: "necessary",
      },
      {
        title: "Analytics",
        description:
          "Anonymous visit statistics (Google Analytics), so I know whether the app is useful. No photos and no coordinates are ever sent.",
        linkedCategory: "analytics",
      },
    ],
  },
};

const PL = {
  consentModal: {
    title: "Używamy plików cookies",
    description:
      "Ta strona używa plików cookies do analizy ruchu (Google Analytics). Twoje zdjęcia nigdy nie są wysyłane — to się nie zmienia niezależnie od wyboru.",
    acceptAllBtn: "Akceptuj wszystko",
    acceptNecessaryBtn: "Odrzuć wszystko",
    showPreferencesBtn: "Dostosuj ustawienia",
  },
  preferencesModal: {
    title: "Ustawienia cookies",
    acceptAllBtn: "Akceptuj wszystko",
    acceptNecessaryBtn: "Odrzuć wszystko",
    savePreferencesBtn: "Zapisz ustawienia",
    closeIconLabel: "Zamknij",
    sections: [
      {
        title: "Niezbędne",
        description:
          "Potrzebne, żeby aplikacja działała — zdjęcia, ustawienia i stan mapy zostają wyłącznie na tym urządzeniu.",
        linkedCategory: "necessary",
      },
      {
        title: "Analityczne",
        description:
          "Anonimowe statystyki odwiedzin (Google Analytics), żebym wiedział, czy aplikacja się przydaje. Zdjęcia ani współrzędne nigdy nie są wysyłane.",
        linkedCategory: "analytics",
      },
    ],
  },
};

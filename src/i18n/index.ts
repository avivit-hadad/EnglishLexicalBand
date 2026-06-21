import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import he from './he.json';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    he: { translation: he },
  },
  lng: localStorage.getItem('lexical_band_ui_lang') || 'he',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;

export function setUiLanguage(lang: 'he' | 'en') {
  localStorage.setItem('lexical_band_ui_lang', lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
  i18n.changeLanguage(lang);
}

export function initUiLanguage(lang: 'he' | 'en') {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
  i18n.changeLanguage(lang);
}

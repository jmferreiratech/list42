import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import translationPTBR from './locales/pt-BR/translation.json';

const resources = {
  'pt-BR': {
    translation: translationPTBR
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'pt-BR',
    fallbackLng: 'pt-BR',
    debug: process.env.NODE_ENV === 'development',
    interpolation: {escapeValue: false},
  });

export default i18n;

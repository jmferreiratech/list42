import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

vi.mock('react-i18next', () => ({
    useTranslation: () => {
      return {
        t: (str) => str,
        i18n: {
          changeLanguage: () => new Promise(() => {}),
          services: {resourceStore: {data: {}}},
        },
      };
    },
    initReactI18next: {
      type: '3rdParty',
      init: () => {},
    },
    Trans: ({i18nKey}) => i18nKey,
  }));
  
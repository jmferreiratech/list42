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
  
// happy-dom has no WebSocket. MSW (ws.link in App.spec.tsx) puts its own mock in place of the global one,
// which only has to exist; this one is never connected.
if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = class {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSING = 2;
    static readonly CLOSED = 3;
  } as unknown as typeof WebSocket;
}

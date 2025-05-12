import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './i18n';
import { Provider } from 'react-redux';
import { setupStore } from './store.ts';
import { AuthProvider } from './components/Auth.tsx';
import { setupAuthClient } from './auth.ts';

const store = setupStore();
const authClient = setupAuthClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <AuthProvider client={authClient}>
        <App />
      </AuthProvider>
    </Provider>
  </StrictMode>,
);

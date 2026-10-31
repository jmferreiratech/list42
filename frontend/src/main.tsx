import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './i18n';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from './api.ts';
import { AuthProvider } from './components/Auth.tsx';
import { setupAuthClient } from './auth.ts';

const queryClient = createQueryClient();
const authClient = setupAuthClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider client={authClient}>
        <App />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);

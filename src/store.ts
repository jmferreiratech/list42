import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { groceryApi } from './api';

export function setupStore(preloadedState?: Partial<RootState>) {
  const store = configureStore({
    reducer,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(groceryApi.middleware),
    preloadedState,
  });
  
  setupListeners(store.dispatch);  

  return store;
}

const reducer = combineReducers({
  [groceryApi.reducerPath]: groceryApi.reducer,
});

export type RootState = ReturnType<typeof reducer>;
export type AppStore = ReturnType<typeof setupStore>;

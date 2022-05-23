import {
  configureStore
} from '@reduxjs/toolkit';

import title from './title';
import toolMenu from './toolMenu';

export const store = configureStore({
  reducer: {
    title,
    toolMenu
  }
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
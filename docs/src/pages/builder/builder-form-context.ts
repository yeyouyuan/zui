import { createContext } from 'react';
export const BuilderFormContext = createContext(false);
export const BuilderTabsContext = createContext<{
  register: (id: string, value: string) => () => void;
} | null>(null);

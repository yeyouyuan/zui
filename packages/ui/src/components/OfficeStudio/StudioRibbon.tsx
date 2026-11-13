'use client';

import * as React from 'react';
import './StudioRibbon.css';

/** File operations belong to the host while every editor shares their entry point. */
export const StudioRibbonFileContext = React.createContext<React.ReactNode>(null);

export function StudioRibbonTabs({ children }: { children: React.ReactNode }) {
  const fileMenu = React.useContext(StudioRibbonFileContext);
  return (
    <div className="z-studio-ribbon-tabbar" data-part="ribbon-tabs">
      {fileMenu}
      {children}
    </div>
  );
}

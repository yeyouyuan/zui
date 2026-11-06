/** Self-contained browser entry for direct script-tag usage. */
import * as React from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import './styles/tokens.css';
import './styles/reset.css';

export * from './index';
export { React, createRoot, hydrateRoot };

'use client';

import * as React from 'react';

export interface RadioGroupContextValue {
  name?: string;
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export const RadioGroupContext = React.createContext<RadioGroupContextValue | null>(null);

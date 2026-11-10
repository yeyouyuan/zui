import { createUsePuck, type PuckApi } from '@puckeditor/core';
export const useBuilderEditor: <T>(selector: (state: PuckApi) => T) => T = createUsePuck();

export function historyHasCurrentData(api: PuckApi) {
  const recorded = api.history.histories[api.history.index]?.state.data;
  return (
    recorded === api.appState.data || JSON.stringify(recorded) === JSON.stringify(api.appState.data)
  );
}

import { createContext } from 'react';

/** Stable empty map so a hidden toggle does not rebuild context every render. */
export const NO_STEP_NUMBERS: ReadonlyMap<string, number> = new Map();

export const StepNumberContext = createContext<ReadonlyMap<string, number>>(NO_STEP_NUMBERS);

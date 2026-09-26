import { useEffect, useLayoutEffect } from 'react';
export const useIsomorphicLayoutEffect = typeof globalThis.window !== 'undefined'
    ? useLayoutEffect
    : useEffect;

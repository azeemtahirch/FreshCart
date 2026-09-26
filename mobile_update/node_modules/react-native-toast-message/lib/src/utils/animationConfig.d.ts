import { ToastAnimationConfig, ToastSingleAnimationConfig, ToastSpringAnimationConfig } from '../types';
export declare const DEFAULT_ANIMATION_CONFIG: ToastSpringAnimationConfig;
export declare type AnimationPhase = 'enter' | 'exit';
export declare function resolveAnimationConfig(config: ToastAnimationConfig | undefined, phase: AnimationPhase): ToastSingleAnimationConfig;

import React from 'react';
import { Animated } from 'react-native';
import { ToastAnimationConfig, ToastPosition } from '../types';
declare type UseSlideAnimationParams = {
    position: ToastPosition;
    height: number;
    topOffset: number;
    bottomOffset: number;
    keyboardOffset: number;
    avoidKeyboard: boolean;
    animationConfig?: ToastAnimationConfig;
};
export declare function translateYOutputRangeFor({ position, height, topOffset, bottomOffset, keyboardHeight, keyboardOffset, avoidKeyboard }: UseSlideAnimationParams & {
    keyboardHeight: number;
}): number[];
export declare function useSlideAnimation({ position, height, topOffset, bottomOffset, keyboardOffset, avoidKeyboard, animationConfig }: UseSlideAnimationParams): {
    animatedValue: React.MutableRefObject<Animated.Value>;
    animate: (toValue: number) => void;
    keyboardHeight: number;
    animationStyles: {
        opacity: Animated.AnimatedInterpolation;
        transform: {
            translateY: Animated.AnimatedInterpolation;
        }[];
    };
};
export {};

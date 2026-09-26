import { Dimensions, PixelRatio } from "react-native";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const BASE_WIDTH = 390;
const BASE_HEIGHT = 844;

export const width = SCREEN_WIDTH;
export const height = SCREEN_HEIGHT;
export const isSmallDevice = SCREEN_WIDTH < 360;
export const isLargeDevice = SCREEN_WIDTH >= 430;

export const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

// Width-based scaling with safe limits so layouts do not become oversized.
export const scale = (size, factor = 1) =>
  clamp((SCREEN_WIDTH / BASE_WIDTH) * size * factor, size * 0.86, size * 1.12);

export const verticalScale = (size) =>
  clamp((SCREEN_HEIGHT / BASE_HEIGHT) * size, size * 0.82, size * 1.14);

export const moderateScale = (size, factor = 0.5) =>
  size + (scale(size) - size) * factor;

export const wp = (percent) => (SCREEN_WIDTH * percent) / 100;
export const hp = (percent) => (SCREEN_HEIGHT * percent) / 100;

export const horizontalPadding = clamp(wp(4.2), 14, 20);
export const contentGap = clamp(wp(3), 10, 14);

// Prevent user font settings from making compact cards overflow.
export const normalizedFontScale = clamp(PixelRatio.getFontScale(), 1, 1.15);

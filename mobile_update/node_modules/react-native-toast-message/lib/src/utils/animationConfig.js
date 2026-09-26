export const DEFAULT_ANIMATION_CONFIG = {
    type: 'spring',
    friction: 8
};
export function resolveAnimationConfig(config, phase) {
    if (!config) {
        return DEFAULT_ANIMATION_CONFIG;
    }
    if ('type' in config) {
        return config;
    }
    return config[phase] ?? DEFAULT_ANIMATION_CONFIG;
}

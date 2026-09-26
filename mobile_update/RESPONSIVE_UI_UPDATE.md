# FreshCart responsive UI update

This mobile update improves consistency across small and large Android/iOS devices.

## Changes
- Added a central responsive sizing utility in `src/utils/responsive.js`.
- Added `@expo/vector-icons` for consistent vector icons instead of emoji/text icons.
- Added font-scale protection in `App.js` so large system font settings do not break compact cards.
- Updated navigation icons and shared UI controls to use vector icons.
- Product images use aspect-ratio based sizing where practical.
- Bottom tabs now account for safe-area insets.

## Install
From `mobile_update` run:

```bash
npm install
npx expo start
```

`package-lock.json` was intentionally removed because the build environment could not reach npm while preparing this archive; `npm install` will regenerate it with `@expo/vector-icons`.

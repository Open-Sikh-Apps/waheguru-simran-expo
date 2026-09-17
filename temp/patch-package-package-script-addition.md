```json
"postinstall": "patch-package && rm -rf node_modules/react-native-nitro-player/android/.cxx",
"patch:nitro-player": "rm -rf node_modules/react-native-nitro-player/android/.cxx node_modules/react-native-nitro-player/android/build && patch-package react-native-nitro-player --exclude 'android/\\.cxx|android/build'"
```
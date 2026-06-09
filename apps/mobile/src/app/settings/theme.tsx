// Platform-specific implementations live outside the app directory so Metro
// resolves theme-screen.android.tsx on Android and theme-screen.tsx (SwiftUI
// via @expo/ui universal components) everywhere else.
export { default } from "~/settings/theme-screen";

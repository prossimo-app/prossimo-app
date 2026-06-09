// Platform-specific implementations live outside the app directory so Metro
// resolves settings-screen.android.tsx on Android and settings-screen.tsx
// (SwiftUI via @expo/ui universal components) everywhere else.
export { default } from "~/settings/settings-screen";

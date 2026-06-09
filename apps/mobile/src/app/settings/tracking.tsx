// Platform-specific implementations live outside the app directory so Metro
// resolves tracking-screen.android.tsx on Android and tracking-screen.tsx
// (SwiftUI via @expo/ui universal components) everywhere else.
export { default } from "~/settings/tracking-screen";

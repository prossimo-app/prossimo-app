// Platform-specific implementations live outside the app directory so Metro
// resolves data-sources-screen.android.tsx on Android and
// data-sources-screen.tsx (SwiftUI via @expo/ui universal components)
// everywhere else.
export { default } from "~/settings/data-sources-screen";

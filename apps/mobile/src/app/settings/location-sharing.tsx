// Platform-specific implementations live outside the app directory so Metro
// resolves location-sharing-screen.android.tsx on Android and
// location-sharing-screen.tsx (SwiftUI via @expo/ui universal components)
// everywhere else.
export { default } from "~/settings/location-sharing-screen";

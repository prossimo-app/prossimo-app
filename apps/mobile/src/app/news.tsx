// Platform-specific implementations live outside the app directory so Metro
// resolves news-screen.android.tsx on Android and news-screen.tsx (SwiftUI
// via @expo/ui universal components) everywhere else.
export { default } from "~/news/news-screen";

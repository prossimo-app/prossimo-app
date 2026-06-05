import { getLocales } from "expo-localization";

import { initializeI18n } from "@prossimo-app/localization";

initializeI18n({
  locales: getLocales(),
});

import { defineConfig } from "eslint/config";

import {
  baseConfig,
  restrictEnvAccess,
} from "@prossimo-app/eslint-config/base";
import { nextjsConfig } from "@prossimo-app/eslint-config/nextjs";
import { reactConfig } from "@prossimo-app/eslint-config/react";

export default defineConfig(
  {
    ignores: [".next/**"],
  },
  baseConfig,
  reactConfig,
  nextjsConfig,
  restrictEnvAccess,
);

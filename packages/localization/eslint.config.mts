import { defineConfig } from "eslint/config";

import { baseConfig } from "@prossimo-app/eslint-config/base";
import { reactConfig } from "@prossimo-app/eslint-config/react";

export default defineConfig(baseConfig, reactConfig);

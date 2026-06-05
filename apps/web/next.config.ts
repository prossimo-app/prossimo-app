import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const nextConfig: NextConfig = {
  reactCompiler: true,

  turbopack: {
    root: workspaceRoot,
  },

  transpilePackages: ["@prossimo-app/api", "@prossimo-app/localization"],

  /** We already do linting and typechecking as separate tasks in CI */
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;

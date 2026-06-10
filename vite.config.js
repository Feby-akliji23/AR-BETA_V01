import { defineConfig, loadEnv } from "vite";
import { resolve, join } from "path";
import { copyFileSync, mkdirSync, existsSync, readdirSync, statSync } from "fs";

function copyDracoPlugin() {
  return {
    name: "copy-draco",
    buildStart() {
      const src = resolve("node_modules/three/examples/jsm/libs/draco/");
      const dest = resolve("public/assets/draco/");
      if (!existsSync(src)) return;
      mkdirSync(dest, { recursive: true });
      for (const entry of readdirSync(src)) {
        const srcPath = join(src, entry);
        if (statSync(srcPath).isFile()) copyFileSync(srcPath, join(dest, entry));
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    base: process.env.GITHUB_ACTIONS ? "/AR-BETA_V01/" : "/",
    plugins: [copyDracoPlugin()],
    server: {
      host: true,
      allowedHosts: env.ALLOWED_HOSTS ? env.ALLOWED_HOSTS.split(",") : [],
    },
  };
});

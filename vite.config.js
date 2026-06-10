import { defineConfig, loadEnv } from "vite";
import { resolve, join } from "path";
import { copyFileSync, mkdirSync, existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "fs";

const { version: appVersion } = JSON.parse(readFileSync(resolve("package.json"), "utf8"));
const buildId = `${appVersion}-${Date.now().toString(36)}`;

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

function versionServiceWorkerPlugin() {
  return {
    name: "version-service-worker",
    closeBundle() {
      const serviceWorkerPath = resolve("dist/sw.js");
      if (!existsSync(serviceWorkerPath)) return;
      const source = readFileSync(serviceWorkerPath, "utf8");
      writeFileSync(serviceWorkerPath, source.replaceAll("__APP_VERSION__", buildId));
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    base: process.env.GITHUB_ACTIONS ? "/AR-BETA_V01/" : "/",
    plugins: [copyDracoPlugin(), versionServiceWorkerPlugin()],
    server: {
      host: true,
      allowedHosts: env.ALLOWED_HOSTS ? env.ALLOWED_HOSTS.split(",") : [],
    },
  };
});

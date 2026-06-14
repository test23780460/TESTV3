import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react()],
    base: env.VITE_GITHUB_PAGES_BASE_PATH || "/TESTV3/",
    build: {
      outDir: "dist",
      sourcemap: true
    }
  };
});

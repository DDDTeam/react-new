import { defineConfig } from "vite";

const baseViteConfig = defineConfig((_) => {
  return {
    plugins: [],
    build: {
      lib: {
        entry: "src/index.ts",
        name: "DDD React",
        formats: ["es"],
        fileName: "ddd-react",
      },
      outDir: "dist",
      emptyOutDir: true,
      sourcemap: false,
      cssCodeSplit: false,
    },
  };
});

export default baseViteConfig;

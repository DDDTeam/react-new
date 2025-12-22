import { defineConfig } from "vite";

const baseViteConfig = defineConfig((_) => {
  return {
    plugins: [],
    build: {
      lib: {
        entry: {
          index: "src/index.ts",
          "jsx-runtime": "src/jsx-runtime.ts",
          "jsx-dev-runtime": "src/jsx-dev-runtime.ts"
        },
        name: "DDD React",
        formats: ["es"],
        fileName: (format, entryName) => `${entryName}.js`
      },
      outDir: "dist",
      emptyOutDir: true,
      sourcemap: false,
      cssCodeSplit: false,
      rollupOptions: {
        external: [], // добавьте внешние зависимости если есть
        output: {
          preserveModules: false,
          exports: "named"
        }
      }
    },
  };
});

export default baseViteConfig;

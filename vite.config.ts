import { defineConfig } from "vite";

export default defineConfig((_) => {
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
      },
      outDir: "dist",
      emptyOutDir: true,
      sourcemap: false,
      cssCodeSplit: false,
    },
  };
});

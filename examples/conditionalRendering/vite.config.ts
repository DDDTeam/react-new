import {defineConfig} from "vite";

export default defineConfig({
    esbuild: {
        jsx: 'transform',
        jsxFactory: 'jsx',
        jsxFragment: 'Fragment',
        jsxInject: "import {jsx, Fragment} from 'ddd-react/jsx-runtime'",
        jsxDev: false,
    },
})

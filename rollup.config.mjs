import {nodeResolve} from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';
import cleanup from 'rollup-plugin-cleanup';
import filesize from 'rollup-plugin-filesize';
import dts from 'rollup-plugin-dts';
import del from 'rollup-plugin-delete';

const config = [
  // Main React build
  {
    input: 'src/index.ts',
    plugins: [
      nodeResolve({extensions: ['.js', '.ts', '.tsx']}),
      typescript({
        tsconfig: './tsconfig.json',
        sourceMap: true,
        compilerOptions: {
          declaration: true,
          declarationDir: 'dist/types-temp', // билдим в промежуточную папку, чтобы все сбилдить в один файл в итоге
          emitDeclarationOnly: false,
          declarationMap: false,
          allowImportingTsExtensions: false,
          noEmit: false,
        },
      }),
      cleanup(),
    ],
    output: [
      {
        file: 'dist/react.js',
        format: 'esm',
        sourcemap: true,
        plugins: [filesize()],
      },
      {
        file: 'dist/react.min.js',
        format: 'esm',
        sourcemap: true,
        plugins: [terser(), filesize()],
      },
    ],
  },

  // JSX runtimes
  {
    input: 'src/jsx/jsx-runtime.ts',
    plugins: [
      nodeResolve({extensions: ['.js', '.ts', '.tsx']}),
      typescript({
        tsconfig: './tsconfig.json',
        sourceMap: false,
        compilerOptions: {
          declaration: true,
          declarationDir: 'dist/jsx/types-temp', // также билдим в промежуточную папку
          emitDeclarationOnly: false,
          declarationMap: false,
          allowImportingTsExtensions: false,
          noEmit: false,
        },
      }),
      cleanup(),
    ],
    output: [
      {
        file: 'dist/jsx/jsx-runtime.js',
        format: 'esm',
        sourcemap: false,
        plugins: [filesize()],
      },
      {
        file: 'dist/jsx/jsx-runtime.min.js',
        format: 'esm',
        sourcemap: false,
        plugins: [terser(), filesize()],
      },
    ],
  },

  // JSX dev runtime
  {
    input: 'src/jsx/jsx-dev-runtime.ts',
    plugins: [
      nodeResolve({extensions: ['.js', '.ts', '.tsx']}),
      typescript({
        tsconfig: './tsconfig.json',
        sourceMap: false,
        compilerOptions: {
          declaration: true,
          declarationDir: 'dist/jsx/types-temp',
          emitDeclarationOnly: false,
          declarationMap: false,
          allowImportingTsExtensions: false,
          noEmit: false,
        },
      }),
      cleanup(),
    ],
    output: [
      {
        file: 'dist/jsx/jsx-dev-runtime.js',
        format: 'esm',
        sourcemap: false,
        plugins: [filesize()],
      },
      {
        file: 'dist/jsx/jsx-dev-runtime.min.js',
        format: 'esm',
        sourcemap: false,
        plugins: [terser(), filesize()],
      },
    ],
  },
  // Type definitions bundling
  {
    input: 'dist/types-temp/index.d.ts',
    output: {
      file: 'dist/react.d.ts', // собираем все промежуточные файлы в один react.js
      format: 'es',
    },
    plugins: [dts(), del({targets: ['dist/types-temp'], hook: 'writeBundle'})],
  },
  // JSX runtime type definitions
  {
    input: 'dist/jsx/types-temp/jsx/jsx-runtime.d.ts',
    output: {
      file: 'dist/jsx/jsx-runtime.d.ts', // собираем все промежуточные файлы в jsx папку
      format: 'es',
    },
    plugins: [dts()],
  },
  // JSX dev runtime type definitions
  {
    input: 'dist/jsx/types-temp/jsx/jsx-dev-runtime.d.ts',
    output: {
      file: 'dist/jsx/jsx-dev-runtime.d.ts', // собираем все промежуточные файлы в jsx папку
      format: 'es',
    },
    plugins: [dts(), del({targets: ['dist/jsx/types-temp'], hook: 'writeBundle'})],
  },
];

export default config;

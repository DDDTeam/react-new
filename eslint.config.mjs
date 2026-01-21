import { defineConfig } from 'eslint/config';

import tseslint from 'typescript-eslint';


const Ignores = [
	'node_modules/',
	'dist/**',
	'vite.config.ts',
	'examples/**'
];

export default defineConfig([
	{
		files: ['**/*.ts'],
		plugins: {
			'@typescript-eslint': tseslint.plugin,
		},
		extends: [
			...tseslint.configs.recommended,
		],
		languageOptions: {
			parser: tseslint.parser,
			parserOptions: {
				project: ['./tsconfig.json'],
				sourceType: 'module',
				ecmaVersion: 'latest',
			},
		},
		rules: {
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-empty-object-type': 'off',
			'@typescript-eslint/no-unused-vars': 'off',
			'@typescript-eslint/no-unsafe-function-type': 'off'
		},
		ignores: Ignores,
	},
]);

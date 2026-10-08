import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		environment: 'node',
		pool: 'threads',
		testTimeout: 15000,
		include: ['src/**/*.spec.ts', 'src/**/*.spec.tsx'],
		passWithNoTests: true
	}
});

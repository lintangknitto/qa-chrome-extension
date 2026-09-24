import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		environment: 'node',
		pool: 'threads',
		include: ['src/**/*.spec.ts', 'src/**/*.spec.tsx'],
		passWithNoTests: true
	}
});

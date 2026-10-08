// Impor teks mentah via Vite/Vitest (`import csv from './x.csv?raw'`), dipakai fixture test.
declare module '*?raw' {
	const content: string;
	export default content;
}

/**
 * Mock provider OpenAI-compatible untuk QA lokal.
 *
 * Bukan bagian dari backend dan bukan service produksi — hanya agar jalur
 * generasi Markdown + draft Playwright bisa diuji end-to-end tanpa memanggil
 * provider AI sungguhan.
 *
 * Pemakaian:
 *   node dev-infra/mock-openai.mjs          # default port 8090
 *   MOCK_OPENAI_PORT=8090 node dev-infra/mock-openai.mjs
 *
 * Lalu set di .env backend:
 *   OPENAI_BASE_URL=http://127.0.0.1:8090/v1
 *   OPENAI_API_KEY=mock-key
 *   OPENAI_MODEL=mock-model
 */
import { createServer } from 'node:http';

const port = Number(process.env.MOCK_OPENAI_PORT ?? 8090);

const replyFor = (userContent) => {
	if (/playwright|typescript|draft test/i.test(userContent))
		return [
			"import { test, expect } from '@playwright/test';",
			'',
			"test('contoh alur dari rekaman tester', async ({ page }) => {",
			"\tawait page.goto('https://contoh.test/');",
			"\tawait page.getByRole('button', { name: 'Login' }).click();",
			'\t// asumsi: kredensial diisi manual saat review',
			"\tawait expect(page).toHaveURL(/dashboard/);",
			'});'
		].join('\n');

	return [
		'# Ringkasan Sesi QA (mock)',
		'',
		'## Identitas Test Case',
		'- Sumber: mock provider untuk QA lokal',
		'',
		'## Temuan',
		'- Anomali console/network yang terdeteksi tercatat pada konteks.',
		'- Langkah tester dapat direkonstruksi dari urutan action.',
		'',
		'## Rekomendasi',
		'- Verifikasi ulang endpoint yang gagal saat debugging.'
	].join('\n');
};

const server = createServer((req, res) => {
	if (req.method !== 'POST' || !req.url?.includes('/chat/completions')) {
		res.writeHead(404, { 'Content-Type': 'application/json' });
		res.end(JSON.stringify({ error: { message: 'not found' } }));
		return;
	}

	let body = '';
	req.on('data', (chunk) => {
		body += chunk;
	});
	req.on('end', () => {
		let messages = [];
		try {
			messages = JSON.parse(body).messages ?? [];
		} catch {
			messages = [];
		}
		// System prompt membedakan Markdown vs draft Playwright, jadi keduanya
		// ikut dipertimbangkan saat memilih balasan.
		const userContent = messages.map((message) => message.content).join('\n');

		res.writeHead(200, { 'Content-Type': 'application/json' });
		res.end(
			JSON.stringify({
				id: 'chatcmpl-mock',
				object: 'chat.completion',
				model: 'mock-model',
				choices: [
					{
						index: 0,
						message: { role: 'assistant', content: replyFor(userContent) },
						finish_reason: 'stop'
					}
				]
			})
		);
	});
});

server.listen(port, '127.0.0.1', () => {
	console.log(`mock OpenAI-compatible listening on http://127.0.0.1:${port}/v1`);
});

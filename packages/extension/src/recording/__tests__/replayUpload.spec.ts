// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	executeReplay,
	loadUploadPayloads,
	matchTestDataFiles,
	parseScriptToReplaySteps,
	stepFileNames,
	uploadIntoPage
} from '../replayEngine';

const invoice = { file_name: 'invoice.pdf', content_type: 'application/pdf', download_url: 'http://minio/b/1.pdf' };

describe('replay langkah upload file', () => {
	const originalChrome = globalThis.chrome;

	afterEach(() => {
		globalThis.chrome = originalChrome;
		delete (globalThis as any).DataTransfer;
	});

	it('parser membaca semua file setInputFiles dan nama yang diharapkan berupa basename', () => {
		const [step] = parseScriptToReplaySteps(
			"await page.getByLabel('Lampiran').setInputFiles(['test-data/invoice.pdf', 'test-data/foto.png']);"
		);
		expect(step).toMatchObject({ action: 'setInputFiles', files: ['test-data/invoice.pdf', 'test-data/foto.png'] });
		expect(stepFileNames(step)).toEqual(['invoice.pdf', 'foto.png']);
		expect(stepFileNames({ action: 'setInputFiles', value: 'fixtures\\lama.csv' })).toEqual(['lama.csv']);
	});

	it('matchTestDataFiles memisahkan file tersedia dan yang hilang', () => {
		const step = { action: 'setInputFiles' as const, files: ['test-data/invoice.pdf', 'test-data/foto.png'] };
		expect(matchTestDataFiles(step, [invoice])).toEqual({ matched: [invoice], missing: ['foto.png'] });
		expect(matchTestDataFiles(step)).toEqual({ matched: [], missing: ['invoice.pdf', 'foto.png'] });
	});

	it('loadUploadPayloads mengambil isi file sebagai base64 dengan nama tersimpan', async () => {
		const fetchFile = vi.fn(async () => new Blob(['halo'], { type: 'application/pdf' }));
		await expect(loadUploadPayloads([invoice], fetchFile)).resolves.toEqual([
			{ name: 'invoice.pdf', type: 'application/pdf', data: 'aGFsbw==' }
		]);
		expect(fetchFile).toHaveBeenCalledWith('http://minio/b/1.pdf');
	});

	it('uploadIntoPage memasang file lewat DataTransfer lalu memicu input + change', () => {
		document.body.innerHTML = '<input id="f" type="file">';
		const added: File[] = [];
		(globalThis as any).DataTransfer = class {
			items = { add: (file: File) => added.push(file) };
			get files() {
				return added as unknown as FileList;
			}
		};
		const input = document.getElementById('f') as HTMLInputElement;
		let assigned: unknown = null;
		Object.defineProperty(input, 'files', { set: (value) => (assigned = value), get: () => assigned as FileList });
		const events: string[] = [];
		input.addEventListener('input', () => events.push('input'));
		input.addEventListener('change', () => events.push('change'));

		const result = uploadIntoPage(null, '#f', [{ name: 'invoice.pdf', type: 'application/pdf', data: 'aGFsbw==' }]);

		expect(result).toEqual({ success: true });
		expect(added.map((file) => [file.name, file.type, file.size])).toEqual([['invoice.pdf', 'application/pdf', 4]]);
		expect(assigned).toBe(added);
		expect(events).toEqual(['input', 'change']);
		expect(uploadIntoPage(null, '#tidak-ada', [])).toEqual({ success: false, error: 'Input file "#tidak-ada" tidak ditemukan.' });
	});

	const stubChrome = (executeScript = vi.fn().mockResolvedValue([{ result: { success: true } }])) => {
		globalThis.chrome = {
			tabs: { query: vi.fn().mockResolvedValue([{ id: 7 }]), update: vi.fn().mockResolvedValue({}) },
			scripting: { executeScript }
		} as unknown as typeof chrome;
		return executeScript;
	};

	it('executeReplay gagal dengan pesan jelas bila file langkah upload tidak tersedia', async () => {
		stubChrome();
		const result = await executeReplay({
			sessionId: 1,
			testCaseNo: 'TC-UP',
			parameterOverrides: {},
			mode: 'activeTab',
			stepDelayMs: 0,
			steps: [{ action: 'setInputFiles', selector: '#f', files: ['test-data/invoice.pdf'] }],
			testDataFiles: []
		});
		expect(result.success).toBe(false);
		expect(result.failedStepNo).toBe(1);
		expect(result.error).toBe('File test data untuk langkah upload tidak tersedia: invoice.pdf. Pilih file pengganti di modal Re-run.');
	});

	it('executeReplay memasang file tersimpan di langkah upload', async () => {
		const executeScript = stubChrome();
		const result = await executeReplay({
			sessionId: 1,
			testCaseNo: 'TC-UP',
			parameterOverrides: {},
			mode: 'activeTab',
			stepDelayMs: 0,
			steps: [{ action: 'setInputFiles', selector: '#f', files: ['test-data/invoice.pdf'] }],
			testDataFiles: [invoice],
			fetchTestDataFile: async () => new Blob(['halo'])
		});
		expect(result.success).toBe(true);
		const uploadCall = executeScript.mock.calls.find(([arg]) => arg.func === uploadIntoPage);
		expect(uploadCall?.[0].args).toEqual([null, '#f', [{ name: 'invoice.pdf', type: 'application/pdf', data: 'aGFsbw==' }]]);
	});
});

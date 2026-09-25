import { describe, expect, it, vi } from 'vitest';
import { executeReplay, parseScriptToReplaySteps } from '../replayEngine';

describe('replayEngine', () => {
	it('parseScriptToReplaySteps berhasil mengurai baris script playwright', () => {
		const script = `
			// Buka halaman
			await page.goto('https://app.knitto.co.id');
			await page.fill('#username', 'tester');
			await page.click('#submit-btn');
			await page.waitForTimeout(2000);
		`;

		const steps = parseScriptToReplaySteps(script);
		expect(steps).toEqual([
			{ action: 'goto', url: 'https://app.knitto.co.id', description: 'Navigasi ke https://app.knitto.co.id' },
			{ action: 'fill', selector: '#username', value: 'tester', description: 'Mengisi field "#username" dengan "tester"' },
			{ action: 'click', selector: '#submit-btn', description: 'Mengklik elemen "#submit-btn"' },
			{ action: 'wait', timeoutMs: 2000, description: 'Menunggu jeda 2000ms' }
		]);
	});

	it('mengurai variasi getByPlaceholder, getByRole, selectOption, dan check', () => {
		const script = `
			await page.getByPlaceholder('Ketik email').fill('user@knitto.id');
			await page.getByRole('button', { name: 'Masuk' }).click();
			await page.selectOption('#role', 'qa');
			await page.check('#agree-terms');
		`;

		const steps = parseScriptToReplaySteps(script);
		expect(steps).toEqual([
			{ action: 'fill', selector: 'Ketik email', value: 'user@knitto.id', description: 'Mengisi field "Ketik email" dengan "user@knitto.id"' },
			{ action: 'click', selector: 'text=Masuk', description: 'Mengklik elemen "text=Masuk"' },
			{ action: 'select', selector: '#role', value: 'qa', description: 'Memilih opsi "qa" pada "#role"' },
			{ action: 'check', selector: '#agree-terms', value: 'true', description: 'Centang "#agree-terms"' }
		]);
	});

	it('menggunakan fallbackUrl jika script tidak memiliki perintah goto', () => {
		const script = `await page.fill('#code', '123');`;
		const steps = parseScriptToReplaySteps(script, 'https://fallback.knitto.com');
		expect(steps[0]).toEqual({ action: 'fill', selector: '#code', value: '123', description: 'Mengisi field "#code" dengan "123"' });
	});

	it('mengembalikan error jika tidak ada langkah yang dapat dijalankan', async () => {
		const result = await executeReplay({
			sessionId: 1,
			testCaseNo: 'TC-01',
			parameterOverrides: {},
			mode: 'activeTab',
			script: ''
		});

		expect(result.success).toBe(false);
		expect(result.error).toContain('Tidak ada langkah');
	});

	it('eksekusi replay dengan mode tabGroup memanggil chrome.tabs.create dan group', async () => {
		const originalChrome = globalThis.chrome;

		const createTabMock = vi.fn().mockResolvedValue({ id: 101 });
		const groupMock = vi.fn().mockResolvedValue(55);
		const updateGroupMock = vi.fn().mockResolvedValue({});
		const executeScriptMock = vi.fn().mockResolvedValue([]);

		globalThis.chrome = {
			...originalChrome,
			tabs: {
				create: createTabMock,
				group: groupMock,
				update: vi.fn().mockResolvedValue({})
			},
			tabGroups: {
				update: updateGroupMock
			},
			scripting: {
				executeScript: executeScriptMock
			}
		} as unknown as typeof chrome;

		try {
			const result = await executeReplay({
				sessionId: 42,
				testCaseNo: 'TC-AUTH-01',
				targetUrl: 'https://app.knitto.co.id/login',
				parameterOverrides: { '#username': 'supertester' },
				mode: 'tabGroup',
				steps: [
					{ action: 'goto', url: 'https://app.knitto.co.id/login' },
					{ action: 'fill', selector: '#username', value: 'default_user' }
				]
			});

			expect(createTabMock).toHaveBeenCalled();
			expect(groupMock).toHaveBeenCalledWith({ tabIds: [101] });
			expect(updateGroupMock).toHaveBeenCalledWith(55, {
				title: 'Knitto Replay - TC-AUTH-01',
				color: 'blue'
			});
			expect(result.success).toBe(true);
			expect(result.executedSteps).toBe(2);
			expect(result.tabId).toBe(101);
			expect(result.groupId).toBe(55);
		} finally {
			globalThis.chrome = originalChrome;
		}
	});

	it('mengembalikan error jika target tab tidak ditemukan pada mode activeTab', async () => {
		const originalChrome = globalThis.chrome;
		globalThis.chrome = {
			...originalChrome,
			tabs: {
				query: vi.fn().mockResolvedValue([])
			}
		} as unknown as typeof chrome;

		try {
			const result = await executeReplay({
				sessionId: 10,
				testCaseNo: 'TC-02',
				parameterOverrides: {},
				mode: 'activeTab',
				steps: [{ action: 'fill', selector: '#search', value: 'kain' }]
			});

			expect(result.success).toBe(false);
			expect(result.error).toContain('Tab target tidak ditemukan');
		} finally {
			globalThis.chrome = originalChrome;
		}
	});

	it('menangani error scripting execution dan mengembalikan success false dengan pesan error', async () => {
		const originalChrome = globalThis.chrome;
		globalThis.chrome = {
			...originalChrome,
			tabs: {
				query: vi.fn().mockResolvedValue([{ id: 202 }])
			},
			scripting: {
				executeScript: vi.fn().mockRejectedValue(new Error('Koneksi tab terputus'))
			}
		} as unknown as typeof chrome;

		try {
			const result = await executeReplay({
				sessionId: 10,
				testCaseNo: 'TC-03',
				parameterOverrides: {},
				mode: 'activeTab',
				steps: [
					{ action: 'fill', selector: '#username', value: 'admin' }
				]
			});

			expect(result.success).toBe(false);
			expect(result.error).toContain('Koneksi tab terputus');
		} finally {
			globalThis.chrome = originalChrome;
		}
	});

	it('menjalankan aksi click dan wait secara sukses pada replay steps', async () => {
		const originalChrome = globalThis.chrome;
		const executeScriptMock = vi.fn().mockResolvedValue([]);

		globalThis.chrome = {
			...originalChrome,
			tabs: {
				query: vi.fn().mockResolvedValue([{ id: 303 }])
			},
			scripting: {
				executeScript: executeScriptMock
			}
		} as unknown as typeof chrome;

		try {
			const result = await executeReplay({
				sessionId: 11,
				testCaseNo: 'TC-04',
				parameterOverrides: {},
				mode: 'activeTab',
				steps: [
					{ action: 'click', selector: '#btn-submit' },
					{ action: 'wait', timeoutMs: 50 }
				]
			});

			expect(result.success).toBe(true);
			expect(result.executedSteps).toBe(2);
			expect(executeScriptMock).toHaveBeenCalled();
		} finally {
			globalThis.chrome = originalChrome;
		}
	});
});

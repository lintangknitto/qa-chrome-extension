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
		expect(steps).toMatchObject([
			{ action: 'goto', url: 'https://app.knitto.co.id' },
			{ action: 'fill', selector: '#username', locator: { kind: 'css', value: '#username' }, value: 'tester' },
			{ action: 'click', selector: '#submit-btn', locator: { kind: 'css', value: '#submit-btn' } },
			{ action: 'wait', timeoutMs: 2000 }
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
		expect(steps).toMatchObject([
			{ action: 'fill', locator: { kind: 'placeholder', value: 'Ketik email' }, value: 'user@knitto.id' },
			{ action: 'click', locator: { kind: 'role', role: 'button', name: 'Masuk' } },
			{ action: 'select', selector: '#role', value: 'qa', optionBy: 'value' },
			{ action: 'check', selector: '#agree-terms', value: 'true' }
		]);
	});

	it('menggunakan fallbackUrl jika script tidak memiliki perintah goto', () => {
		const script = `await page.fill('#code', '123');`;
		const steps = parseScriptToReplaySteps(script, 'https://fallback.knitto.com');
		expect(steps[0]).toMatchObject({ action: 'fill', selector: '#code', value: '123' });
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

	it('memanggil hook onTabReady dengan targetTabId saat tab siap', async () => {
		const originalChrome = globalThis.chrome;
		const onTabReadyMock = vi.fn().mockResolvedValue(undefined);
		const executeScriptMock = vi.fn().mockResolvedValue([]);

		globalThis.chrome = {
			...originalChrome,
			tabs: {
				query: vi.fn().mockResolvedValue([{ id: 404 }])
			},
			scripting: {
				executeScript: executeScriptMock
			}
		} as unknown as typeof chrome;

		try {
			const result = await executeReplay({
				sessionId: 12,
				testCaseNo: 'TC-HOOK-01',
				parameterOverrides: {},
				mode: 'activeTab',
				steps: [{ action: 'wait', timeoutMs: 20 }],
				onTabReady: onTabReadyMock
			});

			expect(result.success).toBe(true);
			expect(onTabReadyMock).toHaveBeenCalledWith(404);
		} finally {
			globalThis.chrome = originalChrome;
		}
	});

	it('menjalankan eksekusi dengan pacing delay kustom (fast 300ms / custom stepDelayMs)', async () => {
		const originalChrome = globalThis.chrome;
		const executeScriptMock = vi.fn().mockResolvedValue([]);

		globalThis.chrome = {
			...originalChrome,
			tabs: {
				query: vi.fn().mockResolvedValue([{ id: 505 }])
			},
			scripting: {
				executeScript: executeScriptMock
			}
		} as unknown as typeof chrome;

		try {
			const result = await executeReplay({
				sessionId: 13,
				testCaseNo: 'TC-PACING-01',
				parameterOverrides: {},
				mode: 'activeTab',
				speedMode: 'fast',
				stepDelayMs: 10, // gunakan jeda kecil untuk kecepatan test
				steps: [{ action: 'wait', timeoutMs: 10 }]
			});

			expect(result.success).toBe(true);
			expect(result.executedSteps).toBe(1);
		} finally {
			globalThis.chrome = originalChrome;
		}
	});

	it('mengurai baris script Playwright dengan assignment variabel dan regex locators', () => {
		const script = `
			await page.goto('https://chat.knitto.org/chat');
			const daftarChat = page.getByRole('button', { name: /chat|pesan/i });
			await daftarChat.click();
			const kolomPesan = page.getByPlaceholder(/ketik pesan/i);
			await kolomPesan.fill('Pesan otomatis');
			const tombolKirim = page.getByRole('button', { name: 'Kirim' });
			await tombolKirim.click();
		`;

		const steps = parseScriptToReplaySteps(script);
		expect(steps).toMatchObject([
			{ action: 'goto', url: 'https://chat.knitto.org/chat' },
			{ action: 'click', locator: { kind: 'role', role: 'button', name: 'chat|pesan', regexFlags: 'i' } },
			{ action: 'fill', locator: { kind: 'placeholder', value: 'ketik pesan', regexFlags: 'i' }, value: 'Pesan otomatis' },
			{ action: 'click', locator: { kind: 'role', role: 'button', name: 'Kirim' } }
		]);
	});

	it('memulihkan storageState cookies dan localStorage saat eksekusi replay', async () => {
		const originalChrome = globalThis.chrome;
		const setCookieMock = vi.fn().mockResolvedValue({});
		const executeScriptMock = vi.fn().mockResolvedValue([]);

		globalThis.chrome = {
			...originalChrome,
			tabs: {
				query: vi.fn().mockResolvedValue([{ id: 606 }]),
				update: vi.fn().mockResolvedValue({})
			},
			cookies: {
				set: setCookieMock
			},
			scripting: {
				executeScript: executeScriptMock
			}
		} as unknown as typeof chrome;

		try {
			const result = await executeReplay({
				sessionId: 14,
				testCaseNo: 'TC-STORAGE-01',
				parameterOverrides: {},
				mode: 'activeTab',
				storageState: {
					cookies: [{ name: 'auth_token', value: 'secret_jwt', domain: 'knitto.org', path: '/' }],
					origins: [{ origin: 'https://knitto.org', localStorage: [{ name: 'user_id', value: '42' }] }]
				},
				steps: [{ action: 'wait', timeoutMs: 10 }]
			});

			expect(result.success).toBe(true);
			expect(setCookieMock).toHaveBeenCalled();
			expect(executeScriptMock).toHaveBeenCalled();
		} finally {
			globalThis.chrome = originalChrome;
		}
	});
});

describe('buildReplayFailureReport', () => {
	it('membuat payload dari langkah yang gagal; null bila sukses', async () => {
		const { buildReplayFailureReport } = await import('../replayEngine');
		expect(buildReplayFailureReport({ success: true, totalSteps: 3, executedSteps: 3 })).toBeNull();
		expect(
			buildReplayFailureReport({
				success: false,
				totalSteps: 5,
				executedSteps: 2,
				error: 'Elemen tidak ditemukan',
				failedStepNo: 3,
				failedStep: { action: 'click', selector: "getByRole('button', { name: 'Kirim' })", description: 'click Kirim' }
			})
		).toEqual({ step_no: 3, error: 'Elemen tidak ditemukan', step_description: 'click Kirim', selector: "getByRole('button', { name: 'Kirim' })", total_steps: 5 });
	});
});

describe('replay langkah di dalam iframe', () => {
	it('menjalankan langkah di frame yang memuat elemen (bukan frame utama)', async () => {
		const originalChrome = globalThis.chrome;
		const calls: Array<{ target: Record<string, unknown> }> = [];
		const executeScript = vi.fn(async (options: { target: Record<string, unknown>; args?: unknown[] }) => {
			calls.push({ target: options.target });
			if (options.target.allFrames && options.args) {
				return [
					{ frameId: 0, result: false },
					{ frameId: 7, result: true }
				];
			}
			return [{ frameId: 7, result: { success: true } }];
		});
		globalThis.chrome = {
			...originalChrome,
			tabs: { query: vi.fn().mockResolvedValue([{ id: 5 }]), update: vi.fn().mockResolvedValue({}) },
			scripting: { executeScript }
		} as unknown as typeof chrome;

		try {
			const { executeReplay } = await import('../replayEngine');
			const result = await executeReplay({
				sessionId: 1,
				testCaseNo: 'TC',
				parameterOverrides: {},
				mode: 'activeTab',
				stepDelayMs: 0,
				script: "await page.getByTitle('Live Chat', { exact: true }).contentFrame().getByRole('button', { name: 'Kirim', exact: true }).click();"
			});
			expect(result.success).toBe(true);
			expect(calls.some((c) => (c.target.frameIds as number[] | undefined)?.[0] === 7)).toBe(true);
		} finally {
			globalThis.chrome = originalChrome;
		}
	});
});

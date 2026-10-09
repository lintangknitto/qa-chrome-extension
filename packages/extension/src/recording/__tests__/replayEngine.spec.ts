// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { installLocatorEngine } from '../locatorEngine';
import {
	assertInPage,
	buildReplayFailureReport,
	clickAtPoint,
	installReplayClick,
	executeReplay,
	parseScriptToReplaySteps,
	pressKeyInPage,
	scrollInPage,
	waitForTabUrl
} from '../replayEngine';

describe('replay navigasi', () => {
	const withChrome = async (tabs: Record<string, unknown>, run: () => Promise<void>) => {
		const originalChrome = globalThis.chrome;
		globalThis.chrome = {
			...originalChrome,
			tabs: { query: vi.fn().mockResolvedValue([{ id: 7 }]), update: vi.fn().mockResolvedValue({}), ...tabs },
			scripting: { executeScript: vi.fn().mockResolvedValue([{ result: { success: true } }]) }
		} as unknown as typeof chrome;
		try {
			await run();
		} finally {
			globalThis.chrome = originalChrome;
		}
	};

	it('reload/goBack/goForward memanggil chrome.tabs; waitForURL menunggu URL cocok glob', async () => {
		const reload = vi.fn().mockResolvedValue(undefined);
		const goBack = vi.fn().mockResolvedValue(undefined);
		const goForward = vi.fn().mockResolvedValue(undefined);
		const urls = ['https://chat.test/inbox', 'https://chat.test/chat/555'];
		const get = vi.fn().mockImplementation(async () => ({ url: urls.length > 1 ? urls.shift() : urls[0] }));
		await withChrome({ reload, goBack, goForward, get }, async () => {
			const result = await executeReplay({
				sessionId: 1,
				testCaseNo: 'TC-N',
				parameterOverrides: {},
				mode: 'activeTab',
				stepDelayMs: 0,
				script: `await page.reload();\nawait page.goBack();\nawait page.goForward();\nawait page.waitForURL('**/chat/*');`
			});
			expect(result).toMatchObject({ success: true, executedSteps: 4 });
			expect(reload).toHaveBeenCalledWith(7);
			// Back/forward lewat history di halaman (entri pushState sintetis tidak dilewati), bukan chrome.tabs.
			expect(goBack).not.toHaveBeenCalled();
			expect(goForward).not.toHaveBeenCalled();
			const historyCalls = (chrome.scripting.executeScript as unknown as ReturnType<typeof vi.fn>).mock.calls
				.map((call: unknown[]) => (call[0] as { args?: unknown[] }).args?.[0])
				.filter((dir: unknown) => dir === 'back' || dir === 'forward');
			expect(historyCalls).toEqual(['back', 'forward']);
		});
	}, 20_000);

	it('waitForTabUrl mengembalikan null bila URL tidak pernah cocok', async () => {
		await withChrome({ get: vi.fn().mockResolvedValue({ url: 'https://chat.test/inbox' }) }, async () => {
			expect(await waitForTabUrl(7, { glob: '**/chat/*' }, 60, 10)).toBeNull();
			expect(await waitForTabUrl(7, { glob: '**/inbox' }, 60, 10)).toBe('https://chat.test/inbox');
		});
	});
});

describe('assertion checkpoint', () => {
	it('assertInPage: toBeVisible, toContainText (spasi dirapikan), toHaveText, elemen hilang', () => {
		document.body.innerHTML = '<div role="status">  Pesan   terkirim ke Budi </div><div data-testid="hidden" style="display:none">x</div>';
		installLocatorEngine(window);
		const status = document.querySelector('[role="status"]') as HTMLElement;
		status.getClientRects = () => [{}] as unknown as DOMRectList;
		const spec = { kind: 'role' as const, role: 'status' };
		expect(assertInPage(spec, "getByRole('status')", 'toBeVisible', '')).toEqual({ success: true });
		expect(assertInPage(spec, "getByRole('status')", 'toContainText', 'Pesan terkirim')).toEqual({ success: true });
		expect(assertInPage(spec, "getByRole('status')", 'toHaveText', 'Pesan terkirim')).toEqual({
			success: false,
			error: `Assertion gagal: getByRole('status') diharapkan berteks "Pesan terkirim", teks aktual "Pesan terkirim ke Budi".`
		});
		expect(assertInPage({ kind: 'testId', value: 'hidden' }, "getByTestId('hidden')", 'toBeVisible', '').error).toBe("Assertion gagal: elemen getByTestId('hidden') tidak terlihat.");
		expect(assertInPage({ kind: 'testId', value: 'x' }, "getByTestId('x')", 'toBeVisible', '').error).toBe("Assertion gagal: elemen getByTestId('x') tidak ditemukan.");
	});

	it('assertion gagal menggagalkan run dengan pesan jelas dan laporan replay_failure', async () => {
		const originalChrome = globalThis.chrome;
		const executeScript = vi.fn().mockImplementation(async (arg: { func: unknown }) =>
			arg.func === assertInPage ? [{ result: { success: false, error: 'Assertion gagal: getByRole(\'status\') diharapkan berisi teks "Tersimpan", teks aktual "Gagal".' } }] : [{ result: { success: true } }]
		);
		globalThis.chrome = {
			...originalChrome,
			tabs: { query: vi.fn().mockResolvedValue([{ id: 7 }]), update: vi.fn().mockResolvedValue({}), get: vi.fn().mockResolvedValue({ url: 'https://app.test/chat/9' }) },
			scripting: { executeScript }
		} as unknown as typeof chrome;
		vi.useFakeTimers({ shouldAdvanceTime: true, advanceTimeDelta: 200 });
		try {
			const run = executeReplay({
				sessionId: 1,
				testCaseNo: 'TC-CP',
				parameterOverrides: {},
				mode: 'activeTab',
				stepDelayMs: 0,
				script: `await expect(page).toHaveURL('**/chat/*');\nawait expect(page.getByRole('status')).toContainText('Tersimpan');`
			});
			const result = await run;
			expect(result).toMatchObject({ success: false, executedSteps: 1, failedStepNo: 2 });
			expect(result.error).toContain('diharapkan berisi teks "Tersimpan"');
			expect(buildReplayFailureReport(result)).toMatchObject({ step_no: 2, selector: "getByRole('status')", step_description: `Verifikasi getByRole('status') berisi teks "Tersimpan"` });
		} finally {
			vi.useRealTimers();
			globalThis.chrome = originalChrome;
		}
	}, 20_000);
});

describe('replay multi-tab', () => {
	it('popup dipetakan ke page2, langkah page2 dijalankan di tab popup, bringToFront & newPage memakai chrome.tabs', async () => {
		const originalChrome = globalThis.chrome;
		const createdListeners: Array<(tab: { id: number; openerTabId?: number }) => void> = [];
		const executeScript = vi.fn();
		const update = vi.fn().mockResolvedValue({});
		const create = vi.fn().mockResolvedValue({ id: 9 });
		const group = vi.fn().mockResolvedValue(55);
		globalThis.chrome = {
			...originalChrome,
			tabs: {
				query: vi.fn().mockResolvedValue([{ id: 7 }]),
				update,
				create,
				group,
				get: vi.fn().mockResolvedValue({ id: 7, windowId: 1, url: 'https://app.test/invoice/1' }),
				onCreated: {
					addListener: (fn: (tab: { id: number; openerTabId?: number }) => void) => createdListeners.push(fn),
					removeListener: (fn: unknown) => createdListeners.splice(createdListeners.indexOf(fn as never), 1)
				}
			},
			scripting: { executeScript }
		} as unknown as typeof chrome;
		// Tab popup muncul segera setelah klik pemicu dijalankan.
		executeScript.mockImplementation(async () => {
			for (const fn of [...createdListeners]) fn({ id: 8, openerTabId: 7 });
			return [{ result: { success: true } }];
		});
		try {
			const result = await executeReplay({
				sessionId: 1,
				testCaseNo: 'TC-TAB',
				parameterOverrides: {},
				mode: 'activeTab',
				stepDelayMs: 0,
				script: `const [page2] = await Promise.all([page.waitForEvent('popup'), page.getByText('Invoice').click()]);
await page2.getByText('Cetak').click();
await page.bringToFront();
const page3 = await context.newPage();
await page3.getByText('API').click();`
			});
			expect(result).toMatchObject({ success: true, executedSteps: 5 });
			const tabsUsed = executeScript.mock.calls.map(([arg]) => arg.target.tabId).filter((id, i, all) => all.indexOf(id) === i);
			expect(tabsUsed).toEqual([7, 8, 9]);
			expect(update).toHaveBeenCalledWith(7, { active: true });
			expect(create).toHaveBeenCalledWith({ url: 'about:blank', active: true, windowId: 1 });
		} finally {
			globalThis.chrome = originalChrome;
		}
	});

	it('langkah di page2 tanpa tab terbuka gagal dengan pesan jelas', async () => {
		const originalChrome = globalThis.chrome;
		globalThis.chrome = {
			...originalChrome,
			tabs: { query: vi.fn().mockResolvedValue([{ id: 7 }]), update: vi.fn().mockResolvedValue({}) },
			scripting: { executeScript: vi.fn().mockResolvedValue([{ result: { success: true } }]) }
		} as unknown as typeof chrome;
		try {
			const result = await executeReplay({ sessionId: 1, testCaseNo: 'T', parameterOverrides: {}, mode: 'activeTab', stepDelayMs: 0, script: `await page2.getByText('X').click();` });
			expect(result).toMatchObject({ success: false, failedStepNo: 1, error: 'Tab untuk page2 belum dibuka sebelum langkah 1.' });
		} finally {
			globalThis.chrome = originalChrome;
		}
	});
});

describe('pressKeyInPage', () => {
	it('kombinasi modifier dikirim dengan flag ctrl/shift dan key terakhir; Control++ berarti tombol +', () => {
		document.body.innerHTML = '<textarea placeholder="Pesan"></textarea>';
		installLocatorEngine(window);
		const area = document.querySelector('textarea')!;
		const seen: Array<Partial<KeyboardEvent>> = [];
		area.addEventListener('keydown', (e) => seen.push({ key: e.key, ctrlKey: e.ctrlKey, shiftKey: e.shiftKey, altKey: e.altKey, metaKey: e.metaKey }));
		const spec = { kind: 'placeholder' as const, value: 'Pesan', exact: true };
		expect(pressKeyInPage(spec, "getByPlaceholder('Pesan')", 'Control+Shift+Enter')).toEqual({ success: true });
		pressKeyInPage(spec, '', 'Control++');
		pressKeyInPage(spec, '', 'Alt+Meta+k');
		expect(seen).toEqual([
			{ key: 'Enter', ctrlKey: true, shiftKey: true, altKey: false, metaKey: false },
			{ key: '+', ctrlKey: true, shiftKey: false, altKey: false, metaKey: false },
			{ key: 'k', ctrlKey: false, shiftKey: false, altKey: true, metaKey: true }
		]);
		expect(document.activeElement).toBe(area);
	});

	it('tanpa locator memakai elemen fokus; PageDown/End di luar field teks menggeser window', () => {
		document.body.innerHTML = '<p>isi</p>';
		const scrollBy = vi.spyOn(window, 'scrollBy').mockImplementation(() => {});
		const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
		const keys: string[] = [];
		document.body.addEventListener('keydown', (e) => keys.push(e.key));
		pressKeyInPage(null, '', 'PageDown');
		pressKeyInPage(null, '', 'End');
		pressKeyInPage(null, '', 'Space');
		expect(keys).toEqual(['PageDown', 'End', ' ']);
		expect(scrollBy).toHaveBeenCalledWith(0, Math.round(window.innerHeight * 0.875));
		expect(scrollTo).toHaveBeenCalled();
		expect(scrollBy).toHaveBeenCalledTimes(2);
	});

	it('keydown yang di-preventDefault aplikasi tidak memicu scroll; locator tidak ditemukan → gagal', () => {
		document.body.innerHTML = '<div id="grid" tabindex="0"></div>';
		const grid = document.getElementById('grid')!;
		grid.focus();
		grid.addEventListener('keydown', (e) => e.preventDefault());
		const scrollBy = vi.spyOn(window, 'scrollBy').mockImplementation(() => {});
		pressKeyInPage(null, '', 'ArrowDown');
		expect(scrollBy).not.toHaveBeenCalled();
		installLocatorEngine(window);
		expect(pressKeyInPage({ kind: 'testId', value: 'x' }, "getByTestId('x')", 'Enter').success).toBe(false);
	});
});

describe('clickAtPoint (aksi tanpa locator)', () => {
	const setup = () => {
		document.body.innerHTML = '<canvas id="c"></canvas>';
		const canvas = document.getElementById('c')!;
		const events: string[] = [];
		for (const type of ['click', 'dblclick', 'contextmenu']) canvas.addEventListener(type, () => events.push(type));
		const elementFromPoint = vi.fn().mockReturnValue(canvas);
		(document as any).elementFromPoint = elementFromPoint;
		return { events, elementFromPoint };
	};

	it('viewport sama: klik di koordinat asli tanpa peringatan', () => {
		const { events, elementFromPoint } = setup();
		const res = clickAtPoint('click', 120, 45, { w: window.innerWidth, h: window.innerHeight });
		expect(res).toEqual({ success: true });
		expect(elementFromPoint).toHaveBeenCalledWith(120, 45);
		expect(events).toEqual(['click']);
	});

	it('viewport berbeda: koordinat diskalakan proporsional dan dilaporkan', () => {
		const { events, elementFromPoint } = setup();
		const recorded = { w: window.innerWidth * 2, h: window.innerHeight * 2 };
		const res = clickAtPoint('dblclick', 200, 100, recorded);
		expect(elementFromPoint).toHaveBeenCalledWith(100, 50);
		expect(res.scaled).toEqual({ from: `${recorded.w}x${recorded.h}`, to: `${window.innerWidth}x${window.innerHeight}` });
		expect(events).toEqual(['click', 'click', 'dblclick']);
		clickAtPoint('rightclick', 1, 1, null);
		expect(events.at(-1)).toBe('contextmenu');
	});

	it('parser membaca viewport header untuk langkah mouse.click; replay mengumpulkan peringatan skala', async () => {
		const script = `test('x', async ({ page }) => {
	// Viewport rekaman: 1280x720
	await page.mouse.click(120, 45); // TODO: locator tidak stabil (canvas)
	await page.mouse.click(5, 6, { button: 'right' });
	await page.mouse.dblclick(7, 8);
});`;
		const steps = parseScriptToReplaySteps(script);
		expect(steps.map(({ description: _d, ...s }) => s)).toEqual([
			{ action: 'clickAt', x: 120, y: 45, button: 'left', viewport: { w: 1280, h: 720 } },
			{ action: 'clickAt', x: 5, y: 6, button: 'right', viewport: { w: 1280, h: 720 } },
			{ action: 'dblclickAt', x: 7, y: 8, button: 'left', viewport: { w: 1280, h: 720 } }
		]);

		const originalChrome = globalThis.chrome;
		const executeScript = vi.fn().mockImplementation(async (arg: { func: unknown }) =>
			arg.func === clickAtPoint ? [{ result: { success: true, scaled: { from: '1280x720', to: '1024x768' } } }] : [{ result: { success: true } }]
		);
		globalThis.chrome = {
			...originalChrome,
			tabs: { query: vi.fn().mockResolvedValue([{ id: 7 }]), update: vi.fn().mockResolvedValue({}) },
			scripting: { executeScript }
		} as unknown as typeof chrome;
		try {
			const result = await executeReplay({ sessionId: 1, testCaseNo: 'TC-XY', parameterOverrides: {}, mode: 'activeTab', stepDelayMs: 0, steps: steps.slice(0, 1) });
			expect(result.success).toBe(true);
			expect(result.warnings).toEqual(['Langkah 1: viewport berbeda (rekam 1280x720, replay 1024x768); koordinat klik diskalakan, hasil bisa meleset.']);
			expect(executeScript.mock.calls.find(([arg]) => arg.func === clickAtPoint)![0].args).toEqual(['click', 120, 45, { w: 1280, h: 720 }]);
		} finally {
			globalThis.chrome = originalChrome;
		}
	});
});

describe('scrollInPage', () => {
	it('scrollBy menggeser window; scrollTo menggeser container hasil locator', () => {
		document.body.innerHTML = '<div data-testid="chat-list"></div>';
		installLocatorEngine(window);
		const scrollBy = vi.spyOn(window, 'scrollBy').mockImplementation(() => {});
		const list = document.querySelector('[data-testid="chat-list"]') as HTMLElement;
		list.scrollTo = vi.fn();
		expect(scrollInPage('scrollBy', null, '', 0, 900)).toEqual({ success: true });
		expect(scrollBy).toHaveBeenCalledWith(0, 900);
		expect(scrollInPage('scrollTo', { kind: 'testId', value: 'chat-list' }, "getByTestId('chat-list')", 0, 700)).toEqual({ success: true });
		expect(list.scrollTo).toHaveBeenCalledWith(0, 700);
		expect(scrollInPage('scrollTo', { kind: 'testId', value: 'tidak-ada' }, "getByTestId('tidak-ada')", 0, 1).success).toBe(false);
	});

	it('replay menjalankan langkah scroll lewat chrome.scripting dengan argumen posisi', async () => {
		const originalChrome = globalThis.chrome;
		const executeScript = vi.fn().mockResolvedValue([{ result: { success: true } }]);
		globalThis.chrome = {
			...originalChrome,
			tabs: { query: vi.fn().mockResolvedValue([{ id: 7 }]), update: vi.fn().mockResolvedValue({}) },
			scripting: { executeScript }
		} as unknown as typeof chrome;
		try {
			const result = await executeReplay({
				sessionId: 1,
				testCaseNo: 'TC-S',
				parameterOverrides: {},
				mode: 'activeTab',
				stepDelayMs: 0,
				script: `await page.mouse.wheel(0, 500);\nawait page.getByTestId('chat-list').evaluate((el) => el.scrollTo(0, 700));`
			});
			expect(result.success).toBe(true);
			const scrollCalls = executeScript.mock.calls.filter(([arg]) => arg.func === scrollInPage).map(([arg]) => arg.args);
			expect(scrollCalls).toEqual([
				['scrollBy', null, '', 0, 500],
				['scrollTo', { kind: 'testId', value: 'chat-list' }, "getByTestId('chat-list')", 0, 700]
			]);
		} finally {
			globalThis.chrome = originalChrome;
		}
	});
});

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

describe('installReplayClick (klik replay via locator)', () => {
	const click = (el: Element, kind = 'click') => {
		installReplayClick();
		window.__knittoReplayClick!(el, kind, 1, 1);
	};

	it('urutan event lengkap dan handler click terpanggil tepat sekali', () => {
		document.body.innerHTML = '<button id="b">Simpan</button>';
		const btn = document.getElementById('b')!;
		const events: string[] = [];
		for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click', 'dblclick']) btn.addEventListener(type, () => events.push(type));
		click(btn);
		expect(events).toEqual(['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']);
	});

	it('dblclick = 2× click + 1× dblclick', () => {
		document.body.innerHTML = '<div id="d"></div>';
		const div = document.getElementById('d')!;
		const events: string[] = [];
		for (const type of ['click', 'dblclick']) div.addEventListener(type, (e) => events.push(`${type}:${(e as MouseEvent).detail}`));
		click(div, 'dblclick');
		expect(events).toEqual(['click:1', 'click:2', 'dblclick:2']);
	});

	it('activation behavior jalan sekali: checkbox, label, submit, anchor', () => {
		document.body.innerHTML = `
			<input type="checkbox" id="cb">
			<label id="lb" for="cb2">Setuju</label><input type="checkbox" id="cb2">
			<form id="f"><button id="s" type="submit">Kirim</button></form>
			<a id="a" href="#tujuan">Link</a>`;
		const cb = document.getElementById('cb') as HTMLInputElement;
		const cb2 = document.getElementById('cb2') as HTMLInputElement;
		let cb2Clicks = 0;
		cb2.addEventListener('click', () => cb2Clicks++);
		click(cb);
		expect(cb.checked).toBe(true);
		click(document.getElementById('lb')!);
		expect(cb2.checked).toBe(true);
		expect(cb2Clicks).toBe(1);

		let submits = 0;
		document.getElementById('f')!.addEventListener('submit', (e) => {
			e.preventDefault();
			submits++;
		});
		click(document.getElementById('s')!);
		expect(submits).toBe(1);

		const anchor = document.getElementById('a')!;
		let anchorClicks = 0;
		anchor.addEventListener('click', () => anchorClicks++);
		click(anchor);
		expect(anchorClicks).toBe(1);
	});
});

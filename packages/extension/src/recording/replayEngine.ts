/**
 * In-browser Replay Engine dengan dukungan Chrome Tab Groups, parameter overrides,
 * visual HUD live di halaman, element spotlighting, dan simulasi interaksi DOM nyata.
 */

export interface ReplayActionStep {
	action: 'goto' | 'fill' | 'click' | 'wait' | 'select' | 'check' | 'press';
	selector?: string;
	value?: string;
	url?: string;
	timeoutMs?: number;
	key?: string;
	description?: string;
}

export interface ReplayOptions {
	sessionId: number;
	testCaseNo: string;
	targetUrl?: string;
	script?: string;
	steps?: ReplayActionStep[];
	parameterOverrides: Record<string, string>; // selector -> new value
	mode: 'tabGroup' | 'activeTab';
	speedMode?: 'normal' | 'fast' | 'slow';
	stepDelayMs?: number;
	apiBaseUrl?: string;
	storageState?: any;
	onTabReady?: (tabId: number) => Promise<void> | void;
}

export interface ReplayResult {
	success: boolean;
	totalSteps: number;
	executedSteps: number;
	error?: string;
	tabId?: number;
	groupId?: number;
}

function preprocessScriptToStatements(script: string): string[] {
	const noBlockComments = script.replace(/\/\*[\s\S]*?\*\//g, '');
	const rawLines = noBlockComments.split('\n');
	const statements: string[] = [];
	let currentStmt = '';

	for (const raw of rawLines) {
		const trimmed = raw.trim();
		if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('*')) continue;

		if (currentStmt) {
			if (
				trimmed.startsWith('.') ||
				trimmed.startsWith('(') ||
				trimmed.startsWith('{') ||
				trimmed.startsWith('>') ||
				!currentStmt.endsWith(';')
			) {
				currentStmt += ' ' + trimmed;
			} else {
				statements.push(currentStmt);
				currentStmt = trimmed;
			}
		} else {
			currentStmt = trimmed;
		}

		if (currentStmt.endsWith(';')) {
			statements.push(currentStmt);
			currentStmt = '';
		}
	}

	if (currentStmt) {
		statements.push(currentStmt);
	}

	return statements;
}

/**
 * Mengurai baris script Playwright menjadi sekuens aksi replay browser yang komprehensif,
 * mendukung pemanggilan langsung maupun assignment variabel, multiline chained calls, dan regex locators.
 */
export function parseScriptToReplaySteps(script: string, fallbackUrl?: string): ReplayActionStep[] {
	if (!script) {
		return fallbackUrl ? [{ action: 'goto', url: fallbackUrl, description: `Navigasi ke ${fallbackUrl}` }] : [];
	}

	const steps: ReplayActionStep[] = [];
	const statements = preprocessScriptToStatements(script);
	const locatorVariables = new Map<string, string>();

	for (const rawStmt of statements) {
		const line = rawStmt.trim().replace(/^await\s+/, '');
		if (!line || line.startsWith('//') || line.startsWith('/*') || line.startsWith('*')) continue;

		// 0. Pelacakan assignment variabel: const btn = page.getByRole(...) / page.locator(...)
		const varAssignMatch = line.match(/^(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:await\s+)?(page\.[a-zA-Z0-9_$.()]+\([^;]*\)(?:\.[a-zA-Z0-9_$.()]+\([^;]*\))*)/);
		if (varAssignMatch) {
			const varName = varAssignMatch[1];
			const expr = varAssignMatch[2];
			locatorVariables.set(varName, expr);
			continue;
		}

		// Resolusi baris yang menggunakan nama variabel
		let resolvedLine = line;
		for (const [varName, expr] of locatorVariables.entries()) {
			const varUsagePattern = new RegExp(`\\b${varName}\\.([a-zA-Z0-9_]+)\\(`, 'g');
			if (varUsagePattern.test(resolvedLine)) {
				resolvedLine = resolvedLine.replace(
					new RegExp(`\\b${varName}\\.`, 'g'),
					`${expr}.`
				);
			}
		}

		// 1. page.goto('...')
		const gotoMatch = resolvedLine.match(/page\.goto\(\s*['"`]([^'"`]+)['"`]\s*.*\)/);
		if (gotoMatch) {
			steps.push({
				action: 'goto',
				url: gotoMatch[1],
				description: `Navigasi ke ${gotoMatch[1]}`
			});
			continue;
		}

		// 2. page.fill / locator.fill / getBy*.fill
		const fillMatch =
			resolvedLine.match(/page\.fill\(\s*['"`]([^'"`]+)['"`]\s*,\s*['"`]([^'"`]*)['"`]\s*\)/) ||
			resolvedLine.match(/page\.locator\(\s*['"`]([^'"`]+)['"`]\s*\)(?:\.[a-zA-Z0-9_]+\([^)]*\))*\.fill\(\s*['"`]([^'"`]*)['"`]\s*\)/) ||
			resolvedLine.match(/page\.getByPlaceholder\(\s*(?:['"`]([^'"`]+)['"`]|\/([^/]+)\/[a-z]*)\s*\)(?:\.[a-zA-Z0-9_]+\([^)]*\))*\.fill\(\s*['"`]([^'"`]*)['"`]\s*\)/) ||
			resolvedLine.match(/page\.getByLabel\(\s*(?:['"`]([^'"`]+)['"`]|\/([^/]+)\/[a-z]*)\s*\)(?:\.[a-zA-Z0-9_]+\([^)]*\))*\.fill\(\s*['"`]([^'"`]*)['"`]\s*\)/) ||
			resolvedLine.match(/page\.getByTestId\(\s*['"`]([^'"`]+)['"`]\s*\)(?:\.[a-zA-Z0-9_]+\([^)]*\))*\.fill\(\s*['"`]([^'"`]*)['"`]\s*\)/) ||
			resolvedLine.match(/page\.getByRole\(\s*['"`](?:textbox|searchbox|combobox)['"`]\s*(?:,\s*\{[^}]*name:\s*(?:['"`]([^'"`]+)['"`]|\/([^/]+)\/[a-z]*)[^}]*\})?\s*\)(?:\.[a-zA-Z0-9_]+\([^)]*\))*\.fill\(\s*['"`]([^'"`]*)['"`]\s*\)/) ||
			resolvedLine.match(/page\.type\(\s*['"`]([^'"`]+)['"`]\s*,\s*['"`]([^'"`]*)['"`]\s*\)/);

		if (fillMatch) {
			const selector = fillMatch[1] || fillMatch[2] || '';
			const val = fillMatch[3] !== undefined ? fillMatch[3] : (fillMatch[2] !== undefined && !fillMatch[3] && fillMatch[1] ? fillMatch[2] : (fillMatch[1] ? '' : ''));
			const cleanValue = fillMatch[fillMatch.length - 1] ?? val ?? '';
			steps.push({
				action: 'fill',
				selector,
				value: cleanValue,
				description: `Mengisi field "${selector}" dengan "${cleanValue}"`
			});
			continue;
		}

		// 3. page.click / locator.click / getByRole.click / getByTestId / getByLabel / getByText / getByTitle / getByPlaceholder
		const roleClickMatch = resolvedLine.match(/page\.getByRole\(\s*['"`]([^'"`]+)['"`]\s*(?:,\s*\{[^}]*name:\s*(?:['"`]([^'"`]+)['"`]|\/([^/]+)\/[a-z]*)[^}]*\})?\s*\)(?:\.[a-zA-Z0-9_]+\([^)]*\))*\.click\(/);
		if (roleClickMatch) {
			const role = roleClickMatch[1];
			const name = roleClickMatch[2] || roleClickMatch[3] || '';
			const selector = name ? `role:${role}:${name}` : `role:${role}`;
			steps.push({
				action: 'click',
				selector,
				description: `Mengklik elemen role ${role}${name ? ` "${name}"` : ''}`
			});
			continue;
		}

		const testIdClickMatch = resolvedLine.match(/page\.getByTestId\(\s*['"`]([^'"`]+)['"`]\s*\)(?:\.[a-zA-Z0-9_]+\([^)]*\))*\.click\(/);
		if (testIdClickMatch) {
			const testId = testIdClickMatch[1];
			steps.push({
				action: 'click',
				selector: `[data-testid="${testId}"]`,
				description: `Mengklik elemen test-id "${testId}"`
			});
			continue;
		}

		const labelClickMatch = resolvedLine.match(/page\.getByLabel\(\s*(?:['"`]([^'"`]+)['"`]|\/([^/]+)\/[a-z]*)\s*\)(?:\.[a-zA-Z0-9_]+\([^)]*\))*\.click\(/);
		if (labelClickMatch) {
			const label = labelClickMatch[1] || labelClickMatch[2];
			steps.push({
				action: 'click',
				selector: `label:${label}`,
				description: `Mengklik elemen label "${label}"`
			});
			continue;
		}

		const textClickMatch = resolvedLine.match(/page\.getByText\(\s*(?:['"`]([^'"`]+)['"`]|\/([^/]+)\/[a-z]*)\s*\)(?:\.[a-zA-Z0-9_]+\([^)]*\))*\.click\(/);
		if (textClickMatch) {
			const txt = textClickMatch[1] || textClickMatch[2];
			steps.push({
				action: 'click',
				selector: `text=${txt}`,
				description: `Mengklik elemen berteks "${txt}"`
			});
			continue;
		}

		const placeholderClickMatch = resolvedLine.match(/page\.getByPlaceholder\(\s*(?:['"`]([^'"`]+)['"`]|\/([^/]+)\/[a-z]*)\s*\)(?:\.[a-zA-Z0-9_]+\([^)]*\))*\.click\(/);
		if (placeholderClickMatch) {
			const ph = placeholderClickMatch[1] || placeholderClickMatch[2];
			steps.push({
				action: 'click',
				selector: `placeholder:${ph}`,
				description: `Mengklik elemen placeholder "${ph}"`
			});
			continue;
		}

		const titleClickMatch = resolvedLine.match(/page\.getByTitle\(\s*(?:['"`]([^'"`]+)['"`]|\/([^/]+)\/[a-z]*)\s*\)(?:\.[a-zA-Z0-9_]+\([^)]*\))*\.click\(/);
		if (titleClickMatch) {
			const tit = titleClickMatch[1] || titleClickMatch[2];
			steps.push({
				action: 'click',
				selector: `[title="${tit}"]`,
				description: `Mengklik elemen title "${tit}"`
			});
			continue;
		}

		const locatorClickMatch =
			resolvedLine.match(/page\.click\(\s*['"`]([^'"`]+)['"`]\s*.*\)/) ||
			resolvedLine.match(/page\.locator\(\s*['"`]([^'"`]+)['"`]\s*\)(?:\.[a-zA-Z0-9_]+\([^)]*\))*\.click\(/);
		if (locatorClickMatch) {
			const sel = locatorClickMatch[1];
			steps.push({
				action: 'click',
				selector: sel,
				description: `Mengklik elemen "${sel}"`
			});
			continue;
		}

		// 4. page.selectOption('selector', 'value')
		const selectMatch =
			resolvedLine.match(/page\.selectOption\(\s*['"`]([^'"`]+)['"`]\s*,\s*['"`]([^'"`]*)['"`]\s*\)/) ||
			resolvedLine.match(/page\.locator\(\s*['"`]([^'"`]+)['"`]\s*\)(?:\.[a-zA-Z0-9_]+\([^)]*\))*\.selectOption\(\s*['"`]([^'"`]*)['"`]\s*\)/);
		if (selectMatch) {
			steps.push({
				action: 'select',
				selector: selectMatch[1],
				value: selectMatch[2],
				description: `Memilih opsi "${selectMatch[2]}" pada "${selectMatch[1]}"`
			});
			continue;
		}

		// 5. page.check('selector') / uncheck
		const checkMatch =
			resolvedLine.match(/page\.(check|uncheck)\(\s*['"`]([^'"`]+)['"`]\s*\)/) ||
			resolvedLine.match(/page\.locator\(\s*['"`]([^'"`]+)['"`]\s*\)(?:\.[a-zA-Z0-9_]+\([^)]*\))*\.(check|uncheck)\(/);
		if (checkMatch) {
			const actionType = (checkMatch[1] || checkMatch[2]) === 'check' ? 'check' : 'uncheck';
			const selector = checkMatch[1] && checkMatch[2] ? checkMatch[2] : checkMatch[1];
			steps.push({
				action: 'check',
				selector: selector || 'input[type="checkbox"]',
				value: actionType === 'check' ? 'true' : 'false',
				description: `${actionType === 'check' ? 'Centang' : 'Hapus centang'} "${selector}"`
			});
			continue;
		}

		// 6. page.waitForTimeout(ms) / page.waitForSelector('...')
		const waitTimeoutMatch = resolvedLine.match(/page\.waitForTimeout\(\s*(\d+)\s*\)/);
		if (waitTimeoutMatch) {
			steps.push({
				action: 'wait',
				timeoutMs: Number(waitTimeoutMatch[1]),
				description: `Menunggu jeda ${waitTimeoutMatch[1]}ms`
			});
			continue;
		}
		const waitSelectorMatch = resolvedLine.match(/page\.waitForSelector\(\s*['"`]([^'"`]+)['"`]\s*.*\)/);
		if (waitSelectorMatch) {
			steps.push({
				action: 'wait',
				selector: waitSelectorMatch[1],
				timeoutMs: 1500,
				description: `Menunggu elemen "${waitSelectorMatch[1]}" tampil`
			});
			continue;
		}

		// 7. page.press('selector', 'Enter')
		const pressMatch =
			resolvedLine.match(/page\.press\(\s*['"`]([^'"`]+)['"`]\s*,\s*['"`]([^'"`]+)['"`]\s*\)/) ||
			resolvedLine.match(/page\.locator\(\s*['"`]([^'"`]+)['"`]\s*\)(?:\.[a-zA-Z0-9_]+\([^)]*\))*\.press\(\s*['"`]([^'"`]+)['"`]\s*\)/);
		if (pressMatch) {
			steps.push({
				action: 'press',
				selector: pressMatch[1],
				key: pressMatch[2],
				description: `Menekan tombol "${pressMatch[2]}" pada "${pressMatch[1]}"`
			});
			continue;
		}
	}

	if (steps.length === 0 && fallbackUrl) {
		steps.push({ action: 'goto', url: fallbackUrl, description: `Navigasi ke ${fallbackUrl}` });
	}

	return steps;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForTabLoaded = (tabId: number, timeoutMs = 15000): Promise<void> =>
	new Promise((resolve) => {
		if (typeof chrome === 'undefined' || !chrome.tabs?.onUpdated) {
			resolve();
			return;
		}

		let timer: ReturnType<typeof setTimeout>;

		const listener = (id: number, info: chrome.tabs.OnUpdatedInfo) => {
			if (id === tabId && info.status === 'complete') {
				chrome.tabs.onUpdated.removeListener(listener);
				clearTimeout(timer);
				resolve();
			}
		};

		chrome.tabs.onUpdated.addListener(listener);
		timer = setTimeout(() => {
			try {
				chrome.tabs.onUpdated.removeListener(listener);
			} catch {
				// Ignore
			}
			resolve();
		}, timeoutMs);
	});

/**
 * Pulihkan Cookie & LocalStorage pada tab replay agar autentikasi sesi langsung aktif.
 */
async function restoreStorageState(tabId: number, storageState?: any): Promise<void> {
	if (!storageState || typeof chrome === 'undefined') return;

	// 1. Pulihkan Cookies
	if (Array.isArray(storageState.cookies) && chrome.cookies?.set) {
		for (const cookie of storageState.cookies) {
			try {
				const cookieUrl = `http${cookie.secure ? 's' : ''}://${(cookie.domain || '').replace(/^\./, '')}${cookie.path || '/'}`;
				await chrome.cookies.set({
					url: cookieUrl,
					name: cookie.name,
					value: cookie.value,
					domain: cookie.domain,
					path: cookie.path,
					secure: cookie.secure,
					httpOnly: cookie.httpOnly,
					sameSite: cookie.sameSite as any,
					expirationDate: cookie.expires && cookie.expires > 0 ? cookie.expires : undefined
				}).catch(() => {});
			} catch {
				// Abaikan kegagalan cookie individual
			}
		}
	}

	// 2. Pulihkan LocalStorage
	if (Array.isArray(storageState.origins) && chrome.scripting?.executeScript) {
		for (const originEntry of storageState.origins) {
			if (Array.isArray(originEntry.localStorage) && originEntry.localStorage.length > 0) {
				try {
					await chrome.scripting.executeScript({
						target: { tabId },
						func: (items: Array<{ name: string; value: string }>) => {
							for (const item of items) {
								try {
									localStorage.setItem(item.name, item.value);
								} catch {
									// Ignore
								}
							}
						},
						args: [originEntry.localStorage]
					}).catch(() => {});
				} catch {
					// Ignore
				}
			}
		}
	}
}

/**
 * Suntikkan overlay HUD dan spotlight visual interaksi ke dalam halaman tab yang sedang di-replay.
 */
async function updateReplayOverlay(
	tabId: number,
	options: {
		stepNo: number;
		totalSteps: number;
		title: string;
		actionDesc: string;
		targetSelector?: string;
		actionType?: string;
		isFinished?: boolean;
		isError?: boolean;
		errorMessage?: string;
	}
): Promise<void> {
	if (typeof chrome === 'undefined' || !chrome.scripting?.executeScript) return;
	try {
		await chrome.scripting.executeScript({
			target: { tabId },
			func: (opts: typeof options) => {
				const HUD_ID = 'knitto-replay-hud';
				let hud = document.getElementById(HUD_ID);

				if (!hud) {
					hud = document.createElement('div');
					hud.id = HUD_ID;
					hud.style.position = 'fixed';
					hud.style.top = '16px';
					hud.style.right = '16px';
					hud.style.zIndex = '2147483647';
					hud.style.maxWidth = '360px';
					hud.style.width = 'calc(100vw - 32px)';
					hud.style.background = '#0f172a';
					hud.style.color = '#ffffff';
					hud.style.borderRadius = '12px';
					hud.style.padding = '12px 16px';
					hud.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.1)';
					hud.style.fontFamily = 'system-ui, -apple-system, sans-serif';
					hud.style.fontSize = '12px';
					hud.style.lineHeight = '1.4';
					hud.style.transition = 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
					hud.style.pointerEvents = 'none';
					document.body.appendChild(hud);
				}

				const progressPercent = Math.min(100, Math.round((opts.stepNo / Math.max(1, opts.totalSteps)) * 100));

				let statusBg = '#2F3574';
				let statusIcon = '▶️';
				let statusText = `Langkah ${opts.stepNo} dari ${opts.totalSteps}`;

				if (opts.isFinished) {
					statusBg = '#16a34a';
					statusIcon = '✅';
					statusText = 'Replay Selesai Sukses';
				} else if (opts.isError) {
					statusBg = '#dc2626';
					statusIcon = '❌';
					statusText = 'Replay Terhenti (Gagal)';
				}

				hud.innerHTML = `
					<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
						<div style="display:flex; align-items:center; gap:6px;">
							<span style="font-size:14px;">${statusIcon}</span>
							<strong style="font-size:13px; color:#f8fafc; letter-spacing:0.3px;">Knitto QA Re-run Live</strong>
						</div>
						<span style="background:${statusBg}; color:#ffffff; font-size:10px; font-weight:700; padding:2px 8px; border-radius:10px;">
							${statusText}
						</span>
					</div>
					<div style="font-size:12px; font-weight:500; color:#e2e8f0; margin-bottom:8px;">
						${opts.isError ? (opts.errorMessage || 'Terjadi kesalahan') : opts.actionDesc}
					</div>
					<div style="width:100%; height:4px; background:rgba(255,255,255,0.15); border-radius:2px; overflow:hidden;">
						<div style="width:${progressPercent}%; height:100%; background:${opts.isError ? '#ef4444' : opts.isFinished ? '#22c55e' : '#38bdf8'}; transition:width 0.3s ease;"></div>
					</div>
				`;

				if (opts.isFinished) {
					setTimeout(() => {
						try {
							hud?.remove();
							document.querySelectorAll('.knitto-spotlight-box').forEach((el) => el.remove());
						} catch {
							// Ignore
						}
					}, 4000);
				}
			},
			args: [options]
		});
	} catch {
		// Scripting may fail on restricted pages
	}
}

/**
 * Eksekusi satu langkah interaksi langsung di dalam DOM browser dengan React Synthetic Events & spotlight visual.
 */
async function executeStepInTab(
	tabId: number,
	step: ReplayActionStep,
	valueToUse: string | undefined
): Promise<{ success: boolean; error?: string }> {
	if (typeof chrome === 'undefined' || !chrome.scripting?.executeScript) {
		return { success: true };
	}

	try {
		const [res] = await chrome.scripting.executeScript({
			target: { tabId },
			func: (actionType: string, selector: string, val: string, keyName: string) => {
				const findElement = (sel: string): HTMLElement | null => {
					if (!sel) return null;

					// 1. Format role: "role:button:Kirim" atau "role:button" atau "role:listitem"
					if (sel.startsWith('role:')) {
						const parts = sel.split(':');
						const roleName = parts[1] || '';
						const targetName = (parts[2] || '').toLowerCase();

						const roleElements = Array.from(document.querySelectorAll(`[role="${roleName}"], ${roleName === 'button' ? 'button, input[type="button"], input[type="submit"]' : roleName === 'link' ? 'a' : roleName === 'listitem' ? 'li, [role="listitem"]' : roleName === 'textbox' ? 'input, textarea' : '*'}`));

						for (const el of roleElements) {
							if (!targetName) return el as HTMLElement;
							const text = (el.textContent || '').trim().toLowerCase();
							const aria = (el.getAttribute('aria-label') || '').trim().toLowerCase();
							const inpVal = ((el as HTMLInputElement).value || '').trim().toLowerCase();
							const matches = targetName.includes('|')
								? targetName.split('|').some((p) => text.includes(p) || aria.includes(p) || inpVal.includes(p))
								: (text.includes(targetName) || aria.includes(targetName) || inpVal.includes(targetName));
							if (matches) return el as HTMLElement;
						}
						if (!targetName && roleElements.length > 0) return roleElements[0] as HTMLElement;
					}

					// 2. Format placeholder: "placeholder:Ketik pesan"
					if (sel.startsWith('placeholder:')) {
						const phVal = sel.replace(/^placeholder:/, '').toLowerCase();
						const inputs = Array.from(document.querySelectorAll('input, textarea'));
						for (const inp of inputs) {
							const ph = (inp.getAttribute('placeholder') || '').toLowerCase();
							const matches = phVal.includes('|')
								? phVal.split('|').some((p) => ph.includes(p))
								: ph.includes(phVal);
							if (matches) return inp as HTMLElement;
						}
					}

					// 3. Format label: "label:Nama"
					if (sel.startsWith('label:')) {
						const lblVal = sel.replace(/^label:/, '').toLowerCase();
						const labels = Array.from(document.querySelectorAll('label'));
						for (const lbl of labels) {
							if ((lbl.textContent || '').toLowerCase().includes(lblVal)) {
								const htmlFor = lbl.getAttribute('for');
								if (htmlFor) {
									const linked = document.getElementById(htmlFor);
									if (linked) return linked as HTMLElement;
								}
								const childInput = lbl.querySelector('input, select, textarea');
								if (childInput) return childInput as HTMLElement;
							}
						}
					}

					// 4. Format text=...
					if (sel.startsWith('text=')) {
						const targetText = sel.replace(/^text=/, '').trim().toLowerCase();
						const elements = Array.from(document.querySelectorAll('button, a, span, label, div, p, [role="button"], [role="tab"], [role="menuitem"], input[type="submit"], input[type="button"]'));
						for (const el of elements) {
							const t = (el.textContent || '').trim().toLowerCase();
							const aria = (el.getAttribute('aria-label') || '').trim().toLowerCase();
							const matches = targetText.includes('|')
								? targetText.split('|').some((p) => t.includes(p) || aria.includes(p))
								: (t === targetText || t.includes(targetText) || aria.includes(targetText));
							if (matches) return el as HTMLElement;
						}
					}

					// 5. Coba querySelector exact (CSS path / data-testid / id / class)
					try {
						const direct = document.querySelector(sel) as HTMLElement | null;
						if (direct) return direct;
					} catch {
						// Ignore
					}

					// 6. Coba cari by placeholder, name, id, data-testid, aria-label
					try {
						const byAttr = document.querySelector(
							`[name="${sel}"], [id="${sel}"], [placeholder="${sel}"], [data-testid="${sel}"], [data-test-id="${sel}"], [data-cy="${sel}"], [aria-label="${sel}"]`
						) as HTMLElement | null;
						if (byAttr) return byAttr;
					} catch {
						// Ignore
					}

					// 7. Cari input lewat teks label terkait
					const labels = Array.from(document.querySelectorAll('label'));
					for (const lbl of labels) {
						if ((lbl.textContent || '').toLowerCase().includes(sel.toLowerCase())) {
							const htmlFor = lbl.getAttribute('for');
							if (htmlFor) {
								const linked = document.getElementById(htmlFor);
								if (linked) return linked as HTMLElement;
							}
							const childInput = lbl.querySelector('input, select, textarea');
							if (childInput) return childInput as HTMLElement;
						}
					}

					// 8. Text partial matching pada elemen yang dapat diklik
					const clickables = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"], a, [role="button"], [role="tab"], [role="menuitem"], li'));
					for (const btn of clickables) {
						const text = (btn.textContent || '').toLowerCase();
						const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
						if (text.includes(sel.toLowerCase()) || aria.includes(sel.toLowerCase())) {
							return btn as HTMLElement;
						}
					}

					// 9. Inputs by placeholder partial match
					const inputs = Array.from(document.querySelectorAll('input, textarea, select'));
					for (const inp of inputs) {
						const ph = inp.getAttribute('placeholder') || '';
						const aria = inp.getAttribute('aria-label') || '';
						const nm = inp.getAttribute('name') || '';
						if (
							(ph && ph.toLowerCase().includes(sel.toLowerCase())) ||
							(aria && aria.toLowerCase().includes(sel.toLowerCase())) ||
							(nm && nm.toLowerCase().includes(sel.toLowerCase()))
						) {
							return inp as HTMLElement;
						}
					}

					// 10. Fallback: jika selector mengarah ke path/svg di dalam button/form, cari button terdekat
					if (sel.includes('button') || sel.includes('svg') || sel.includes('path') || sel.includes('section')) {
						const buttons = Array.from(document.querySelectorAll('button, [role="button"], input[type="submit"]'));
						if (buttons.length > 0) {
							const sendBtn = buttons.find((b) => {
								const t = (b.textContent || '').toLowerCase();
								const a = (b.getAttribute('aria-label') || '').toLowerCase();
								const tit = (b.getAttribute('title') || '').toLowerCase();
								return t.includes('kirim') || t.includes('send') || a.includes('kirim') || a.includes('send') || tit.includes('kirim') || tit.includes('send') || Boolean(b.querySelector('svg'));
							});
							if (sendBtn) return sendBtn as HTMLElement;
						}
					}

					return null;
				};

				const element = findElement(selector);

				if (!element && actionType !== 'wait') {
					return { success: false, error: `Elemen "${selector}" tidak ditemukan di halaman.` };
				}

				if (element) {
					// Spotlight efek pada elemen yang sedang dieksekusi
					element.scrollIntoView({ behavior: 'smooth', block: 'center' });

					// Buat glowing border sementara
					const prevOutline = element.style.outline;
					const prevBoxShadow = element.style.boxShadow;
					element.style.outline = '3px solid #2F3574';
					element.style.boxShadow = '0 0 16px rgba(47, 53, 116, 0.5)';
					setTimeout(() => {
						try {
							element.style.outline = prevOutline;
							element.style.boxShadow = prevBoxShadow;
						} catch {
							// Ignore
						}
					}, 1200);

					if (actionType === 'fill') {
						element.focus();
						const inputEl = element as HTMLInputElement | HTMLTextAreaElement;
						const prototype = Object.getPrototypeOf(inputEl);
						const valueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set
							|| Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
							|| Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;

						if (valueSetter && ('value' in inputEl)) {
							valueSetter.call(inputEl, val);
						} else if ('value' in inputEl) {
							inputEl.value = val;
						} else {
							element.textContent = val;
						}

						element.dispatchEvent(new Event('focus', { bubbles: true }));
						element.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
						element.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
						element.dispatchEvent(new Event('blur', { bubbles: true }));
					} else if (actionType === 'click') {
						const clickable = element.closest('button, a, [role="button"], input[type="submit"], input[type="button"], li') || element;
						(clickable as HTMLElement).focus();
						const rect = (clickable as HTMLElement).getBoundingClientRect();
						const clientX = rect.left + rect.width / 2;
						const clientY = rect.top + rect.height / 2;

						const eventInit: MouseEventInit = { bubbles: true, cancelable: true, view: window, clientX, clientY };
						clickable.dispatchEvent(new PointerEvent('pointerdown', eventInit));
						clickable.dispatchEvent(new MouseEvent('mousedown', eventInit));
						clickable.dispatchEvent(new PointerEvent('pointerup', eventInit));
						clickable.dispatchEvent(new MouseEvent('mouseup', eventInit));
						clickable.dispatchEvent(new MouseEvent('click', eventInit));
						if (typeof (clickable as any).click === 'function') {
							(clickable as any).click();
						}
					} else if (actionType === 'select') {
						element.focus();
						const selectEl = element as HTMLSelectElement;
						if (selectEl.tagName.toLowerCase() === 'select') {
							selectEl.value = val;
							selectEl.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
						}
					} else if (actionType === 'check') {
						const checkEl = element as HTMLInputElement;
						if (checkEl.type === 'checkbox' || checkEl.type === 'radio') {
							checkEl.checked = val === 'true';
							checkEl.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
						}
					} else if (actionType === 'press') {
						element.focus();
						const key = keyName || 'Enter';
						const code = key === 'Enter' ? 'Enter' : key === 'Tab' ? 'Tab' : key === 'Escape' ? 'Escape' : key;
						const keyCode = key === 'Enter' ? 13 : key === 'Tab' ? 9 : key === 'Escape' ? 27 : 0;
						const keyInit: KeyboardEventInit = { key, code, keyCode, which: keyCode, bubbles: true, cancelable: true, view: window };
						element.dispatchEvent(new KeyboardEvent('keydown', keyInit));
						element.dispatchEvent(new KeyboardEvent('keypress', keyInit));
						element.dispatchEvent(new KeyboardEvent('keyup', keyInit));
						if (key === 'Enter' && (element as HTMLInputElement).form) {
							(element as HTMLInputElement).form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
						}
					}
				}

				return { success: true };
			},
			args: [step.action, step.selector || '', valueToUse ?? '', step.key || 'Enter']
		});

		return res?.result ?? { success: true };
	} catch (err) {
		return { success: false, error: (err as Error).message };
	}
}

/**
 * Menjalankan seluruh sekuens langkah replay dalam browser secara nyata & tampak pada tab.
 */
export async function executeReplay(options: ReplayOptions): Promise<ReplayResult> {
	const steps = options.steps && options.steps.length > 0
		? options.steps
		: parseScriptToReplaySteps(options.script || '', options.targetUrl);

	if (steps.length === 0) {
		return {
			success: false,
			totalSteps: 0,
			executedSteps: 0,
			error: 'Tidak ada langkah untuk dijalankan.'
		};
	}

	let targetTabId: number | undefined;
	let groupId: number | undefined;

	try {
		const initialUrl = steps.find((s) => s.action === 'goto')?.url || options.targetUrl || 'about:blank';

		if (options.mode === 'tabGroup' && typeof chrome !== 'undefined' && chrome.tabs?.create) {
			// Buat tab baru dan aktifkan (active: true) agar tester dapat melihat eksekusinya secara langsung
			const newTab = await chrome.tabs.create({ url: initialUrl, active: true });
			targetTabId = newTab.id;

			if (targetTabId && chrome.tabs.group) {
				try {
					groupId = await chrome.tabs.group({ tabIds: [targetTabId] });
					if (groupId && chrome.tabGroups?.update) {
						await chrome.tabGroups.update(groupId, {
							title: `Knitto Replay - ${options.testCaseNo}`,
							color: 'blue'
						});
					}
				} catch {
					// Tab grouping might fail if tabs are across windows
				}
			}
		} else if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
			const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
			targetTabId = active?.id;
		}

		if (!targetTabId) {
			return {
				success: false,
				totalSteps: steps.length,
				executedSteps: 0,
				error: 'Tab target tidak ditemukan.'
			};
		}

		// Pastikan tab aktif dan window terfokus ke depan
		try {
			if (typeof chrome !== 'undefined' && chrome.tabs?.update) {
				await chrome.tabs.update(targetTabId, { active: true });
			}
			if (typeof chrome !== 'undefined' && chrome.windows?.getCurrent) {
				const currentWin = await chrome.windows.getCurrent();
				if (currentWin.id) {
					await chrome.windows.update(currentWin.id, { focused: true });
				}
			}
		} catch {
			// Ignore
		}

		// Pulihkan status login / storageState jika ada
		if (options.storageState && targetTabId) {
			await restoreStorageState(targetTabId, options.storageState);
		}

		await waitForTabLoaded(targetTabId);

		if (options.onTabReady && targetTabId) {
			try {
				await options.onTabReady(targetTabId);
			} catch {
				// Abaikan jika video capture gagal dimulai
			}
		}

		const pacingDelay = options.stepDelayMs ?? (options.speedMode === 'fast' ? 300 : options.speedMode === 'slow' ? 1500 : 800);

		let executed = 0;
		for (let i = 0; i < steps.length; i++) {
			const step = steps[i];
			const stepNo = i + 1;
			const total = steps.length;

			// Tentukan nilai override jika ada
			let valueToUse = step.value;
			if (step.selector && options.parameterOverrides[step.selector] !== undefined) {
				valueToUse = options.parameterOverrides[step.selector];
			}

			const actionDesc = step.description || `${step.action.toUpperCase()} ${step.selector || step.url || ''}`;

			await updateReplayOverlay(targetTabId, {
				stepNo,
				totalSteps: total,
				title: options.testCaseNo,
				actionDesc,
				targetSelector: step.selector,
				actionType: step.action
			});

			if (step.action === 'goto') {
				const dest = step.url || initialUrl;
				if (typeof chrome !== 'undefined' && chrome.tabs?.update) {
					await chrome.tabs.update(targetTabId, { url: dest });
					await waitForTabLoaded(targetTabId);
					await sleep(Math.max(600, pacingDelay));
				}
			} else if (step.action === 'wait') {
				const duration = Math.min(step.timeoutMs || 1000, 5000);
				await sleep(duration);
			} else {
				// Coba eksekusi aksi (fill, click, select, check, press) dengan retry singkat jika elemen belum render
				let stepSuccess = false;
				let lastErr: string | undefined;

				for (let attempt = 0; attempt < 8; attempt++) {
					const res = await executeStepInTab(targetTabId, step, valueToUse);
					if (res.success) {
						stepSuccess = true;
						break;
					}
					lastErr = res.error;
					await sleep(350);
				}

				if (!stepSuccess && lastErr) {
					await updateReplayOverlay(targetTabId, {
						stepNo,
						totalSteps: total,
						title: options.testCaseNo,
						actionDesc: `Gagal pada langkah ${stepNo}: ${actionDesc}`,
						isError: true,
						errorMessage: lastErr
					});
					throw new Error(lastErr);
				}

				await sleep(pacingDelay);
			}

			executed++;
		}

		await updateReplayOverlay(targetTabId, {
			stepNo: steps.length,
			totalSteps: steps.length,
			title: options.testCaseNo,
			actionDesc: `Semua ${executed} langkah replay berhasil dijalankan.`,
			isFinished: true
		});

		return {
			success: true,
			totalSteps: steps.length,
			executedSteps: executed,
			tabId: targetTabId,
			groupId
		};
	} catch (err) {
		const message = (err as Error).message || 'Terjadi kesalahan saat replay';
		if (targetTabId) {
			await updateReplayOverlay(targetTabId, {
				stepNo: 0,
				totalSteps: steps.length,
				title: options.testCaseNo,
				actionDesc: `Replay Gagal`,
				isError: true,
				errorMessage: message
			});
		}
		return {
			success: false,
			totalSteps: steps.length,
			executedSteps: 0,
			error: message,
			tabId: targetTabId,
			groupId
		};
	}
}


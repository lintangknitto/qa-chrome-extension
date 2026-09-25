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
}

export interface ReplayResult {
	success: boolean;
	totalSteps: number;
	executedSteps: number;
	error?: string;
	tabId?: number;
	groupId?: number;
}

/**
 * Mengurai baris script Playwright menjadi sekuens aksi replay browser yang komprehensif.
 */
export function parseScriptToReplaySteps(script: string, fallbackUrl?: string): ReplayActionStep[] {
	if (!script) {
		return fallbackUrl ? [{ action: 'goto', url: fallbackUrl, description: `Navigasi ke ${fallbackUrl}` }] : [];
	}

	const steps: ReplayActionStep[] = [];
	const lines = script.split('\n');

	for (const rawLine of lines) {
		const line = rawLine.trim().replace(/^await\s+/, '');
		if (!line || line.startsWith('//') || line.startsWith('/*') || line.startsWith('*')) continue;

		// 1. page.goto('...')
		const gotoMatch = line.match(/page\.goto\(\s*['"`]([^'"`]+)['"`]\s*.*\)/);
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
			line.match(/page\.fill\(\s*['"`]([^'"`]+)['"`]\s*,\s*['"`]([^'"`]*)['"`]\s*\)/) ||
			line.match(/page\.locator\(\s*['"`]([^'"`]+)['"`]\s*\)(?:\.[a-zA-Z0-9_]+\(\))*\.fill\(\s*['"`]([^'"`]*)['"`]\s*\)/) ||
			line.match(/page\.getByPlaceholder\(\s*['"`]([^'"`]+)['"`]\s*\)(?:\.[a-zA-Z0-9_]+\(\))*\.fill\(\s*['"`]([^'"`]*)['"`]\s*\)/) ||
			line.match(/page\.getByLabel\(\s*['"`]([^'"`]+)['"`]\s*\)(?:\.[a-zA-Z0-9_]+\(\))*\.fill\(\s*['"`]([^'"`]*)['"`]\s*\)/) ||
			line.match(/page\.getByTestId\(\s*['"`]([^'"`]+)['"`]\s*\)(?:\.[a-zA-Z0-9_]+\(\))*\.fill\(\s*['"`]([^'"`]*)['"`]\s*\)/) ||
			line.match(/page\.getByRole\(\s*['"`](?:textbox|searchbox|combobox)['"`]\s*(?:,\s*\{[^}]*name:\s*['"`]([^'"`]+)['"`][^}]*\})?\s*\)\.fill\(\s*['"`]([^'"`]*)['"`]\s*\)/) ||
			line.match(/page\.type\(\s*['"`]([^'"`]+)['"`]\s*,\s*['"`]([^'"`]*)['"`]\s*\)/);

		if (fillMatch) {
			const selector = fillMatch[1];
			const value = fillMatch[2] ?? '';
			steps.push({
				action: 'fill',
				selector,
				value,
				description: `Mengisi field "${selector}" dengan "${value}"`
			});
			continue;
		}

		// 3. page.click / locator.click / getByRole.click / getByText.click
		const clickMatch =
			line.match(/page\.click\(\s*['"`]([^'"`]+)['"`]\s*.*\)/) ||
			line.match(/page\.locator\(\s*['"`]([^'"`]+)['"`]\s*\)(?:\.[a-zA-Z0-9_]+\(\))*\.click\(/) ||
			line.match(/page\.getByRole\(\s*['"`]([^'"`]+)['"`]\s*(?:,\s*\{[^}]*name:\s*['"`]([^'"`]+)['"`][^}]*\})?\s*\)\.click\(/) ||
			line.match(/page\.getByText\(\s*['"`]([^'"`]+)['"`]\s*\)(?:\.[a-zA-Z0-9_]+\(\))*\.click\(/) ||
			line.match(/page\.getByTestId\(\s*['"`]([^'"`]+)['"`]\s*\)(?:\.[a-zA-Z0-9_]+\(\))*\.click\(/) ||
			line.match(/page\.getByPlaceholder\(\s*['"`]([^'"`]+)['"`]\s*\)(?:\.[a-zA-Z0-9_]+\(\))*\.click\(/);

		if (clickMatch) {
			const selector = clickMatch[2] ? `text=${clickMatch[2]}` : clickMatch[1];
			steps.push({
				action: 'click',
				selector,
				description: `Mengklik elemen "${selector}"`
			});
			continue;
		}

		// 4. page.selectOption('selector', 'value')
		const selectMatch =
			line.match(/page\.selectOption\(\s*['"`]([^'"`]+)['"`]\s*,\s*['"`]([^'"`]*)['"`]\s*\)/) ||
			line.match(/page\.locator\(\s*['"`]([^'"`]+)['"`]\s*\)\.selectOption\(\s*['"`]([^'"`]*)['"`]\s*\)/);
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
			line.match(/page\.(check|uncheck)\(\s*['"`]([^'"`]+)['"`]\s*\)/) ||
			line.match(/page\.locator\(\s*['"`]([^'"`]+)['"`]\s*\)\.(check|uncheck)\(/);
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
		const waitTimeoutMatch = line.match(/page\.waitForTimeout\(\s*(\d+)\s*\)/);
		if (waitTimeoutMatch) {
			steps.push({
				action: 'wait',
				timeoutMs: Number(waitTimeoutMatch[1]),
				description: `Menunggu jeda ${waitTimeoutMatch[1]}ms`
			});
			continue;
		}
		const waitSelectorMatch = line.match(/page\.waitForSelector\(\s*['"`]([^'"`]+)['"`]\s*.*\)/);
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
			line.match(/page\.press\(\s*['"`]([^'"`]+)['"`]\s*,\s*['"`]([^'"`]+)['"`]\s*\)/) ||
			line.match(/page\.locator\(\s*['"`]([^'"`]+)['"`]\s*\)\.press\(\s*['"`]([^'"`]+)['"`]\s*\)/);
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
 * Eksekusi satu langkah interaksi langsung di dalam DOM browser dengan retry dan spotlight visual.
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

					// 1. Coba exact selector
					try {
						const direct = document.querySelector(sel) as HTMLElement | null;
						if (direct) return direct;
					} catch {
						// Selector mungkin format teks atau mengandung Playwright pseudo-selector
					}

					// 2. Format Playwright :has-text("...") atau :text("...")
					const hasTextMatch = sel.match(/^([a-zA-Z0-9_\-\.#*]*):(?:has-)?text\(\s*['"`]([^'"`]+)['"`]\s*\)$/i);
					if (hasTextMatch) {
						const tagSel = hasTextMatch[1] || '*';
						const textVal = hasTextMatch[2].trim().toLowerCase();
						const matchedEls = Array.from(document.querySelectorAll(tagSel));
						for (const el of matchedEls) {
							if ((el.textContent || '').trim().toLowerCase().includes(textVal)) {
								return el as HTMLElement;
							}
						}
					}

					// 3. Format text=...
					if (sel.startsWith('text=')) {
						const targetText = sel.replace(/^text=/, '').trim().toLowerCase();
						const elements = Array.from(document.querySelectorAll('button, a, span, label, div, p, [role="button"], input[type="submit"], input[type="button"]'));
						for (const el of elements) {
							const t = (el.textContent || '').trim().toLowerCase();
							if (t === targetText || t.includes(targetText)) {
								return el as HTMLElement;
							}
						}
					}

					// 4. Coba cari by placeholder, name, id, data-testid, aria-label
					try {
						const byAttr = document.querySelector(
							`[name="${sel}"], [id="${sel}"], [placeholder="${sel}"], [data-testid="${sel}"], [aria-label="${sel}"]`
						) as HTMLElement | null;
						if (byAttr) return byAttr;
					} catch {
						// Ignore
					}

					// 5. Cari input lewat teks label terkait
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

					// 6. Text partial matching for buttons & links
					const clickables = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"], a, [role="button"], [role="tab"], [role="menuitem"]'));
					for (const btn of clickables) {
						if ((btn.textContent || '').toLowerCase().includes(sel.toLowerCase())) {
							return btn as HTMLElement;
						}
					}

					// 7. Inputs by placeholder partial match
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
						if ('value' in inputEl) {
							inputEl.value = val;
						} else {
							element.textContent = val;
						}
						element.dispatchEvent(new Event('focus', { bubbles: true }));
						element.dispatchEvent(new Event('input', { bubbles: true }));
						element.dispatchEvent(new Event('change', { bubbles: true }));
						element.dispatchEvent(new Event('blur', { bubbles: true }));
					} else if (actionType === 'click') {
						element.focus();
						element.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true }));
						element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
						element.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, cancelable: true }));
						element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
						element.click();
					} else if (actionType === 'select') {
						element.focus();
						const selectEl = element as HTMLSelectElement;
						if (selectEl.tagName.toLowerCase() === 'select') {
							selectEl.value = val;
							selectEl.dispatchEvent(new Event('change', { bubbles: true }));
						}
					} else if (actionType === 'check') {
						const checkEl = element as HTMLInputElement;
						if (checkEl.type === 'checkbox' || checkEl.type === 'radio') {
							checkEl.checked = val === 'true';
							checkEl.dispatchEvent(new Event('change', { bubbles: true }));
						}
					} else if (actionType === 'press') {
						element.focus();
						element.dispatchEvent(new KeyboardEvent('keydown', { key: keyName, bubbles: true }));
						element.dispatchEvent(new KeyboardEvent('keypress', { key: keyName, bubbles: true }));
						element.dispatchEvent(new KeyboardEvent('keyup', { key: keyName, bubbles: true }));
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

		// Fokuskan window browser
		try {
			if (typeof chrome !== 'undefined' && chrome.windows?.getCurrent) {
				const currentWin = await chrome.windows.getCurrent();
				if (currentWin.id) {
					await chrome.windows.update(currentWin.id, { focused: true });
				}
			}
		} catch {
			// Ignore
		}

		await waitForTabLoaded(targetTabId);

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
					await sleep(600);
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

				await sleep(450);
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


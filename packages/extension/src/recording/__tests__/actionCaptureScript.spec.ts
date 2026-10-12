// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { ACTION_BINDING_NAME, actionCaptureScript } from '../actionCaptureScript';

type Sent = { action: string; element: Record<string, any> };

describe('actionCaptureScript', () => {
	let sent: Sent[];

	beforeEach(() => {
		sent = [];
		delete (window as any).__qaRecorderInstalled;
		delete (window as any).__knittoLocator;
		(window as any)[ACTION_BINDING_NAME] = (payload: string) => sent.push(JSON.parse(payload));
		document.body.innerHTML = `
			<form>
				<label for="nama">Nama Customer</label><input id="nama" name="nama">
				<button type="button" id="del" aria-label="Hapus"><svg><path id="icon"></path></svg></button>
				<button type="submit">Simpan</button><span>Simpan</span>
			</form>
			<div tabindex="0" class="card-action"><span id="inner">Detail</span></div>`;
		// eslint-disable-next-line no-new-func
		new Function(actionCaptureScript())();
	});

	it('klik ikon di dalam button tercatat sebagai button dengan role+name unik', () => {
		document.getElementById('icon')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(sent[0].action).toBe('click');
		expect((sent[0] as any).pageUrl).toBe(location.href);
		expect(sent[0].element.tagName).toBe('BUTTON');
		expect(sent[0].element.role).toBe('button');
		expect(sent[0].element.candidates[0]).toEqual({
			spec: { kind: 'role', role: 'button', name: 'Hapus', exact: true },
			count: 1,
			fragile: false
		});
	});

	it('tidak naik ke pembungkus [tabindex]/[class*=action]', () => {
		document.getElementById('inner')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(sent[0].element.tagName).toBe('SPAN');
	});

	it('input tercatat dengan label exact sebagai kandidat', async () => {
		const input = document.getElementById('nama') as HTMLInputElement;
		input.value = 'PT Maju';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		input.dispatchEvent(new Event('change', { bubbles: true }));
		const input_ = sent.find((s) => s.action === 'input')!;
		expect(input_.element.role).toBe('textbox');
		expect(input_.element.candidates.map((c: any) => c.spec.kind)).toContain('label');
		expect(input_.element.candidates.find((c: any) => c.spec.kind === 'role').spec).toEqual({
			kind: 'role', role: 'textbox', name: 'Nama Customer', exact: true
		});
	});
});

describe('actionCaptureScript aksi lanjutan', () => {
	let sent: Array<Record<string, any>>;
	type Win = Window & typeof globalThis;

	/** Window JSDOM baru per test agar listener capture tidak menumpuk antar test. */
	const freshWindow = (html: string): Win =>
		new JSDOM(`<!doctype html><body>${html}</body>`, { runScripts: 'outside-only', url: 'https://app.example.test/' }).window as unknown as Win;

	const install = (win: Win) => {
		(win as any)[ACTION_BINDING_NAME] = (payload: string) => sent.push(JSON.parse(payload));
		(win as any).eval(actionCaptureScript());
	};

	beforeEach(() => {
		sent = [];
	});

	it('double-click tercatat sekali sebagai dblclick (klik kedua diabaikan)', () => {
		const w = freshWindow('<button id="b">Edit</button>');
		install(w);
		const b = w.document.getElementById('b')!;
		b.dispatchEvent(new w.MouseEvent('click', { bubbles: true, detail: 1 }));
		b.dispatchEvent(new w.MouseEvent('click', { bubbles: true, detail: 2 }));
		b.dispatchEvent(new w.MouseEvent('dblclick', { bubbles: true, detail: 2 }));
		expect(sent.map((s) => s.action)).toEqual(['click', 'dblclick']);
	});

	it('klik, dblclick, dan klik kanan menyertakan koordinat dan ukuran viewport', () => {
		const w = freshWindow('<canvas id="c"></canvas>');
		install(w);
		const c = w.document.getElementById('c')!;
		c.dispatchEvent(new w.MouseEvent('click', { bubbles: true, detail: 1, clientX: 120.6, clientY: 45 }));
		c.dispatchEvent(new w.MouseEvent('dblclick', { bubbles: true, detail: 2, clientX: 10, clientY: 20 }));
		c.dispatchEvent(new w.MouseEvent('contextmenu', { bubbles: true, clientX: 30, clientY: 40 }));
		expect(sent.map((s) => [s.action, s.client_x, s.client_y])).toEqual([
			['click', 121, 45],
			['dblclick', 10, 20],
			['rightclick', 30, 40]
		]);
		expect(sent[0].viewport_w).toBe(w.innerWidth);
		expect(sent[0].viewport_h).toBe(w.innerHeight);
	});

	it('keyboard: shortcut modifier, tombol navigasi, Enter; ketikan biasa dan Ctrl+C/V/X/A tidak direkam', () => {
		const w = freshWindow('<textarea id="t" placeholder="Pesan"></textarea><input id="i" value="isi">');
		install(w);
		const t = w.document.getElementById('t')!;
		const press = (target: EventTarget, key: string, mods: KeyboardEventInit = {}) =>
			target.dispatchEvent(new w.KeyboardEvent('keydown', { key, bubbles: true, ...mods }));
		press(t, 'h');
		press(t, 'Shift');
		press(t, 'v', { ctrlKey: true });
		press(t, 'A', { metaKey: true, shiftKey: false });
		press(t, 'Enter', { ctrlKey: true });
		press(t, 'ArrowDown');
		press(t, 'k', { altKey: true, shiftKey: true });
		press(w.document.body, 'k', { altKey: true, shiftKey: true });
		press(w.document.body, 'PageDown');
		press(w.document.body, ' ', { ctrlKey: true });
		expect(sent.map((s) => [s.key, s.modifiers, s.element?.tagName ?? null])).toEqual([
			['Enter', ['Control'], 'TEXTAREA'],
			['ArrowDown', [], 'TEXTAREA'],
			['k', ['Alt', 'Shift'], null],
			['PageDown', [], null],
			['Space', ['Control'], null]
		]);
	});

	it('ketikan AltGr/Alt/Option dan semua tombol di field password tidak direkam', () => {
		const w = freshWindow('<input id="p" type="password"><input id="i"><div id="row" tabindex="0">Baris</div>');
		install(w);
		const press = (id: string, key: string, mods: KeyboardEventInit = {}) =>
			w.document.getElementById(id)!.dispatchEvent(new w.KeyboardEvent('keydown', { key, bubbles: true, ...mods }));
		press('p', '@', { ctrlKey: true, altKey: true });
		press('p', 'Enter');
		press('p', 's', { ctrlKey: true });
		press('i', '@', { ctrlKey: true, altKey: true });
		press('i', '™', { altKey: true });
		press('row', '€', { ctrlKey: true, altKey: true });
		press('i', 's', { ctrlKey: true });
		expect(sent.map((s) => [s.key, s.modifiers])).toEqual([['s', ['Control']]]);
	});

	it('Backspace/Delete hanya direkam di luar field teks atau saat field kosong', () => {
		const w = freshWindow('<textarea id="t"></textarea><input id="i" value="isi"><div id="row" tabindex="0">Baris</div>');
		install(w);
		const press = (id: string, key: string) => w.document.getElementById(id)!.dispatchEvent(new w.KeyboardEvent('keydown', { key, bubbles: true }));
		press('i', 'Backspace');
		press('t', 'Backspace');
		press('row', 'Delete');
		expect(sent.map((s) => [s.key, s.element.tagName])).toEqual([
			['Backspace', 'TEXTAREA'],
			['Delete', 'DIV']
		]);
	});

	it('klik kanan tercatat sebagai rightclick', () => {
		const w = freshWindow('<div id="row" role="row">Baris</div>');
		install(w);
		w.document.getElementById('row')!.dispatchEvent(new w.MouseEvent('contextmenu', { bubbles: true }));
		expect(sent[0].action).toBe('rightclick');
	});

	it('hover dicatat hanya bila elemen yang diklik muncul setelah hover', async () => {
		const w = freshWindow('<nav><button id="menu" aria-haspopup="true">Laporan</button></nav><button id="lain">Lain</button>');
		install(w);
		w.document.getElementById('menu')!.dispatchEvent(new w.MouseEvent('mouseover', { bubbles: true }));
		const item = w.document.createElement('a');
		item.href = '#';
		item.textContent = 'Penjualan';
		w.document.body.appendChild(item);
		await new Promise((resolve) => setTimeout(resolve, 0));
		item.dispatchEvent(new w.MouseEvent('click', { bubbles: true, detail: 1 }));
		expect(sent.map((s) => s.action)).toEqual(['hover', 'click']);
		expect(sent[0].element.candidates[0].spec).toEqual({ kind: 'role', role: 'button', name: 'Laporan', exact: true });

		sent = [];
		w.document.getElementById('lain')!.dispatchEvent(new w.MouseEvent('mouseover', { bubbles: true }));
		w.document.getElementById('lain')!.dispatchEvent(new w.MouseEvent('click', { bubbles: true, detail: 1 }));
		expect(sent.map((s) => s.action)).toEqual(['click']);
	});

	it('drag & drop HTML5 mencatat sumber dan target', () => {
		const w = freshWindow('<div id="card" draggable="true" data-testid="card-1">Kartu</div><section id="col" data-testid="kolom-selesai">Selesai</section>');
		install(w);
		w.document.getElementById('card')!.dispatchEvent(new w.Event('dragstart', { bubbles: true }));
		w.document.getElementById('col')!.dispatchEvent(new w.Event('drop', { bubbles: true }));
		expect(sent[0].action).toBe('drag');
		expect(sent[0].element.testId).toBe('card-1');
		expect(sent[0].target.testId).toBe('kolom-selesai');
	});

	it('upload file mengirim event langsung lalu isi file (base64) lewat upload_data', async () => {
		const w = freshWindow('<label for="f">Lampiran</label><input id="f" type="file">');
		install(w);
		const input = w.document.getElementById('f') as HTMLInputElement;
		const files = [
			new w.File(['halo'], 'invoice.pdf', { type: 'application/pdf' }),
			new w.File([new Uint8Array(1)], 'tanpa-tipe.bin')
		];
		Object.defineProperty(input, 'files', { value: files });
		input.dispatchEvent(new w.Event('change', { bubbles: true }));

		expect(sent[0]).toMatchObject({ action: 'upload', files: ['invoice.pdf', 'tanpa-tipe.bin'] });
		const ref = (sent[0] as any).upload_ref;
		expect(ref).toMatch(/^upload-/);

		// Satu file per pesan, berurutan; `last` menandai file terakhir.
		await vi.waitFor(() => expect(sent[2]).toBeTruthy());
		expect(sent[1]).toMatchObject({
			action: 'upload_data',
			upload_ref: ref,
			files: [{ name: 'invoice.pdf', type: 'application/pdf', size: 4, data: 'aGFsbw==' }],
			last: false
		});
		expect(sent[2]).toMatchObject({
			action: 'upload_data',
			upload_ref: ref,
			files: [{ name: 'tanpa-tipe.bin', type: 'application/octet-stream', size: 1, data: 'AA==' }],
			last: true
		});
	});

	it('batas total per langkah: file sesudah total terlampaui dikirim stored:false', async () => {
		const w = freshWindow('<input id="f" type="file" multiple>');
		(w as any)[ACTION_BINDING_NAME] = (payload: string) => sent.push(JSON.parse(payload));
		(w as any).eval(actionCaptureScript({ uploadMaxBytes: 10, uploadMaxTotalBytes: 7 }));
		const input = w.document.getElementById('f') as HTMLInputElement;
		const files = ['abc', 'defg', 'hi', 'j'].map((text, i) => new w.File([text], `f${i}.txt`, { type: 'text/plain' }));
		Object.defineProperty(input, 'files', { value: files });
		input.dispatchEvent(new w.Event('change', { bubbles: true }));

		await vi.waitFor(() => expect(sent).toHaveLength(5));
		const data = sent.slice(1).map((m) => m.files[0]);
		// 3 + 4 = 7 (pas batas); 'hi' (2) melebihi sisa 0 → stored:false; 'j' juga.
		expect(data.map((f) => f.stored === false ? 'skip' : f.data)).toEqual(['YWJj', 'ZGVmZw==', 'skip', 'skip']);
		expect(sent.slice(1).map((m) => m.last)).toEqual([false, false, false, true]);
	});

	it('input file dikosongkan tetap mengirim upload_data terakhir agar referensi dibersihkan', async () => {
		const w = freshWindow('<input id="f" type="file">');
		install(w);
		const input = w.document.getElementById('f') as HTMLInputElement;
		Object.defineProperty(input, 'files', { value: [] });
		input.dispatchEvent(new w.Event('change', { bubbles: true }));
		await vi.waitFor(() => expect(sent[1]).toMatchObject({ action: 'upload_data', files: [], last: true }));
	});

	it('file di atas batas dikirim stored:false tanpa isi, maksimal 20 file', async () => {
		const w = freshWindow('<input id="f" type="file" multiple>');
		(w as any)[ACTION_BINDING_NAME] = (payload: string) => sent.push(JSON.parse(payload));
		(w as any).eval(actionCaptureScript({ uploadMaxBytes: 2 }));
		const input = w.document.getElementById('f') as HTMLInputElement;
		const files = Array.from({ length: 25 }, (_, i) => new w.File(['abc'], `f${i}.txt`, { type: 'text/plain' }));
		Object.defineProperty(input, 'files', { value: files });
		input.dispatchEvent(new w.Event('change', { bubbles: true }));

		expect((sent[0] as any).files).toHaveLength(20);
		await vi.waitFor(() => expect(sent[1]).toBeTruthy());
		expect((sent[1] as any).files[0]).toEqual({ name: 'f0.txt', type: 'text/plain', size: 3, stored: false });
	});

	it('klik & change di dalam open shadow DOM memakai elemen asli', () => {
		const w = freshWindow('<my-widget id="host"></my-widget>');
		install(w);
		const root = w.document.getElementById('host')!.attachShadow({ mode: 'open' });
		root.innerHTML = '<button id="kirim">Kirim</button><label>Aktif <input id="cb" type="checkbox"></label>';
		root.getElementById('kirim')!.dispatchEvent(new w.MouseEvent('click', { bubbles: true, composed: true, detail: 1 }));
		expect(sent[0].element.tagName).toBe('BUTTON');
		expect(sent[0].element.candidates[0]).toMatchObject({ spec: { kind: 'role', role: 'button', name: 'Kirim', exact: true }, count: 1 });

		const cb = root.getElementById('cb')!;
		cb.dispatchEvent(new w.FocusEvent('focusin', { bubbles: true, composed: true }));
		cb.dispatchEvent(new w.Event('change', { bubbles: true }));
		expect(sent[1]).toMatchObject({ action: 'change', element: { tagName: 'INPUT', accessibleName: 'Aktif' } });
	});

	it('centang checkbox tidak menghasilkan aksi input (value "on")', async () => {
		const w = freshWindow('<label>Kirim Ekspres <input id="cb" type="checkbox"></label>');
		install(w);
		const cb = w.document.getElementById('cb') as HTMLInputElement;
		cb.dispatchEvent(new w.MouseEvent('click', { bubbles: true, detail: 1 }));
		cb.dispatchEvent(new w.Event('input', { bubbles: true }));
		cb.dispatchEvent(new w.Event('change', { bubbles: true }));
		await new Promise((resolve) => setTimeout(resolve, 350));
		expect(sent.map((s) => s.action)).not.toContain('input');
		expect(sent.map((s) => s.action)).toContain('change');
	});

	it('klik di dalam shadow root FAB extension tidak terekam', () => {
		const w = freshWindow('<div id="qa-knitto-fab-host"></div><button id="app">Simpan</button>');
		install(w);
		const root = w.document.getElementById('qa-knitto-fab-host')!.attachShadow({ mode: 'open' });
		root.innerHTML = '<div><button id="end">End Recording</button></div>';
		root.getElementById('end')!.dispatchEvent(new w.MouseEvent('click', { bubbles: true, composed: true, detail: 1 }));
		w.document.getElementById('app')!.dispatchEvent(new w.MouseEvent('click', { bubbles: true, detail: 1 }));
		expect(sent).toHaveLength(1);
		expect(sent[0].element.accessibleName).toBe('Simpan');
	});

	const waitScroll = () => new Promise((resolve) => setTimeout(resolve, 350));
	const setPos = (target: object, props: Record<string, number>) => {
		for (const [key, value] of Object.entries(props)) Object.defineProperty(target, key, { value, configurable: true, writable: true });
	};

	it('scroll window oleh tester (wheel) dikirim sekali setelah debounce dengan posisi akhir dan delta', async () => {
		const w = freshWindow('<p>isi</p>');
		install(w);
		w.dispatchEvent(new w.Event('wheel'));
		setPos(w, { scrollX: 0, scrollY: 200 });
		w.document.dispatchEvent(new w.Event('scroll'));
		setPos(w, { scrollY: 600 });
		w.document.dispatchEvent(new w.Event('scroll'));
		expect(sent).toHaveLength(0);
		await waitScroll();
		expect(sent).toEqual([expect.objectContaining({ action: 'scroll', element: null, scroll_x: 0, scroll_y: 600, delta_x: 0, delta_y: 600 })]);
	});

	it('scroll container mencatat elemen container; scroll kedua memakai posisi sebelumnya sebagai awal', async () => {
		const w = freshWindow('<div id="list" data-testid="chat-list" style="overflow:auto"><p>a</p></div>');
		install(w);
		const list = w.document.getElementById('list')!;
		w.dispatchEvent(new w.Event('wheel'));
		setPos(list, { scrollTop: 300, scrollLeft: 0 });
		list.dispatchEvent(new w.Event('scroll'));
		await waitScroll();
		w.dispatchEvent(new w.Event('wheel'));
		setPos(list, { scrollTop: 500 });
		list.dispatchEvent(new w.Event('scroll'));
		await waitScroll();
		expect(sent.map((s) => [s.action, s.element?.testId, s.scroll_y, s.delta_y])).toEqual([
			['scroll', 'chat-list', 300, 300],
			['scroll', 'chat-list', 500, 200]
		]);
	});

	it('scroll tanpa aksi tester sebelumnya (scroll dari script) diabaikan', async () => {
		const w = freshWindow('<div id="list"></div>');
		install(w);
		const list = w.document.getElementById('list')!;
		setPos(list, { scrollTop: 400 });
		list.dispatchEvent(new w.Event('scroll'));
		await waitScroll();
		expect(sent).toHaveLength(0);
	});

	it('klik saat scroll masih ditunda mengirim scroll lebih dulu', () => {
		const w = freshWindow('<button id="b">Muat lagi</button>');
		install(w);
		w.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'PageDown' }));
		setPos(w, { scrollY: 800 });
		w.document.dispatchEvent(new w.Event('scroll'));
		w.document.getElementById('b')!.dispatchEvent(new w.MouseEvent('click', { bubbles: true, detail: 1 }));
		expect(sent.map((s) => s.action)).toEqual(['scroll', 'click']);
	});

	it('scroll di iframe same-origin membawa rantai frame', async () => {
		const w = freshWindow('<iframe id="chat" title="Live Chat"></iframe>');
		install(w);
		const child = (w.document.getElementById('chat') as HTMLIFrameElement).contentWindow as Win;
		child.document.body.innerHTML = '<div id="msgs" data-testid="pesan"></div>';
		install(child);
		const msgs = child.document.getElementById('msgs')!;
		child.dispatchEvent(new child.Event('wheel'));
		setPos(msgs, { scrollTop: 120 });
		msgs.dispatchEvent(new child.Event('scroll'));
		await waitScroll();
		expect(sent[0]).toMatchObject({ action: 'scroll', scroll_y: 120, element: { testId: 'pesan' } });
		expect(sent[0].frames[0][0].spec).toEqual({ kind: 'title', value: 'Live Chat', exact: true });
	});

	it('aksi di iframe same-origin membawa kandidat locator <iframe> pemilik', () => {
		const w = freshWindow('<iframe id="chat" title="Live Chat"></iframe>');
		install(w);
		const frame = w.document.getElementById('chat') as HTMLIFrameElement;
		const child = frame.contentWindow as Win;
		child.document.body.innerHTML = '<button id="x">Kirim</button>';
		install(child);
		child.document.getElementById('x')!.dispatchEvent(new child.MouseEvent('click', { bubbles: true, detail: 1 }));
		expect(sent[0].frames).toHaveLength(1);
		expect(sent[0].frames[0][0].spec).toEqual({ kind: 'title', value: 'Live Chat', exact: true });
	});
});

// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
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

	it('upload file mencatat nama file saja', () => {
		const w = freshWindow('<label for="f">Lampiran</label><input id="f" type="file">');
		install(w);
		const input = w.document.getElementById('f') as HTMLInputElement;
		Object.defineProperty(input, 'files', { value: [{ name: 'invoice.pdf' }, { name: 'foto.png' }] });
		input.dispatchEvent(new w.Event('change', { bubbles: true }));
		expect(sent[0]).toMatchObject({ action: 'upload', files: ['invoice.pdf', 'foto.png'] });
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

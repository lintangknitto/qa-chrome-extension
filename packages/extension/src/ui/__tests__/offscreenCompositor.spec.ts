import { describe, expect, it, vi } from 'vitest';
import { drawTabLabel, FrameCompositor, tabLabel } from '../offscreenCompositor';

describe('FrameCompositor', () => {
	it('hanya frame tab aktif yang digambar; frame tab lain di-cache', () => {
		const compositor = new FrameCompositor();
		compositor.setActiveTab(1, 'A');
		expect(compositor.addFrame(1, 'a1')).toBe(true);
		expect(compositor.addFrame(2, 'b1')).toBe(false);
		expect(compositor.addFrame(2, 'b2')).toBe(false);
	});

	it('pindah tab mengembalikan frame cache terakhir tab baru', () => {
		const compositor = new FrameCompositor();
		compositor.setActiveTab(1, 'A');
		compositor.addFrame(1, 'a1');
		compositor.addFrame(2, 'b1');
		compositor.addFrame(2, 'b2');
		expect(compositor.setActiveTab(2, 'B')).toBe('b2');
		expect(compositor.addFrame(1, 'a2')).toBe(false);
		expect(compositor.addFrame(2, 'b3')).toBe(true);
		expect(compositor.setActiveTab(3, 'C')).toBeNull();
		expect(compositor.label).toBe('C');
	});

	it('frame sebelum tab aktif ditetapkan memakai tab pertama; clear mereset semuanya', () => {
		const compositor = new FrameCompositor();
		expect(compositor.addFrame(5, 'x')).toBe(true);
		expect(compositor.activeTabId).toBe(5);
		compositor.clear();
		expect(compositor.activeTabId).toBeNull();
		expect(compositor.setActiveTab(5, '')).toBeNull();
	});
});

describe('tabLabel', () => {
	it('memakai judul, atau host bila judul kosong', () => {
		expect(tabLabel(' Checkout ', 'https://app.example/x')).toBe('Checkout');
		expect(tabLabel('', 'https://pay.example.com/x?y=1')).toBe('pay.example.com');
		expect(tabLabel(null, 'bukan url')).toBe('');
	});
});

describe('drawTabLabel', () => {
	const mockCtx = () => ({
		save: vi.fn(),
		restore: vi.fn(),
		fillRect: vi.fn(),
		fillText: vi.fn(),
		measureText: vi.fn(() => ({ width: 100 }) as TextMetrics),
		fillStyle: '' as string | CanvasGradient | CanvasPattern,
		font: '',
		textBaseline: 'alphabetic' as CanvasTextBaseline
	});

	it('menggambar latar dan teks label di pojok kiri atas', () => {
		const ctx = mockCtx();
		drawTabLabel(ctx, 'Bayar', 1280);
		expect(ctx.fillRect).toHaveBeenCalledWith(8, 8, 116, 32);
		expect(ctx.fillText).toHaveBeenCalledWith('Bayar', 16, 16, 100);
		expect(ctx.save).toHaveBeenCalled();
		expect(ctx.restore).toHaveBeenCalled();
	});

	it('tidak menggambar apa pun untuk label kosong dan memotong label panjang', () => {
		const ctx = mockCtx();
		drawTabLabel(ctx, '', 1280);
		expect(ctx.fillText).not.toHaveBeenCalled();
		drawTabLabel(ctx, 'x'.repeat(200), 1280);
		expect((ctx.fillText.mock.calls[0][0] as string).length).toBe(80);
	});
});

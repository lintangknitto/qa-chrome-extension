import { describe, expect, it, vi } from 'vitest';
import { ListenerRegistry } from '../listenerRegistry';

describe('ListenerRegistry', () => {
	it('mencatat jumlah listener terdaftar', () => {
		const registry = new ListenerRegistry();
		registry.add(() => {});
		registry.add(() => {});
		expect(registry.size).toBe(2);
	});

	it('memanggil seluruh remover saat removeAll', () => {
		const registry = new ListenerRegistry();
		const first = vi.fn();
		const second = vi.fn();
		registry.add(first);
		registry.add(second);

		registry.removeAll();

		expect(first).toHaveBeenCalledTimes(1);
		expect(second).toHaveBeenCalledTimes(1);
		expect(registry.size).toBe(0);
	});

	it('tidak memanggil remover dua kali saat removeAll diulang', () => {
		const registry = new ListenerRegistry();
		const remover = vi.fn();
		registry.add(remover);

		registry.removeAll();
		registry.removeAll();

		expect(remover).toHaveBeenCalledTimes(1);
	});

	it('tetap melanjutkan pembersihan walau satu remover gagal', () => {
		const registry = new ListenerRegistry();
		const failing = vi.fn(() => {
			throw new Error('gagal');
		});
		const succeeding = vi.fn();
		registry.add(failing);
		registry.add(succeeding);

		expect(() => registry.removeAll()).not.toThrow();
		expect(succeeding).toHaveBeenCalledTimes(1);
		expect(registry.size).toBe(0);
	});
});

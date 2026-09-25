// @vitest-environment jsdom
// Matrix: A-01 to A-05
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EmptyStateTestCase } from '../views/EmptyStateTestCase';

describe('EmptyStateTestCase', () => {
	beforeEach(() => {
		(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
		vi.clearAllMocks();
	});

	afterEach(() => {
		cleanup();
	});

	// A-01
	it('menampilkan heading dan subtitle empty state', () => {
		render(<EmptyStateTestCase onUseTemplate={vi.fn()} onUseCustom={vi.fn()} />);
		expect(screen.getByText('Belum ada test case di project ini')).toBeTruthy();
		expect(screen.getByText(/Mulai dengan memilih cara pengisian/i)).toBeTruthy();
	});

	// A-02
	it('menampilkan dua card CTA: Template Sistem dan Struktur Sendiri', () => {
		render(<EmptyStateTestCase onUseTemplate={vi.fn()} onUseCustom={vi.fn()} />);
		expect(screen.getByText('Template Sistem')).toBeTruthy();
		expect(screen.getByText('Struktur Sendiri')).toBeTruthy();
	});

	// A-03
	it('klik card Template Sistem memanggil onUseTemplate', () => {
		const onUseTemplate = vi.fn();
		render(<EmptyStateTestCase onUseTemplate={onUseTemplate} onUseCustom={vi.fn()} />);
		fireEvent.click(screen.getByText('Template Sistem'));
		expect(onUseTemplate).toHaveBeenCalledTimes(1);
	});

	// A-04
	it('klik card Struktur Sendiri memanggil onUseCustom', () => {
		const onUseCustom = vi.fn();
		render(<EmptyStateTestCase onUseTemplate={vi.fn()} onUseCustom={onUseCustom} />);
		fireEvent.click(screen.getByText('Struktur Sendiri'));
		expect(onUseCustom).toHaveBeenCalledTimes(1);
	});

	// A-05
	it('kedua card adalah elemen button yang accessible (type=button)', () => {
		render(<EmptyStateTestCase onUseTemplate={vi.fn()} onUseCustom={vi.fn()} />);
		const buttons = screen.getAllByRole('button');
		// Both CTA cards are <button type="button">
		const types = buttons.map((b) => (b as HTMLButtonElement).type);
		expect(types.every((t) => t === 'button')).toBe(true);
		// At least 2 buttons (Template + Custom)
		expect(buttons.length).toBeGreaterThanOrEqual(2);
	});
});

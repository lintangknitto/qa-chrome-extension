// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Combobox, type ComboboxOption } from '../components/Combobox';

describe('Combobox (Searchable Select Component)', () => {
	beforeEach(() => {
		(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
		vi.clearAllMocks();
	});

	afterEach(() => {
		cleanup();
	});

	const mockOptions: ComboboxOption[] = [
		{ value: 1, label: 'Knitto ERP Portal', code: 'knitto-erp' },
		{ value: 2, label: 'Knitto Mobile Apps', code: 'knitto-mobile' },
		{ value: 3, label: 'Fabric Inventory System', code: 'fabric-inv' }
	];

	it('menampilkan trigger dengan placeholder saat value kosong', () => {
		render(
			<Combobox
				label="Pilih Project"
				placeholder="Pilih project..."
				value=""
				options={mockOptions}
				onChange={vi.fn()}
			/>
		);

		const trigger = screen.getByRole('button', { name: 'Pilih Project' });
		expect(within(trigger).getByText('Pilih project...')).toBeTruthy();
		expect(screen.getByText('Pilih Project')).toBeTruthy();
	});

	it('menampilkan label dan code dari option yang dipilih', () => {
		render(
			<Combobox
				label="Pilih Project"
				placeholder="Pilih project..."
				value={2}
				options={mockOptions}
				onChange={vi.fn()}
			/>
		);

		const trigger = screen.getByRole('button', { name: 'Pilih Project' });
		expect(within(trigger).getByText('Knitto Mobile Apps')).toBeTruthy();
		expect(within(trigger).getByText('knitto-mobile')).toBeTruthy();
	});

	it('klik trigger membuka popover dan menampilkan semua opsi', () => {
		render(
			<Combobox
				placeholder="Pilih project..."
				value=""
				options={mockOptions}
				onChange={vi.fn()}
			/>
		);

		// Popover belum muncul
		expect(screen.queryByRole('dialog')).toBeNull();

		// Klik trigger
		const trigger = screen.getByRole('button', { name: /Pilih project/ });
		fireEvent.click(trigger);

		// Popover muncul
		expect(screen.getByRole('dialog')).toBeTruthy();
		expect(screen.getByPlaceholderText('Cari...')).toBeTruthy();

		const listbox = screen.getByRole('listbox');
		expect(within(listbox).getByText('Knitto ERP Portal')).toBeTruthy();
		expect(within(listbox).getByText('Knitto Mobile Apps')).toBeTruthy();
		expect(within(listbox).getByText('Fabric Inventory System')).toBeTruthy();
	});

	it('mengetik pada search input memfilter daftar opsi secara real-time', () => {
		render(
			<Combobox
				placeholder="Pilih project..."
				searchPlaceholder="Cari project..."
				value=""
				options={mockOptions}
				onChange={vi.fn()}
			/>
		);

		fireEvent.click(screen.getByRole('button', { name: /Pilih project/ }));

		const searchInput = screen.getByPlaceholderText('Cari project...');
		fireEvent.change(searchInput, { target: { value: 'Inventory' } });

		const listbox = screen.getByRole('listbox');
		// Opsi yang cocok tampil
		expect(within(listbox).getByText('Fabric Inventory System')).toBeTruthy();

		// Opsi yang tidak cocok tidak tampil di listbox
		expect(within(listbox).queryByText('Knitto ERP Portal')).toBeNull();
		expect(within(listbox).queryByText('Knitto Mobile Apps')).toBeNull();
	});

	it('mencocokkan pencarian berdasarkan code project', () => {
		render(
			<Combobox
				placeholder="Pilih project..."
				searchPlaceholder="Cari project..."
				value=""
				options={mockOptions}
				onChange={vi.fn()}
			/>
		);

		fireEvent.click(screen.getByRole('button', { name: /Pilih project/ }));

		const searchInput = screen.getByPlaceholderText('Cari project...');
		fireEvent.change(searchInput, { target: { value: 'knitto-erp' } });

		const listbox = screen.getByRole('listbox');
		expect(within(listbox).getByText('Knitto ERP Portal')).toBeTruthy();
		expect(within(listbox).queryByText('Fabric Inventory System')).toBeNull();
	});

	it('menampilkan empty message saat pencarian tidak menemukan hasil', () => {
		render(
			<Combobox
				placeholder="Pilih project..."
				emptyMessage="Project tidak ditemukan"
				value=""
				options={mockOptions}
				onChange={vi.fn()}
			/>
		);

		fireEvent.click(screen.getByRole('button', { name: /Pilih project/ }));

		const searchInput = screen.getByPlaceholderText('Cari...');
		fireEvent.change(searchInput, { target: { value: 'NonExistent' } });

		expect(screen.getByText('Project tidak ditemukan')).toBeTruthy();
	});

	it('klik opsi memanggil onChange dengan value opsi dan menutup popover', () => {
		const onChange = vi.fn();
		render(
			<Combobox
				placeholder="Pilih project..."
				value=""
				options={mockOptions}
				onChange={onChange}
			/>
		);

		fireEvent.click(screen.getByRole('button', { name: /Pilih project/ }));
		const listbox = screen.getByRole('listbox');
		fireEvent.click(within(listbox).getByText('Knitto ERP Portal'));

		expect(onChange).toHaveBeenCalledWith(1);
		expect(screen.queryByRole('dialog')).toBeNull();
	});

	it('tombol clear pada search input menghapus teks pencarian', () => {
		render(
			<Combobox
				placeholder="Pilih project..."
				value=""
				options={mockOptions}
				onChange={vi.fn()}
			/>
		);

		fireEvent.click(screen.getByRole('button', { name: /Pilih project/ }));

		const searchInput = screen.getByPlaceholderText('Cari...');
		fireEvent.change(searchInput, { target: { value: 'Inventory' } });
		const listbox = screen.getByRole('listbox');
		expect(within(listbox).queryByText('Knitto ERP Portal')).toBeNull();

		// Klik clear
		const clearBtn = screen.getByRole('button', { name: 'Hapus pencarian' });
		fireEvent.click(clearBtn);

		// Semua opsi muncul kembali
		expect(within(listbox).getByText('Knitto ERP Portal')).toBeTruthy();
		expect(within(listbox).getByText('Fabric Inventory System')).toBeTruthy();
	});

	it('navigasi keyboard: ArrowDown, ArrowUp, dan Enter memilih opsi', () => {
		const onChange = vi.fn();
		render(
			<Combobox
				placeholder="Pilih project..."
				value=""
				options={mockOptions}
				onChange={onChange}
			/>
		);

		// Buka via Enter pada wrapper
		const wrapper = document.querySelector('.k-combobox-wrapper')!;
		fireEvent.keyDown(wrapper, { key: 'Enter' });
		expect(screen.getByRole('dialog')).toBeTruthy();

		// ArrowDown ke item pertama (Knitto ERP Portal)
		fireEvent.keyDown(wrapper, { key: 'ArrowDown' });
		// ArrowDown ke item kedua (Knitto Mobile Apps)
		fireEvent.keyDown(wrapper, { key: 'ArrowDown' });

		// Tekan Enter untuk memilih
		fireEvent.keyDown(wrapper, { key: 'Enter' });
		expect(onChange).toHaveBeenCalledWith(2);
		expect(screen.queryByRole('dialog')).toBeNull();
	});

	it('Escape key menutup popover Combobox', () => {
		render(
			<Combobox
				placeholder="Pilih project..."
				value=""
				options={mockOptions}
				onChange={vi.fn()}
			/>
		);

		fireEvent.click(screen.getByRole('button', { name: /Pilih project/ }));
		expect(screen.getByRole('dialog')).toBeTruthy();

		const wrapper = document.querySelector('.k-combobox-wrapper')!;
		fireEvent.keyDown(wrapper, { key: 'Escape' });
		expect(screen.queryByRole('dialog')).toBeNull();
	});

	it('click outside menutup popover', () => {
		render(
			<div>
				<div data-testid="outside">Luar</div>
				<Combobox
					placeholder="Pilih project..."
					value=""
					options={mockOptions}
					onChange={vi.fn()}
				/>
			</div>
		);

		fireEvent.click(screen.getByRole('button', { name: /Pilih project/ }));
		expect(screen.getByRole('dialog')).toBeTruthy();

		fireEvent.mouseDown(screen.getByTestId('outside'));
		expect(screen.queryByRole('dialog')).toBeNull();
	});
});

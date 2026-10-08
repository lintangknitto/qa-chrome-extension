// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProgramView } from '../views/ProgramView';
import type { RecordingApiClient, ProgramItem } from '../../../recording/apiClient';
import type { StoredUser } from '../../../recording/tokenStore';

describe('ProgramView', () => {
	const mockCurrentUser: StoredUser = {
		id_user: 1,
		username: 'superadmin',
		nama: 'Super Admin',
		role: 'SUPERADMIN',
		is_active: 1
	};

	const mockPrograms: ProgramItem[] = [
		{
			id_program: 1,
			name: 'Knitto Portal',
			code: 'knitto-portal',
			description: 'Portal E-Commerce Knitto',
			base_url: 'https://staging.portal.knitto.id',
			repo_url: 'https://github.com/knittotextile/knitto-portal',
			project_count: 3,
			is_active: true,
			created_by_user_id: 1
		},
		{
			id_program: 2,
			name: 'Knitto ERP',
			code: 'knitto-erp',
			description: 'ERP Knitto Textile',
			base_url: 'https://staging.erp.knitto.id',
			repo_url: 'https://github.com/knittotextile/knitto-erp',
			project_count: 0,
			is_active: true,
			created_by_user_id: 2
		}
	];

	const mockApi = {
		listPrograms: vi.fn(),
		createProgram: vi.fn(),
		updateProgram: vi.fn(),
		deleteProgram: vi.fn()
	} as unknown as RecordingApiClient;

	const mockShowNotice = vi.fn();

	beforeEach(() => {
		(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
		vi.clearAllMocks();
		(mockApi.listPrograms as ReturnType<typeof vi.fn>).mockResolvedValue({
			items: mockPrograms,
			total: 2
		});
	});

	afterEach(() => {
		cleanup();
	});

	it('merender daftar master program beserta badge dan URL', async () => {
		render(
			<ProgramView
				api={mockApi}
				user={mockCurrentUser}
				showNotice={mockShowNotice}
			/>
		);

		await waitFor(() => {
			expect(screen.getByText('Knitto Portal')).toBeTruthy();
			expect(screen.getByText('knitto-portal')).toBeTruthy();
			expect(screen.getByText('Knitto ERP')).toBeTruthy();
			expect(screen.getByText('knitto-erp')).toBeTruthy();
			expect(screen.getByText('3 Project')).toBeTruthy();
		});

		expect(screen.getByPlaceholderText(/cari nama atau kode program/i)).toBeTruthy();
		expect(screen.getByRole('button', { name: /tambah program/i })).toBeTruthy();
	});

	it('membuka modal Tambah Program dan berhasil mengirim data baru', async () => {
		(mockApi.createProgram as ReturnType<typeof vi.fn>).mockResolvedValue({
			id_program: 3,
			name: 'Knitto POS',
			code: 'knitto-pos',
			is_active: true
		});

		render(
			<ProgramView
				api={mockApi}
				user={mockCurrentUser}
				showNotice={mockShowNotice}
			/>
		);

		await waitFor(() => {
			expect(screen.getByText('Knitto Portal')).toBeTruthy();
		});

		const tambahBtn = screen.getByRole('button', { name: /tambah program/i });
		fireEvent.click(tambahBtn);

		expect(screen.getByText('Tambah Master Program Baru')).toBeTruthy();

		const nameInput = screen.getByPlaceholderText(/contoh: knitto portal/i);
		fireEvent.change(nameInput, { target: { value: 'Knitto POS' } });

		const serviceBtn = screen.getByRole('button', { name: /service \/ backend/i });
		fireEvent.click(serviceBtn);

		const grafanaInput = screen.getByPlaceholderText(/contoh: http:\/\/192.168.20.15:3800/i);
		fireEvent.change(grafanaInput, { target: { value: 'http://192.168.20.15:3800/d/pos-overview' } });

		const submitBtn = screen.getByRole('button', { name: /tambah master program/i });
		fireEvent.click(submitBtn);

		await waitFor(() => {
			expect(mockApi.createProgram).toHaveBeenCalledWith(
				expect.objectContaining({
					name: 'Knitto POS',
					type: 'SERVICE',
					grafana_dashboard_url: 'http://192.168.20.15:3800/d/pos-overview'
				})
			);
			expect(mockShowNotice).toHaveBeenCalledWith(
				expect.stringContaining('berhasil ditambahkan'),
				'success'
			);
		});
	});

	it('membuka modal Konfirmasi Hapus saat tombol Hapus diklik', async () => {
		(mockApi.deleteProgram as ReturnType<typeof vi.fn>).mockResolvedValue({
			success: true,
			action: 'deleted',
			message: 'Program berhasil dihapus.'
		});

		render(
			<ProgramView
				api={mockApi}
				user={mockCurrentUser}
				showNotice={mockShowNotice}
			/>
		);

		await waitFor(() => {
			expect(screen.getByText('Knitto Portal')).toBeTruthy();
		});

		const hapusButtons = screen.getAllByRole('button', { name: /hapus/i });
		fireEvent.click(hapusButtons[0]);

		expect(screen.getByText('Hapus / Nonaktifkan Master Program')).toBeTruthy();

		const confirmBtn = screen.getByRole('button', { name: /ya, hapus program/i });
		fireEvent.click(confirmBtn);

		await waitFor(() => {
			expect(mockApi.deleteProgram).toHaveBeenCalledWith(1);
			expect(mockShowNotice).toHaveBeenCalledWith(
				expect.stringContaining('berhasil dihapus'),
				'success'
			);
		});
	});
});

// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UserManagementView } from '../views/UserManagementView';
import type { RecordingApiClient, UserItem } from '../../../recording/apiClient';
import type { StoredUser } from '../../../recording/tokenStore';

describe('UserManagementView', () => {
	const mockCurrentUser: StoredUser = {
		id_user: 1,
		username: 'superadmin',
		nama: 'Super Admin',
		role: 'SUPERADMIN',
		is_active: 1
	};

	const mockUsers: UserItem[] = [
		{
			id_user: 1,
			nama: 'Super Admin User',
			username: 'superadmin',
			level: 'SUPERADMIN',
			is_active: true,
			assigned_project_ids: []
		},
		{
			id_user: 2,
			nama: 'QA Lead User',
			username: 'qa_user',
			level: 'QA',
			is_active: true,
			assigned_project_ids: [10]
		},
		{
			id_user: 3,
			nama: 'Viewer User',
			username: 'viewer_user',
			level: 'VIEWER',
			is_active: false,
			assigned_project_ids: []
		}
	];

	const mockApi = {
		listUsers: vi.fn(),
		listActiveProjects: vi.fn(),
		deleteUser: vi.fn(),
		getUserDetail: vi.fn()
	} as unknown as RecordingApiClient;

	const mockOnShowToast = vi.fn();

	beforeEach(() => {
		(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
		vi.clearAllMocks();
		(mockApi.listUsers as ReturnType<typeof vi.fn>).mockResolvedValue({
			list: mockUsers,
			total: 3,
			page: 0,
			perPage: 15,
			totalPages: 1
		});
		(mockApi.listActiveProjects as ReturnType<typeof vi.fn>).mockResolvedValue({
			items: [
				{ id_project: 10, name: 'Project 10', code: 'P10' },
				{ id_project: 20, name: 'Project 20', code: 'P20' }
			]
		});
	});

	afterEach(() => {
		cleanup();
	});

	it('renders user list with role badges and filter controls', async () => {
		render(
			<UserManagementView
				api={mockApi}
				currentUser={mockCurrentUser}
				onShowToast={mockOnShowToast}
			/>
		);

		await waitFor(() => {
			expect(screen.getByText('Super Admin User')).toBeTruthy();
			expect(screen.getByText('QA Lead User')).toBeTruthy();
			expect(screen.getByText('Viewer User')).toBeTruthy();
		});

		expect(screen.getByPlaceholderText(/cari nama atau username/i)).toBeTruthy();
		expect(screen.getByRole('button', { name: /tambah user/i })).toBeTruthy();
	});

	it('opens create user modal when clicking Tambah User button', async () => {
		render(
			<UserManagementView
				api={mockApi}
				currentUser={mockCurrentUser}
				onShowToast={mockOnShowToast}
			/>
		);

		await waitFor(() => {
			expect(screen.getByText('Super Admin User')).toBeTruthy();
		});

		const tambahBtn = screen.getByRole('button', { name: /tambah user/i });
		fireEvent.click(tambahBtn);

		await waitFor(() => {
			expect(screen.getByText('Tambah Pengguna Baru')).toBeTruthy();
		});
	});

	it('handles search input and queries API with search term', async () => {
		render(
			<UserManagementView
				api={mockApi}
				currentUser={mockCurrentUser}
				onShowToast={mockOnShowToast}
			/>
		);

		await waitFor(() => {
			expect(screen.getByText('Super Admin User')).toBeTruthy();
		});

		const searchInput = screen.getByPlaceholderText(/cari nama atau username/i);
		fireEvent.change(searchInput, { target: { value: 'qa' } });

		await waitFor(() => {
			expect(mockApi.listUsers).toHaveBeenCalledWith(
				expect.objectContaining({ search: 'qa' })
			);
		});
	});
});

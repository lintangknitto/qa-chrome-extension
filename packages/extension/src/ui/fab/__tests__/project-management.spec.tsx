// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { CreateEditProjectModal } from '../views/CreateEditProjectModal';
import { DeleteProjectModal } from '../views/DeleteProjectModal';
import { ProjectView } from '../views/ProjectView';
import type { RecordingApiClient, RecordingProject } from '../../../recording/apiClient';
import type { StoredUser } from '../../../recording/tokenStore';

describe('Project Management UI & Modals', () => {
	beforeEach(() => {
		(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	});

	afterEach(() => {
		cleanup();
	});

	const sampleProject: RecordingProject = {
		id_project: 1,
		name: 'Knitto E-Commerce',
		code: 'knitto-e-commerce',
		base_url: 'https://knitto.co.id',
		description: 'Katalog kain online',
		is_active: true,
		created_by_user_id: 1
	};

	const adminUser: StoredUser = {
		id_user: 1,
		username: 'admin',
		nama: 'Admin QA',
		level: 'ADMIN',
		is_active: 1
	};

	describe('CreateEditProjectModal', () => {
		it('renders Create mode correctly and submits new project data', async () => {
			const onSave = vi.fn().mockResolvedValue(undefined);
			const onClose = vi.fn();

			render(
				<CreateEditProjectModal
					isOpen={true}
					onClose={onClose}
					project={null}
					onSave={onSave}
				/>
			);

			expect(screen.getByText('Tambah Project Baru')).toBeDefined();
			expect(screen.queryByText(/Kode Project \(Terkunci\)/i)).toBeNull();

			const nameInput = screen.getByLabelText(/Nama Project/i);
			fireEvent.change(nameInput, { target: { value: 'New Mobile App' } });

			const submitBtn = screen.getByRole('button', { name: /Tambah Project/i });
			fireEvent.click(submitBtn);

			await waitFor(() => {
				expect(onSave).toHaveBeenCalledWith({
					name: 'New Mobile App',
					id_program: null,
					program_ids: [],
					base_url: undefined,
					repo_url: undefined,
					description: undefined,
					is_active: true
				});
				expect(onClose).toHaveBeenCalled();
			});
		});

		it('renders Edit mode correctly with locked code badge and submits updated data', async () => {
			const onSave = vi.fn().mockResolvedValue(undefined);
			const onClose = vi.fn();

			render(
				<CreateEditProjectModal
					isOpen={true}
					onClose={onClose}
					project={sampleProject}
					onSave={onSave}
				/>
			);

			expect(screen.getByText('Edit Informasi Project')).toBeDefined();
			expect(screen.getByText('knitto-e-commerce')).toBeDefined();
			expect(screen.getByText(/Kode Project \(Terkunci\)/i)).toBeDefined();

			const nameInput = screen.getByLabelText(/Nama Project/i) as HTMLInputElement;
			expect(nameInput.value).toBe('Knitto E-Commerce');
			fireEvent.change(nameInput, { target: { value: 'Knitto Portal Updated' } });

			const submitBtn = screen.getByRole('button', { name: /Simpan Perubahan/i });
			fireEvent.click(submitBtn);

			await waitFor(() => {
				expect(onSave).toHaveBeenCalledWith({
					name: 'Knitto Portal Updated',
					id_program: null,
					program_ids: [],
					base_url: 'https://knitto.co.id',
					repo_url: undefined,
					description: 'Katalog kain online',
					is_active: true
				});
				expect(onClose).toHaveBeenCalled();
			});
		});

		it('allows selecting multiple master programs and submits program_ids', async () => {
			const onSave = vi.fn().mockResolvedValue(undefined);
			const onClose = vi.fn();

			const programs = [
				{ id_program: 1, name: 'Knitto Portal', code: 'knitto-portal', base_url: 'https://portal.knitto.co.id', is_active: true },
				{ id_program: 2, name: 'Knitto ERP', code: 'knitto-erp', base_url: 'https://erp.knitto.co.id', is_active: true }
			];

			render(
				<CreateEditProjectModal
					isOpen={true}
					onClose={onClose}
					project={null}
					programs={programs}
					onSave={onSave}
				/>
			);

			const nameInput = screen.getByLabelText(/Nama Project/i);
			fireEvent.change(nameInput, { target: { value: 'Sprint 10 Cross Program' } });

			// Check first program
			const prog1Checkbox = screen.getByLabelText(/Knitto Portal/i);
			fireEvent.click(prog1Checkbox);

			// Check second program
			const prog2Checkbox = screen.getByLabelText(/Knitto ERP/i);
			fireEvent.click(prog2Checkbox);

			const submitBtn = screen.getByRole('button', { name: /Tambah Project/i });
			fireEvent.click(submitBtn);

			await waitFor(() => {
				expect(onSave).toHaveBeenCalledWith({
					name: 'Sprint 10 Cross Program',
					id_program: 1,
					program_ids: [1, 2],
					base_url: 'https://portal.knitto.co.id',
					repo_url: undefined,
					description: undefined,
					is_active: true
				});
				expect(onClose).toHaveBeenCalled();
			});
		});
	});

	describe('DeleteProjectModal', () => {
		it('renders project name and warning information, and triggers confirm delete', async () => {
			const onConfirmDelete = vi.fn().mockResolvedValue(undefined);
			const onClose = vi.fn();

			render(
				<DeleteProjectModal
					isOpen={true}
					onClose={onClose}
					project={sampleProject}
					onConfirmDelete={onConfirmDelete}
				/>
			);

			expect(screen.getByText(/Hapus \/ Nonaktifkan Project/i)).toBeDefined();
			expect(screen.getByText(/Knitto E-Commerce/i)).toBeDefined();
			expect(screen.getByText(/Protective Hybrid Deletion/i)).toBeDefined();

			const deleteBtn = screen.getByRole('button', { name: /Ya, Hapus Project/i });
			fireEvent.click(deleteBtn);

			await waitFor(() => {
				expect(onConfirmDelete).toHaveBeenCalledWith(sampleProject);
				expect(onClose).toHaveBeenCalled();
			});
		});
	});

	describe('ProjectView Integration with Actions', () => {
		const mockApi = {
			listTestCases: vi.fn().mockResolvedValue({ items: [], summary: null }),
			listSessions: vi.fn().mockResolvedValue({ items: [] }),
			updateProject: vi.fn().mockResolvedValue(sampleProject),
			deleteProject: vi.fn().mockResolvedValue({ success: true, deleted: true })
		} as unknown as RecordingApiClient;

		it('renders action dropdown button on project card for admin user', () => {
			render(
				<ProjectView
					user={adminUser}
					projects={[sampleProject]}
					api={mockApi}
					canCreateProject={true}
					onRefreshProjects={vi.fn().mockResolvedValue(undefined)}
					onCreateProject={vi.fn().mockResolvedValue(1)}
					onSelectTestCaseForRecording={vi.fn()}
					onShowToast={vi.fn()}
				/>
			);

			const dropdownBtn = screen.getByTitle('Menu Opsi Project');
			expect(dropdownBtn).toBeDefined();

			fireEvent.click(dropdownBtn);
			expect(screen.getByText('Edit Project')).toBeDefined();
			expect(screen.getByText('Hapus Project')).toBeDefined();
		});

		it('renders Edit and Hapus buttons on project detail header when selected', () => {
			render(
				<ProjectView
					user={adminUser}
					projects={[sampleProject]}
					api={mockApi}
					canCreateProject={true}
					onRefreshProjects={vi.fn().mockResolvedValue(undefined)}
					onCreateProject={vi.fn().mockResolvedValue(1)}
					onSelectTestCaseForRecording={vi.fn()}
					onShowToast={vi.fn()}
				/>
			);

			// Open project
			const manageBtn = screen.getByRole('button', { name: /Kelola Test Case →/i });
			fireEvent.click(manageBtn);

			expect(screen.getByTitle('Edit Project')).toBeDefined();
			expect(screen.getByTitle('Hapus / Nonaktifkan Project')).toBeDefined();
		});
	});
});

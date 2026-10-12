// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { CreateEditProgramModal } from '../views/CreateEditProgramModal';
import type { ProgramItem } from '../../../recording/apiClient';

afterEach(cleanup);

const submit = () => fireEvent.click(screen.getByRole('button', { name: /simpan|tambah/i }));

describe('CreateEditProgramModal — branch repo (codebase auto-index)', () => {
	it('buat program: branch dikirim sebagai repo_branch; kosong tidak dikirim; field nonaktif tanpa repo', async () => {
		const onSave = vi.fn().mockResolvedValue(undefined);
		render(<CreateEditProgramModal isOpen onClose={vi.fn()} onSave={onSave} />);

		const branch = screen.getByLabelText(/branch/i) as HTMLInputElement;
		expect(branch.disabled).toBe(true);
		expect(branch.placeholder).toBe('default branch repo');

		fireEvent.change(screen.getByLabelText(/nama/i), { target: { value: 'Knitto API Chat' } });
		fireEvent.change(screen.getByLabelText(/repository github/i), { target: { value: 'https://github.com/knittotextile/knitto-api-chat' } });
		expect(branch.disabled).toBe(false);
		fireEvent.change(branch, { target: { value: ' develop ' } });
		submit();
		await waitFor(() => expect(onSave).toHaveBeenCalled());
		expect(onSave.mock.calls[0][0]).toMatchObject({ repo_url: 'https://github.com/knittotextile/knitto-api-chat', repo_branch: 'develop' });
	});

	it('edit program: branch terisi dari data; dikosongkan → repo_branch "" (kembali ke default branch)', async () => {
		const onSave = vi.fn().mockResolvedValue(undefined);
		const program: ProgramItem = {
			id_program: 2,
			name: 'Knitto API Chat',
			code: 'knitto-api-chat',
			repo_url: 'https://github.com/knittotextile/knitto-api-chat',
			repo_branch: 'develop',
			is_active: true
		};
		render(<CreateEditProgramModal isOpen onClose={vi.fn()} onSave={onSave} program={program} />);

		const branch = screen.getByLabelText(/branch/i) as HTMLInputElement;
		expect(branch.value).toBe('develop');
		fireEvent.change(branch, { target: { value: '' } });
		submit();
		await waitFor(() => expect(onSave).toHaveBeenCalled());
		expect(onSave.mock.calls[0][0]).toMatchObject({ repo_branch: '' });
	});
});

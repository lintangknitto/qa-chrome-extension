// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateEditProjectModal } from '../views/CreateEditProjectModal';
import type { RecordingProject } from '../../../recording/apiClient';

const submit = async () => {
	await act(async () => {
		fireEvent.submit(screen.getByLabelText(/Nama Project/i).closest('form')!);
	});
};

describe('CreateEditProjectModal — metadata format V4', () => {
	beforeEach(() => {
		(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
		vi.clearAllMocks();
	});
	afterEach(() => cleanup());

	it('project baru: seksi metadata tertutup, bisa dibuka lalu diisi dan ikut tersimpan', async () => {
		const onSave = vi.fn().mockResolvedValue(undefined);
		render(<CreateEditProjectModal isOpen onClose={vi.fn()} onSave={onSave} />);

		expect(screen.queryByLabelText('Tester')).toBeNull();
		fireEvent.click(screen.getByRole('button', { name: /Metadata Format Test Case V4/i }));

		fireEvent.change(screen.getByLabelText(/Nama Project/i), { target: { value: 'Chat Widget' } });
		fireEvent.change(screen.getByLabelText('Program Version Release'), { target: { value: 'v2.3.0' } });
		fireEvent.change(screen.getByLabelText('Tester'), { target: { value: ' Hana ' } });
		fireEvent.change(screen.getByLabelText('BRD ID'), { target: { value: 'BRD608' } });
		fireEvent.change(screen.getByLabelText('Link Figma'), { target: { value: 'https://figma.com/file/abc' } });
		await submit();

		expect(onSave).toHaveBeenCalledWith(
			expect.objectContaining({
				name: 'Chat Widget',
				release_version: 'v2.3.0',
				tester_name: 'Hana',
				brd_id: 'BRD608',
				link_figma: 'https://figma.com/file/abc'
			})
		);
		// Field yang tidak diisi tidak dikirim
		expect(onSave.mock.calls[0][0]).not.toHaveProperty('ip_dev');
	});

	it('edit project: metadata terisi otomatis (seksi terbuka) dan bisa dikosongkan', async () => {
		const onSave = vi.fn().mockResolvedValue(undefined);
		const project: RecordingProject = {
			id_project: 1,
			name: 'Chat Widget',
			code: 'chat-widget',
			is_active: true,
			tester_name: 'Hana',
			programmer_name: 'Ridwan',
			task_dev: 'TASK-12'
		};
		render(<CreateEditProjectModal isOpen onClose={vi.fn()} project={project} onSave={onSave} />);

		expect((screen.getByLabelText('Tester') as HTMLInputElement).value).toBe('Hana');
		expect((screen.getByLabelText('Programmer') as HTMLInputElement).value).toBe('Ridwan');
		fireEvent.change(screen.getByLabelText('Task Dev'), { target: { value: '' } });
		await submit();

		// Hanya field yang berubah yang dikirim; dikosongkan → '' (API menyimpan NULL)
		expect(onSave.mock.calls[0][0]).toMatchObject({ task_dev: '' });
		expect(onSave.mock.calls[0][0]).not.toHaveProperty('tester_name');
	});
});

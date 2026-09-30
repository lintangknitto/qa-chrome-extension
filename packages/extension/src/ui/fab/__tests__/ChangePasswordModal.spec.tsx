// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChangePasswordModal } from '../views/ChangePasswordModal';
import type { RecordingApiClient } from '../../../recording/apiClient';

describe('ChangePasswordModal', () => {
	const mockApi = {
		changePassword: vi.fn()
	} as unknown as RecordingApiClient;

	const mockOnClose = vi.fn();
	const mockOnSuccess = vi.fn();

	beforeEach(() => {
		(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
		vi.clearAllMocks();
	});

	afterEach(() => {
		cleanup();
	});

	it('renders modal inputs and buttons when open', () => {
		render(
			<ChangePasswordModal
				isOpen={true}
				onClose={mockOnClose}
				api={mockApi}
				onSuccess={mockOnSuccess}
			/>
		);

		expect(screen.getByText('Ubah Password Akun')).toBeTruthy();
		expect(screen.getByPlaceholderText('Masukkan password saat ini')).toBeTruthy();
		expect(screen.getByPlaceholderText('Minimal 6 karakter')).toBeTruthy();
		expect(screen.getByPlaceholderText('Ketik ulang password baru')).toBeTruthy();
		expect(screen.getByRole('button', { name: /simpan password/i })).toBeTruthy();
	});

	it('shows error when new password is less than 6 characters', async () => {
		render(
			<ChangePasswordModal
				isOpen={true}
				onClose={mockOnClose}
				api={mockApi}
				onSuccess={mockOnSuccess}
			/>
		);

		fireEvent.change(screen.getByPlaceholderText('Masukkan password saat ini'), {
			target: { value: 'oldpass123' }
		});
		fireEvent.change(screen.getByPlaceholderText('Minimal 6 karakter'), {
			target: { value: '12345' }
		});
		fireEvent.change(screen.getByPlaceholderText('Ketik ulang password baru'), {
			target: { value: '12345' }
		});

		fireEvent.click(screen.getByRole('button', { name: /simpan password/i }));

		await waitFor(() => {
			expect(screen.getByText(/minimal 6 karakter/i)).toBeTruthy();
		});
		expect(mockApi.changePassword).not.toHaveBeenCalled();
	});

	it('shows error when new passwords do not match', async () => {
		render(
			<ChangePasswordModal
				isOpen={true}
				onClose={mockOnClose}
				api={mockApi}
				onSuccess={mockOnSuccess}
			/>
		);

		fireEvent.change(screen.getByPlaceholderText('Masukkan password saat ini'), {
			target: { value: 'oldpass123' }
		});
		fireEvent.change(screen.getByPlaceholderText('Minimal 6 karakter'), {
			target: { value: 'newpassword1' }
		});
		fireEvent.change(screen.getByPlaceholderText('Ketik ulang password baru'), {
			target: { value: 'newpassword2' }
		});

		fireEvent.click(screen.getByRole('button', { name: /simpan password/i }));

		await waitFor(() => {
			expect(screen.getByText(/konfirmasi password tidak cocok/i)).toBeTruthy();
		});
		expect(mockApi.changePassword).not.toHaveBeenCalled();
	});

	it('submits correctly on valid inputs and calls onSuccess & onClose', async () => {
		(mockApi.changePassword as ReturnType<typeof vi.fn>).mockResolvedValue({
			message: 'Password berhasil diubah'
		});

		render(
			<ChangePasswordModal
				isOpen={true}
				onClose={mockOnClose}
				api={mockApi}
				onSuccess={mockOnSuccess}
			/>
		);

		fireEvent.change(screen.getByPlaceholderText('Masukkan password saat ini'), {
			target: { value: 'oldpass123' }
		});
		fireEvent.change(screen.getByPlaceholderText('Minimal 6 karakter'), {
			target: { value: 'newsecret123' }
		});
		fireEvent.change(screen.getByPlaceholderText('Ketik ulang password baru'), {
			target: { value: 'newsecret123' }
		});

		fireEvent.click(screen.getByRole('button', { name: /simpan password/i }));

		await waitFor(() => {
			expect(mockApi.changePassword).toHaveBeenCalledWith('oldpass123', 'newsecret123');
			expect(mockOnSuccess).toHaveBeenCalledWith('Password berhasil diubah');
			expect(mockOnClose).toHaveBeenCalled();
		});
	});
});

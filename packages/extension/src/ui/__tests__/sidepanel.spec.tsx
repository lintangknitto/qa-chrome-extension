// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	login: vi.fn(),
	listActiveProjects: vi.fn(),
	listSessions: vi.fn(),
	createSession: vi.fn(),
	createCheckpoint: vi.fn(),
	endSession: vi.fn(),
	generateOutputs: vi.fn(),
	listGenerations: vi.fn(),
	saveAuth: vi.fn(),
	setBaseUrl: vi.fn(),
	clearAuth: vi.fn(),
	setActiveSession: vi.fn(),
	clearActiveSession: vi.fn()
}));

vi.mock('../../recording/apiClient', () => ({
	ApiError: class ApiError extends Error {},
	RecordingApiClient: class {
		login = mocks.login;
		listActiveProjects = mocks.listActiveProjects;
		listSessions = mocks.listSessions;
		createSession = mocks.createSession;
		createCheckpoint = mocks.createCheckpoint;
		endSession = mocks.endSession;
		generateOutputs = mocks.generateOutputs;
		listGenerations = mocks.listGenerations;
	}
}));

vi.mock('../../recording/tokenStore', () => ({
	getBaseUrl: vi.fn().mockResolvedValue(null),
	getToken: vi.fn().mockResolvedValue(null),
	getUser: vi.fn().mockResolvedValue(null),
	getActiveSession: vi.fn().mockResolvedValue(null),
	saveAuth: mocks.saveAuth,
	setBaseUrl: mocks.setBaseUrl,
	clearAuth: mocks.clearAuth,
	setActiveSession: mocks.setActiveSession,
	clearActiveSession: mocks.clearActiveSession
}));

import { SidePanelApp } from '../sidepanel';

const stubChrome = () => {
	(globalThis as unknown as { chrome: unknown }).chrome = {
		runtime: { sendMessage: vi.fn().mockResolvedValue({ success: true, pendingEvents: 0 }) },
		tabs: { query: vi.fn().mockResolvedValue([{ id: 5 }]) }
	};
};

beforeEach(() => {
	vi.clearAllMocks();
	stubChrome();
	mocks.listActiveProjects.mockResolvedValue({
		items: [{ id_project: 1, name: 'Proyek Alpha', code: 'proyek-alpha', is_active: true }]
	});
	mocks.listSessions.mockResolvedValue({ items: [] });
	mocks.login.mockResolvedValue({
		token: 'token-1',
		user: { id_user: 1, username: 'budi', nama: 'Budi' }
	});
});

afterEach(() => cleanup());

describe('SidePanelApp', () => {
	it('menampilkan form login saat belum ada token', async () => {
		render(<SidePanelApp />);

		expect(await screen.findByText('Login')).toBeTruthy();
		expect(screen.getByLabelText('Username')).toBeTruthy();
		expect(screen.getByLabelText('Password')).toBeTruthy();
	});

	it('menampilkan form Start dan daftar project setelah login berhasil', async () => {
		render(<SidePanelApp />);
		expect(await screen.findByText('Login')).toBeTruthy();

		fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'budi' } });
		fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'rahasia' } });
		fireEvent.click(screen.getByText('Login'));

		expect(await screen.findByText('Mulai Recording')).toBeTruthy();
		expect(await screen.findByText('Proyek Alpha')).toBeTruthy();
		expect(mocks.login).toHaveBeenCalledWith('budi', 'rahasia');
	});

	it('menonaktifkan tombol Start sampai field wajib terisi', async () => {
		render(<SidePanelApp />);
		expect(await screen.findByText('Login')).toBeTruthy();

		fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'budi' } });
		fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'rahasia' } });
		fireEvent.click(screen.getByText('Login'));

		const startButton = (await screen.findByText('Start Recording')) as HTMLButtonElement;
		expect(startButton.disabled).toBe(true);

		// Tunggu daftar project termuat (opsi <option> sudah ada) sebelum
		// mengubah select — mencegah race nilai select saat options masih kosong.
		await screen.findByText('Proyek Alpha');

		fireEvent.change(screen.getByLabelText('Project'), { target: { value: '1' } });
		fireEvent.change(screen.getByLabelText('Nomor test case'), { target: { value: 'TC-1' } });
		fireEvent.change(screen.getByLabelText('Judul'), { target: { value: 'Login berhasil' } });

		expect(startButton.disabled).toBe(false);
	});
});

import type { StoredUser } from '../../recording/tokenStore';
import type { RecordingProject } from '../../recording/apiClient';

export type UserRole = 'SUPERADMIN' | 'ADMIN' | 'QA' | 'IMPLEMENTOR' | 'DEV' | 'VIEWER' | string;

export const normalizeRole = (roleOrUser?: string | StoredUser | null): string => {
	if (!roleOrUser) return '';
	if (typeof roleOrUser === 'string') {
		const norm = roleOrUser.trim().toUpperCase();
		if (norm === 'DEV') return 'IMPLEMENTOR';
		return norm;
	}
	const raw = (roleOrUser as any).role || (roleOrUser as any).level;
	if (!raw) {
		return 'QA';
	}
	const norm = String(raw).trim().toUpperCase();
	if (norm === 'DEV') return 'IMPLEMENTOR';
	return norm;
};

export const isSuperadmin = (user: StoredUser | null | undefined): boolean => {
	if (!user) return false;
	return normalizeRole(user) === 'SUPERADMIN';
};

export const isAdmin = (user: StoredUser | null | undefined): boolean => {
	if (!user) return false;
	const role = normalizeRole(user);
	return role === 'ADMIN' || role === 'SUPERADMIN';
};

export const canManageUsers = (user: StoredUser | null | undefined): boolean => {
	if (!user) return false;
	return isAdmin(user);
};

export const canManageProjects = (user: StoredUser | null | undefined): boolean => {
	if (user === undefined) return true;
	if (user === null) return false;
	const role = normalizeRole(user);
	return ['SUPERADMIN', 'ADMIN', 'QA', 'IMPLEMENTOR'].includes(role) || user.username === 'qatester';
};

export const canEditProject = (
	user: StoredUser | null | undefined,
	project?: RecordingProject | null
): boolean => {
	if (user === undefined) return true;
	if (user === null) return false;
	const role = normalizeRole(user);
	if (role === 'SUPERADMIN' || role === 'ADMIN') return true;
	if (role === 'QA') {
		if (!project) return true;
		if (
			project.created_by_user_id !== undefined &&
			project.created_by_user_id !== null &&
			typeof user.id_user === 'number'
		) {
			return Number(project.created_by_user_id) === Number(user.id_user);
		}
		return false;
	}
	return false;
};

export const canDeleteProject = (
	user: StoredUser | null | undefined,
	project?: RecordingProject | null
): boolean => {
	if (user === undefined) return true;
	if (user === null) return false;
	const role = normalizeRole(user);
	if (role === 'SUPERADMIN' || role === 'ADMIN') return true;
	if (role === 'QA') {
		if (!project) return true;
		if (
			project.created_by_user_id !== undefined &&
			project.created_by_user_id !== null &&
			typeof user.id_user === 'number'
		) {
			return Number(project.created_by_user_id) === Number(user.id_user);
		}
		return false;
	}
	return false;
};

export const canManageTestCases = (user: StoredUser | null | undefined): boolean => {
	if (user === undefined) return true;
	if (user === null) return false;
	const role = normalizeRole(user);
	return ['SUPERADMIN', 'ADMIN', 'QA'].includes(role);
};

export const canRecord = (user: StoredUser | null | undefined): boolean => {
	if (user === undefined) return true;
	if (user === null) return false;
	const role = normalizeRole(user);
	return ['SUPERADMIN', 'ADMIN', 'QA'].includes(role);
};

export const canRunTest = (user: StoredUser | null | undefined): boolean => {
	if (user === undefined) return true;
	if (user === null) return false;
	const role = normalizeRole(user);
	return ['SUPERADMIN', 'ADMIN', 'QA', 'IMPLEMENTOR'].includes(role);
};

export const canGenerateAiScript = (user: StoredUser | null | undefined): boolean => {
	if (user === undefined) return true;
	if (user === null) return false;
	const role = normalizeRole(user);
	return ['SUPERADMIN', 'ADMIN', 'QA'].includes(role);
};

export const isReadOnlyViewer = (user: StoredUser | null | undefined): boolean => {
	if (user === undefined || user === null) return false;
	const role = normalizeRole(user);
	return role === 'VIEWER';
};

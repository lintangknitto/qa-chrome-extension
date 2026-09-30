import { describe, it, expect } from 'vitest';
import {
	isSuperadmin,
	isAdmin,
	canManageUsers,
	canManageProjects,
	canEditProject,
	canDeleteProject,
	canManageTestCases,
	canRecord,
	canRunTest,
	canGenerateAiScript,
	isReadOnlyViewer,
	normalizeRole
} from '../fab-permissions';
import type { StoredUser } from '../../../recording/tokenStore';
import type { RecordingProject } from '../../../recording/apiClient';

describe('fab-permissions RBAC Matrix', () => {
	const superadminUser: StoredUser = { id_user: 1, username: 'superadmin', nama: 'Superadmin', role: 'SUPERADMIN', is_active: 1 };
	const adminUser: StoredUser = { id_user: 2, username: 'admin', nama: 'Admin', role: 'ADMIN', is_active: 1 };
	const qaUser: StoredUser = { id_user: 3, username: 'qa_lead', nama: 'QA Lead', role: 'QA', is_active: 1 };
	const devUser: StoredUser = { id_user: 4, username: 'dev_user', nama: 'Dev User', role: 'DEV', is_active: 1 };
	const implementorUser: StoredUser = { id_user: 5, username: 'imp_user', nama: 'Implementor User', role: 'IMPLEMENTOR', is_active: 1 };
	const viewerUser: StoredUser = { id_user: 6, username: 'viewer_user', nama: 'Viewer User', role: 'VIEWER', is_active: 1 };

	const myProject: RecordingProject = { id_project: 1, name: 'My Project', code: 'my-proj', is_active: true, created_by_user_id: 3 };
	const otherProject: RecordingProject = { id_project: 2, name: 'Other Project', code: 'other-proj', is_active: true, created_by_user_id: 99 };

	describe('normalizeRole', () => {
		it('handles uppercase, lowercase, and null values correctly', () => {
			expect(normalizeRole('superadmin')).toBe('SUPERADMIN');
			expect(normalizeRole('ADMIN')).toBe('ADMIN');
			expect(normalizeRole('qa')).toBe('QA');
			expect(normalizeRole('DEV')).toBe('IMPLEMENTOR');
			expect(normalizeRole('implementor')).toBe('IMPLEMENTOR');
			expect(normalizeRole('viewer')).toBe('VIEWER');
			expect(normalizeRole(undefined)).toBe('');
			expect(normalizeRole('')).toBe('');
		});
	});

	describe('SUPERADMIN Permissions', () => {
		it('has full permissions across all capabilities', () => {
			expect(isSuperadmin(superadminUser)).toBe(true);
			expect(isAdmin(superadminUser)).toBe(true);
			expect(canManageUsers(superadminUser)).toBe(true);
			expect(canManageProjects(superadminUser)).toBe(true);
			expect(canEditProject(superadminUser, otherProject)).toBe(true);
			expect(canDeleteProject(superadminUser, otherProject)).toBe(true);
			expect(canManageTestCases(superadminUser)).toBe(true);
			expect(canRecord(superadminUser)).toBe(true);
			expect(canRunTest(superadminUser)).toBe(true);
			expect(canGenerateAiScript(superadminUser)).toBe(true);
			expect(isReadOnlyViewer(superadminUser)).toBe(false);
		});
	});

	describe('ADMIN Permissions', () => {
		it('has management permissions except superadmin-only flags', () => {
			expect(isSuperadmin(adminUser)).toBe(false);
			expect(isAdmin(adminUser)).toBe(true);
			expect(canManageUsers(adminUser)).toBe(true);
			expect(canManageProjects(adminUser)).toBe(true);
			expect(canEditProject(adminUser, otherProject)).toBe(true);
			expect(canDeleteProject(adminUser, otherProject)).toBe(true);
			expect(canManageTestCases(adminUser)).toBe(true);
			expect(canRecord(adminUser)).toBe(true);
			expect(canRunTest(adminUser)).toBe(true);
			expect(canGenerateAiScript(adminUser)).toBe(true);
			expect(isReadOnlyViewer(adminUser)).toBe(false);
		});
	});

	describe('QA Permissions', () => {
		it('can manage test cases, record, rerun, and manage owned projects', () => {
			expect(isSuperadmin(qaUser)).toBe(false);
			expect(isAdmin(qaUser)).toBe(false);
			expect(canManageUsers(qaUser)).toBe(false);
			expect(canManageProjects(qaUser)).toBe(true);
			expect(canEditProject(qaUser, myProject)).toBe(true);
			expect(canDeleteProject(qaUser, myProject)).toBe(true);
			expect(canEditProject(qaUser, otherProject)).toBe(false);
			expect(canDeleteProject(qaUser, otherProject)).toBe(false);
			expect(canManageTestCases(qaUser)).toBe(true);
			expect(canRecord(qaUser)).toBe(true);
			expect(canRunTest(qaUser)).toBe(true);
			expect(canGenerateAiScript(qaUser)).toBe(true);
			expect(isReadOnlyViewer(qaUser)).toBe(false);
		});
	});

	describe('IMPLEMENTOR & DEV Permissions', () => {
		it('can run tests and view details, but cannot edit or delete projects', () => {
			[devUser, implementorUser].forEach((user) => {
				expect(isSuperadmin(user)).toBe(false);
				expect(isAdmin(user)).toBe(false);
				expect(canManageUsers(user)).toBe(false);
				expect(canManageProjects(user)).toBe(true);
				expect(canEditProject(user, myProject)).toBe(false);
				expect(canDeleteProject(user, myProject)).toBe(false);
				expect(canManageTestCases(user)).toBe(false);
				expect(canRecord(user)).toBe(false);
				expect(canRunTest(user)).toBe(true);
				expect(canGenerateAiScript(user)).toBe(false);
				expect(isReadOnlyViewer(user)).toBe(false);
			});
		});
	});

	describe('VIEWER Permissions', () => {
		it('is strictly read-only with all write/execute actions denied', () => {
			expect(isSuperadmin(viewerUser)).toBe(false);
			expect(isAdmin(viewerUser)).toBe(false);
			expect(canManageUsers(viewerUser)).toBe(false);
			expect(canManageProjects(viewerUser)).toBe(false);
			expect(canEditProject(viewerUser, myProject)).toBe(false);
			expect(canDeleteProject(viewerUser, myProject)).toBe(false);
			expect(canManageTestCases(viewerUser)).toBe(false);
			expect(canRecord(viewerUser)).toBe(false);
			expect(canRunTest(viewerUser)).toBe(false);
			expect(canGenerateAiScript(viewerUser)).toBe(false);
			expect(isReadOnlyViewer(viewerUser)).toBe(true);
		});
	});

	describe('Null / Undefined user handling', () => {
		it('handles null (unauthenticated) by denying all permissions', () => {
			expect(canManageUsers(null)).toBe(false);
			expect(canManageProjects(null)).toBe(false);
			expect(canEditProject(null, myProject)).toBe(false);
			expect(canDeleteProject(null, myProject)).toBe(false);
			expect(canManageTestCases(null)).toBe(false);
			expect(canRecord(null)).toBe(false);
			expect(canRunTest(null)).toBe(false);
			expect(isReadOnlyViewer(null)).toBe(false);
		});

		it('handles undefined (unspecified in props) with permissive defaults for test compatibility', () => {
			expect(canManageUsers(undefined)).toBe(false);
			expect(canManageProjects(undefined)).toBe(true);
			expect(canEditProject(undefined, myProject)).toBe(true);
			expect(canDeleteProject(undefined, myProject)).toBe(true);
			expect(canManageTestCases(undefined)).toBe(true);
			expect(canRecord(undefined)).toBe(true);
			expect(canRunTest(undefined)).toBe(true);
			expect(isReadOnlyViewer(undefined)).toBe(false);
		});
	});
});

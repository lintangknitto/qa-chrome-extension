import { describe, expect, it } from 'vitest';
import { diffRecordingTabs, filterRecordableTabs, isTabInRecordingGroup } from '../tabGroupRecorder';

describe('tabGroupRecorder', () => {
	it('hanya menganggap tab di group recording sebagai recordable', () => {
		expect(isTabInRecordingGroup({ id: 1, groupId: 10 }, 10)).toBe(true);
		expect(isTabInRecordingGroup({ id: 2, groupId: 11 }, 10)).toBe(false);
		expect(isTabInRecordingGroup({ id: 3 }, 10)).toBe(false);
	});

	it('tidak merekam apa pun saat group belum ditentukan', () => {
		expect(filterRecordableTabs([{ id: 1, groupId: 10 }], null)).toEqual([]);
	});

	it('memfilter tab di luar group', () => {
		const tabs = [
			{ id: 1, groupId: 10 },
			{ id: 2, groupId: 99 },
			{ id: 3, groupId: 10 }
		];
		expect(filterRecordableTabs(tabs, 10).map((tab) => tab.id)).toEqual([1, 3]);
	});

	it('menghitung tab yang masuk dan keluar group', () => {
		const result = diffRecordingTabs([1, 3], [{ id: 1, groupId: 10 }, { id: 4, groupId: 10 }], 10);
		expect(result.added).toEqual([4]);
		expect(result.removed).toEqual([3]);
	});

	it('menganggap semua tab keluar saat group berubah', () => {
		const result = diffRecordingTabs([1, 2], [{ id: 1, groupId: 20 }], 10);
		expect(result.added).toEqual([]);
		expect(result.removed).toEqual([1, 2]);
	});
});

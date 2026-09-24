export interface TabLike {
	id?: number;
	groupId?: number;
}

/**
 * Hanya tab yang berada di Chrome Tab Group milik session yang direkam.
 * Tab di luar group (mis. tab pribadi tester) tidak boleh ikut terekam.
 */
export const isTabInRecordingGroup = (tab: TabLike, recordingGroupId: number | null): boolean =>
	recordingGroupId !== null && typeof tab.groupId === 'number' && tab.groupId === recordingGroupId;

export const filterRecordableTabs = <T extends TabLike>(
	tabs: T[],
	recordingGroupId: number | null
): T[] => tabs.filter((tab) => isTabInRecordingGroup(tab, recordingGroupId));

/**
 * Menentukan tab yang harus dilepas ketika anggota group berubah.
 */
export const diffRecordingTabs = (
	previousTabIds: readonly number[],
	currentTabs: TabLike[],
	recordingGroupId: number | null
): { added: number[]; removed: number[] } => {
	const currentIds = filterRecordableTabs(currentTabs, recordingGroupId)
		.map((tab) => tab.id)
		.filter((id): id is number => typeof id === 'number');

	const previous = new Set(previousTabIds);
	const current = new Set(currentIds);

	return {
		added: currentIds.filter((id) => !previous.has(id)),
		removed: previousTabIds.filter((id) => !current.has(id))
	};
};

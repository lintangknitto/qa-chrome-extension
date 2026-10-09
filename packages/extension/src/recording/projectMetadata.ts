/** Kolom metadata header format test case V4 di project (urutan = urutan form). */
export const PROJECT_METADATA_FIELDS = [
	'release_version',
	'test_app_folder',
	'ip_dev',
	'ip_prod',
	'tester_name',
	'programmer_name',
	'task_dev',
	'brd_id',
	'link_task_pb',
	'link_figma'
] as const;
export type ProjectMetadataField = (typeof PROJECT_METADATA_FIELDS)[number];

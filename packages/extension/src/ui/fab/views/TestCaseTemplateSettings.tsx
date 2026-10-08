import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle, FileSpreadsheet, Pencil, Plus, Star, XCircle } from 'lucide-react';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Modal } from '../components/Modal';
import { Textarea } from '../components/Textarea';
import { Badge } from '../components/Badge';
import type {
	RecordingApiClient,
	TemplateColumnMapping,
	TestCaseTemplate,
	TestCaseTemplateInput
} from '../../../recording/apiClient';
import {
	checkTemplateMapping,
	extractGoogleSpreadsheetInfo,
	fetchGoogleSpreadsheetCsv,
	TEMPLATE_FIELD_LABELS,
	type TemplateMappingCheck
} from '../../../recording/spreadsheetParser';

export const TEMPLATE_ADMIN_LEVELS = ['ADMIN', 'SUPERADMIN'];

export const canManageTestCaseTemplates = (level?: string | null): boolean =>
	!!level && TEMPLATE_ADMIN_LEVELS.includes(level.toUpperCase());

interface FormState {
	version_label: string;
	name: string;
	spreadsheet_url: string;
	gid: string;
	columns: Record<string, { header: string; aliases: string }>;
	export_anchors: string;
	is_default: boolean;
}

const emptyForm = (): FormState => ({
	version_label: '',
	name: '',
	spreadsheet_url: '',
	gid: '',
	columns: Object.fromEntries(TEMPLATE_FIELD_LABELS.map(({ field, label }) => [field, { header: label, aliases: '' }])),
	export_anchors: '{}',
	is_default: false
});

const formFromTemplate = (template: TestCaseTemplate): FormState => ({
	version_label: template.version_label,
	name: template.name,
	spreadsheet_url: template.spreadsheet_url,
	gid: template.gid ?? '',
	columns: Object.fromEntries(
		TEMPLATE_FIELD_LABELS.map(({ field }) => {
			const column = template.column_mapping[field];
			return [field, { header: column?.header ?? '', aliases: (column?.aliases ?? []).join(', ') }];
		})
	),
	export_anchors: JSON.stringify(template.export_anchors ?? {}, null, 2),
	is_default: template.is_default
});

/** Kolom dengan header kosong tidak dipetakan (field itu diabaikan saat import/ekspor). */
export const buildColumnMapping = (columns: FormState['columns']): TemplateColumnMapping => {
	const mapping: TemplateColumnMapping = {};
	for (const { field } of TEMPLATE_FIELD_LABELS) {
		const column = columns[field];
		if (!column?.header.trim()) continue;
		const aliases = column.aliases.split(',').map((alias) => alias.trim()).filter(Boolean);
		mapping[field] = aliases.length > 0 ? { header: column.header.trim(), aliases } : { header: column.header.trim() };
	}
	return mapping;
};

const parseAnchors = (raw: string): Record<string, unknown> => {
	const parsed: unknown = JSON.parse(raw.trim() || '{}');
	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Anchor ekspor harus berupa objek JSON.');
	return parsed as Record<string, unknown>;
};

const sheetUrlWithGid = (url: string, gid: string): string =>
	gid && !/[?&#]gid=\d+/.test(url) ? `${url.split('#')[0]}#gid=${gid}` : url;

export interface TestCaseTemplateSettingsProps {
	api: RecordingApiClient;
	showNotice: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const TestCaseTemplateSettings: React.FC<TestCaseTemplateSettingsProps> = ({ api, showNotice }) => {
	const [templates, setTemplates] = useState<TestCaseTemplate[]>([]);
	const [loading, setLoading] = useState(false);
	const [editing, setEditing] = useState<TestCaseTemplate | null>(null);
	const [isFormOpen, setFormOpen] = useState(false);
	const [form, setForm] = useState<FormState>(emptyForm);
	const [formError, setFormError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const [checking, setChecking] = useState(false);
	const [check, setCheck] = useState<TemplateMappingCheck | null>(null);

	const load = useCallback(async () => {
		setLoading(true);
		try {
			setTemplates(await api.listTestCaseTemplates(true));
		} catch (err) {
			showNotice((err as Error).message || 'Gagal memuat template test case.', 'error');
		} finally {
			setLoading(false);
		}
	}, [api, showNotice]);

	useEffect(() => {
		void load();
	}, [load]);

	const openForm = (template: TestCaseTemplate | null) => {
		setEditing(template);
		setForm(template ? formFromTemplate(template) : emptyForm());
		setFormError(null);
		setCheck(null);
		setFormOpen(true);
	};

	const setColumn = (field: string, key: 'header' | 'aliases', value: string) =>
		setForm((prev) => ({ ...prev, columns: { ...prev.columns, [field]: { ...prev.columns[field], [key]: value } } }));

	const handleCheck = async () => {
		const info = extractGoogleSpreadsheetInfo(sheetUrlWithGid(form.spreadsheet_url, form.gid));
		if (!info) {
			setFormError('URL spreadsheet tidak valid.');
			return;
		}
		setChecking(true);
		setFormError(null);
		try {
			setCheck(checkTemplateMapping(await fetchGoogleSpreadsheetCsv(info.exportUrl), buildColumnMapping(form.columns)));
		} catch (err) {
			setFormError((err as Error).message || 'Gagal memuat sheet template.');
		} finally {
			setChecking(false);
		}
	};

	const handleSave = async () => {
		const columnMapping = buildColumnMapping(form.columns);
		if (!columnMapping.test_case_id || !columnMapping.title) {
			setFormError('Header kolom Test Case ID dan Test Case wajib diisi.');
			return;
		}
		let exportAnchors: Record<string, unknown>;
		try {
			exportAnchors = parseAnchors(form.export_anchors);
		} catch (err) {
			setFormError(err instanceof SyntaxError ? 'Anchor ekspor bukan JSON yang valid.' : (err as Error).message);
			return;
		}

		const input: TestCaseTemplateInput = {
			version_label: form.version_label.trim(),
			name: form.name.trim(),
			spreadsheet_url: form.spreadsheet_url.trim(),
			gid: form.gid.trim() || null,
			column_mapping: columnMapping,
			export_anchors: exportAnchors
		};
		setSaving(true);
		setFormError(null);
		try {
			if (editing) {
				await api.updateTestCaseTemplate(editing.id_template, input);
				showNotice(`Template ${input.version_label} diperbarui.`, 'success');
			} else {
				await api.createTestCaseTemplate({ ...input, is_default: form.is_default });
				showNotice(`Template ${input.version_label} didaftarkan.`, 'success');
			}
			setFormOpen(false);
			await load();
		} catch (err) {
			setFormError((err as Error).message || 'Gagal menyimpan template.');
		} finally {
			setSaving(false);
		}
	};

	const runAction = async (action: () => Promise<unknown>, success: string) => {
		try {
			await action();
			showNotice(success, 'success');
			await load();
		} catch (err) {
			showNotice((err as Error).message || 'Aksi gagal.', 'error');
		}
	};

	return (
		<div className="fab-setting-group k-card" style={{ padding: 16, marginTop: 12 }}>
			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 12 }}>
				<div>
					<div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>Template Test Case</div>
					<div className="sp-muted" style={{ fontSize: 11, marginTop: 2 }}>
						Format spreadsheet yang dipakai "Template Sistem", import, dan ekspor .xlsx
					</div>
				</div>
				<Button type="button" size="sm" variant="primary" icon={<Plus size={14} />} onClick={() => openForm(null)}>
					Tambah
				</Button>
			</div>

			{loading && templates.length === 0 ? (
				<div className="sp-muted" style={{ fontSize: 12 }}>Memuat template...</div>
			) : templates.length === 0 ? (
				<div className="sp-muted" style={{ fontSize: 12 }}>Belum ada template terdaftar.</div>
			) : (
				<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} role="list" aria-label="Daftar template test case">
					{templates.map((template) => (
						<div
							key={template.id_template}
							role="listitem"
							style={{
								border: '1px solid #e2e8f0',
								borderRadius: 8,
								padding: '10px 12px',
								display: 'flex',
								justifyContent: 'space-between',
								alignItems: 'center',
								gap: 8,
								opacity: template.is_active ? 1 : 0.6
							}}
						>
							<div style={{ minWidth: 0 }}>
								<div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
									<FileSpreadsheet size={14} />
									<span>{template.version_label}</span>
									{template.is_default && <Badge variant="success">Default</Badge>}
									{!template.is_active && <Badge variant="neutral">Nonaktif</Badge>}
								</div>
								<div className="sp-muted" style={{ fontSize: 11, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
									{template.name} · {Object.keys(template.column_mapping).length} kolom
									{template.gid ? ` · gid ${template.gid}` : ''}
								</div>
							</div>
							<div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
								<Button type="button" size="xs" variant="ghost" icon={<Pencil size={12} />} onClick={() => openForm(template)} aria-label={`Edit ${template.version_label}`}>
									Edit
								</Button>
								{template.is_active && !template.is_default && (
									<>
										<Button
											type="button"
											size="xs"
											variant="outline"
											icon={<Star size={12} />}
											onClick={() => void runAction(() => api.setDefaultTestCaseTemplate(template.id_template), `${template.version_label} menjadi template default.`)}
										>
											Jadikan Default
										</Button>
										<Button
											type="button"
											size="xs"
											variant="danger"
											onClick={() => void runAction(() => api.deactivateTestCaseTemplate(template.id_template), `${template.version_label} dinonaktifkan.`)}
										>
											Nonaktifkan
										</Button>
									</>
								)}
							</div>
						</div>
					))}
				</div>
			)}

			<Modal
				isOpen={isFormOpen}
				onClose={() => setFormOpen(false)}
				title={editing ? `Edit Template ${editing.version_label}` : 'Tambah Template Test Case'}
				footer={
					<div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
						<Button type="button" variant="secondary" size="sm" onClick={() => setFormOpen(false)}>
							Batal
						</Button>
						<Button type="button" variant="primary" size="sm" loading={saving} onClick={() => void handleSave()}>
							Simpan
						</Button>
					</div>
				}
			>
				<div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12 }}>
					<div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8 }}>
						<Input label="Versi" placeholder="V5" value={form.version_label} onChange={(e) => setForm({ ...form, version_label: e.target.value })} />
						<Input label="Nama" placeholder="FORMAT TEST CASE V5" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
					</div>
					<div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: 8 }}>
						<Input
							label="URL Google Spreadsheet"
							placeholder="https://docs.google.com/spreadsheets/d/..."
							value={form.spreadsheet_url}
							onChange={(e) => setForm({ ...form, spreadsheet_url: e.target.value })}
						/>
						<Input label="GID tab" placeholder="1730053292" value={form.gid} onChange={(e) => setForm({ ...form, gid: e.target.value })} />
					</div>

					<div>
						<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
							<span style={{ fontWeight: 600, color: '#334155' }}>Pemetaan kolom</span>
							<Button type="button" size="xs" variant="secondary" loading={checking} onClick={() => void handleCheck()}>
								Uji template
							</Button>
						</div>
						<div className="sp-muted" style={{ fontSize: 11, marginBottom: 6 }}>
							Header persis seperti di sheet; alias dipisah koma. Kosongkan header untuk mengabaikan kolom.
						</div>
						<table style={{ width: '100%', borderCollapse: 'collapse' }}>
							<thead>
								<tr style={{ textAlign: 'left', color: '#64748b', fontSize: 11 }}>
									<th style={{ padding: '2px 4px' }}>Field</th>
									<th style={{ padding: '2px 4px' }}>Header kolom</th>
									<th style={{ padding: '2px 4px' }}>Alias</th>
									{check && <th style={{ padding: '2px 4px' }} aria-label="Hasil uji" />}
								</tr>
							</thead>
							<tbody>
								{TEMPLATE_FIELD_LABELS.map(({ field, label, required }) => {
									const mapped = check?.mapped.find((m) => m.field === field);
									const hasHeader = Boolean(form.columns[field]?.header.trim());
									return (
										<tr key={field}>
											<td style={{ padding: '2px 4px', whiteSpace: 'nowrap' }}>
												{label}
												{required && <span style={{ color: '#ef4444' }}>*</span>}
											</td>
											<td style={{ padding: '2px 4px' }}>
												<input
													className="sp-input k-input"
													aria-label={`Header ${label}`}
													value={form.columns[field]?.header ?? ''}
													onChange={(e) => setColumn(field, 'header', e.target.value)}
													style={{ width: '100%', fontSize: 12 }}
												/>
											</td>
											<td style={{ padding: '2px 4px' }}>
												<input
													className="sp-input k-input"
													aria-label={`Alias ${label}`}
													value={form.columns[field]?.aliases ?? ''}
													onChange={(e) => setColumn(field, 'aliases', e.target.value)}
													style={{ width: '100%', fontSize: 12 }}
												/>
											</td>
											{check && (
												<td style={{ padding: '2px 4px' }} data-testid={`check-${field}`}>
													{!hasHeader ? (
														<span className="sp-muted">—</span>
													) : mapped ? (
														<CheckCircle size={14} color="#16a34a" aria-label="terpetakan" />
													) : (
														<XCircle size={14} color="#dc2626" aria-label="tidak ditemukan" />
													)}
												</td>
											)}
										</tr>
									);
								})}
							</tbody>
						</table>
						{check && (
							<div role="status" style={{ marginTop: 6, fontSize: 11, color: check.unmapped.length ? '#92400e' : '#15803d' }}>
								{check.headerRowIndex === null
									? 'Header tidak ditemukan di sheet. Periksa URL/GID dan nama header.'
									: `Header di baris ${check.headerRowIndex + 1}: ${check.mapped.length} kolom terpetakan` +
										(check.unmapped.length ? `, tidak ditemukan: ${check.unmapped.join(', ')}` : '.')}
							</div>
						)}
					</div>

					<Textarea
						label="Anchor ekspor (JSON)"
						rows={6}
						value={form.export_anchors}
						onChange={(e) => setForm({ ...form, export_anchors: e.target.value })}
						helperText='Contoh: {"sheet_name":"FORMAT TEST CASE V4","header_row":18,"data_start_row":19,"metadata":{"tester_name":"F1"},"pb_block":{...}}'
						style={{ fontFamily: 'monospace', fontSize: 11 }}
					/>

					{!editing && (
						<label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
							<input type="checkbox" checked={form.is_default} onChange={(e) => setForm({ ...form, is_default: e.target.checked })} />
							Jadikan template default
						</label>
					)}

					{formError && (
						<div className="sp-error" role="alert" style={{ padding: '8px 10px', borderRadius: 8 }}>
							{formError}
						</div>
					)}
				</div>
			</Modal>
		</div>
	);
};

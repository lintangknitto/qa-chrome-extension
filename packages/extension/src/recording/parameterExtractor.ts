/**
 * Utilitas ekstraksi variabel parameter dari Playwright Script & Actions untuk Re-run interaktif.
 */
import { parseScript, type ParsedStep } from './scriptParser';

export interface ReRunParameter {
	id: string;
	label: string;
	selector: string;
	originalValue: string;
	currentValue: string;
	type: 'text' | 'email' | 'number' | 'date';
}

export function inferParameterType(nameOrSelector: string, value: string): 'text' | 'email' | 'number' | 'date' {
	const lower = (nameOrSelector || '').toLowerCase();
	const valStr = String(value || '');

	if (lower.includes('email') || valStr.includes('@')) return 'email';
	if (
		lower.includes('qty') ||
		lower.includes('amount') ||
		lower.includes('count') ||
		lower.includes('price') ||
		lower.includes('total') ||
		lower.includes('phone') ||
		lower.includes('telp') ||
		lower.includes('nomor') ||
		/^\d+$/.test(valStr.trim())
	) {
		return 'number';
	}
	if (
		lower.includes('date') ||
		lower.includes('tanggal') ||
		lower.includes('tgl') ||
		/^\d{4}-\d{2}-\d{2}$/.test(valStr.trim())
	) {
		return 'date';
	}
	return 'text';
}

export function generateRandomValue(param: ReRunParameter): string {
	const rnd = Math.floor(1000 + Math.random() * 9000);
	switch (param.type) {
		case 'email':
			return `tester_${rnd}@knitto.test`;
		case 'number':
			return String(Math.floor(10 + Math.random() * 900));
		case 'date': {
			const d = new Date();
			return d.toISOString().split('T')[0];
		}
		case 'text':
		default: {
			const base = (param.originalValue || 'Data').split('_')[0];
			return `${base}_${rnd}`;
		}
	}
}

const labelFromLocator = (step: ParsedStep): string => {
	const spec = step.locator;
	if (!spec) return step.selector ?? '';
	if (spec.kind === 'role') return spec.name ?? spec.role;
	if (spec.kind === 'css') {
		const nameAttr = /\[name="([^"]+)"\]/.exec(spec.value);
		if (nameAttr) return nameAttr[1];
		return spec.value.startsWith('#') || spec.value.startsWith('.') ? spec.value.slice(1) : spec.value;
	}
	return spec.value;
};

export function extractParametersFromPlaywrightScript(script: string): ReRunParameter[] {
	if (!script) return [];
	const params: ReRunParameter[] = [];
	const seenSelectors = new Set<string>();

	// Parser yang sama dengan Replay Engine → key override (selector) selalu cocok dengan langkah replay.
	for (const step of parseScript(script)) {
		if (step.action !== 'fill' || !step.selector || seenSelectors.has(step.selector)) continue;
		seenSelectors.add(step.selector);
		const originalValue = step.value ?? '';
		const label = labelFromLocator(step).replace(/[_-]/g, ' ');
		params.push({
			id: `param_${params.length + 1}`,
			label: label.charAt(0).toUpperCase() + label.slice(1),
			selector: step.selector,
			originalValue,
			currentValue: originalValue,
			type: inferParameterType(`${step.selector} ${labelFromLocator(step)}`, originalValue)
		});
	}

	return params;
}

export function extractParametersFromUserActions(
	actions: Array<{ action_type?: string; target_selector?: string; value?: string }>
): ReRunParameter[] {
	if (!actions || !Array.isArray(actions)) return [];
	const params: ReRunParameter[] = [];
	const seenSelectors = new Set<string>();

	for (const a of actions) {
		const type = (a.action_type || '').toLowerCase();
		if (
			(type.includes('input') || type.includes('change') || type.includes('fill')) &&
			a.target_selector &&
			a.value !== undefined
		) {
			const selector = a.target_selector.trim();
			if (!seenSelectors.has(selector)) {
				seenSelectors.add(selector);
				let label = selector;
				if (selector.startsWith('#') || selector.startsWith('.')) {
					label = selector.slice(1);
				}
				label = label.replace(/[_-]/g, ' ');

				params.push({
					id: `param_${params.length + 1}`,
					label: label.charAt(0).toUpperCase() + label.slice(1),
					selector,
					originalValue: String(a.value),
					currentValue: String(a.value),
					type: inferParameterType(selector, String(a.value))
				});
			}
		}
	}

	return params;
}

export function extractReRunParameters(options: {
	script?: string | null;
	actions?: Array<{ action_type?: string; target_selector?: string; value?: string }>;
}): ReRunParameter[] {
	if (options.script) {
		const fromScript = extractParametersFromPlaywrightScript(options.script);
		if (fromScript.length > 0) return fromScript;
	}
	if (options.actions && options.actions.length > 0) {
		return extractParametersFromUserActions(options.actions);
	}
	return [];
}

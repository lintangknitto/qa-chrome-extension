// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import manifest from '../../../manifest.json';
import pkgJson from '../../../package.json';
import rootPkgJson from '../../../../../package.json';
import { AuthTokenSection } from '../authToken';
import { uniqueGroupStyle } from '../../connectedTabGroup';

describe('Rebranding Knitto QA Tools Verification', () => {
	it('packages/extension/package.json menggunakan nama knitto-qa-tools', () => {
		expect(pkgJson.name).toBe('knitto-qa-tools');
	});

	it('root package.json mengarahkan script build ke knitto-qa-tools', () => {
		expect(rootPkgJson.scripts.build).toContain('knitto-qa-tools');
	});

	it('manifest.json memiliki nama Knitto QA Tools dan bersih dari side_panel / sidePanel permission', () => {
		expect(manifest.name).toBe('Knitto QA Tools');
		expect(manifest.action?.default_title).toBe('Knitto QA Tools');
		expect((manifest as Record<string, unknown>).side_panel).toBeUndefined();
		expect(manifest.permissions).not.toContain('sidePanel');
	});

	it('connectedTabGroup.ts menghasilkan judul group dengan prefix Knitto QA Tools', () => {
		const style = uniqueGroupStyle('test-client', []);
		expect(style.title).toBe('Knitto QA Tools · test-client');
	});

	it('AuthTokenSection merender token environment variable KNITTO_QA_TOOLS_TOKEN', () => {
		render(<AuthTokenSection />);
		expect(screen.getByText(/KNITTO_QA_TOOLS_TOKEN=/)).toBeTruthy();
	});
});

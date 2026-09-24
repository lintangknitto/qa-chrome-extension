import React from 'react';
import LogoKnitto from './logo/LogoKnitto';

/**
 * Logo Knitto (dari knitto-admin-extension) yang "dibungkus" badge QA kecil
 * di pojoknya — identitas visual floating button QA Recorder.
 */
export const FabLogo = (): React.ReactElement => (
	<span className="fab-logo-wrap">
		<LogoKnitto width={30} height={30} />
		<span className="fab-qa-badge" aria-hidden="true">
			QA
		</span>
	</span>
);
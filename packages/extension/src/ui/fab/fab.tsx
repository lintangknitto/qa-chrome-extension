import React, { useCallback, useEffect, useRef, useState } from 'react';
import { fabMenuForState, type FabIntent, type FabSettings } from './fab-state';
import { isFabStateChanged, openPanelWithIntent, requestFabState } from './fab-messaging';
import { saveFabSettings } from './fab-settings';
import { FabLogo } from './FabLogo';
import { fabIcons } from './fab-icons';

const SIDEBAR_WIDTH = 500;

interface FabAppProps {
	settings: FabSettings;
}

export const FabApp = (props: FabAppProps): React.ReactElement => {
	const [state, setState] = useState<'idle' | 'recording'>('idle');
	const [settings, setSettings] = useState<FabSettings>(props.settings);
	const [open, setOpen] = useState(false);
	const [settingOpen, setSettingOpen] = useState(false);
	const rootRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		let cancelled = false;
		void requestFabState().then((fabState) => {
			if (!cancelled) setState(fabState.recording ? 'recording' : 'idle');
		});
		const onMessage = (message: unknown): void => {
			if (isFabStateChanged(message)) {
				setState(message.state.recording ? 'recording' : 'idle');
				setOpen(false);
				setSettingOpen(false);
			}
		};
		chrome.runtime.onMessage.addListener(onMessage);
		return () => {
			cancelled = true;
			chrome.runtime.onMessage.removeListener(onMessage);
		};
	}, []);

	// Tutup dengan Esc ketika sidebar terbuka.
	useEffect(() => {
		if (!open) return;
		const onKeyDown = (event: KeyboardEvent): void => {
			if (event.key === 'Escape') {
				setOpen(false);
				setSettingOpen(false);
			}
		};
		document.addEventListener('keydown', onKeyDown);
		return () => document.removeEventListener('keydown', onKeyDown);
	}, [open]);

	const closeAll = useCallback(() => {
		setOpen(false);
		setSettingOpen(false);
	}, []);

	const activate = useCallback(
		async (intent: FabIntent) => {
			if (intent === 'setting') {
				setSettingOpen(true);
				return;
			}
			setOpen(false);
			setSettingOpen(false);
			await openPanelWithIntent(intent);
		},
		[]
	);

	const toggleEnabled = useCallback(() => {
		const next = { ...settings, enabled: !settings.enabled };
		setSettings(next);
		void saveFabSettings(next);
	}, [settings]);

	const setSide = useCallback((side: 'left' | 'right') => {
		const next = { ...settings, side };
		setSettings(next);
		void saveFabSettings(next);
	}, [settings]);

	const side = settings.side;
	const triggerStyle: React.CSSProperties = {
		top: '40%',
		[side]: open ? SIDEBAR_WIDTH + 12 : 0
	};
	const sidebarStyle: React.CSSProperties = {
		[side]: open ? 0 : -SIDEBAR_WIDTH
	};

	const menuItems = fabMenuForState(state);

	return (
		<div ref={rootRef} className="fab-root" data-side={side}>
			{open ? (
				<button className="fab-backdrop" aria-label="Tutup sidebar" onClick={closeAll} />
			) : null}

			<aside
				className="fab-sidebar"
				role="dialog"
				aria-modal="true"
				aria-label="Sidebar QA Knitto Recorder"
				style={sidebarStyle}
				data-open={open}
			>
				<div className="fab-sidebar-header">
					<span>QA Knitto Recorder</span>
					<button className="fab-sidebar-close" aria-label="Tutup" onClick={closeAll}>
						✕
					</button>
				</div>
				<div className="fab-sidebar-body">
					{settingOpen ? (
						<div className="fab-setting-group">
							<span className="fab-setting-label">Pengaturan</span>
							<button
								className="fab-setting-toggler"
								aria-pressed={settings.enabled}
								onClick={toggleEnabled}
							>
								Tampilkan FAB
								<span className={`fab-setting-check ${settings.enabled ? 'fab-on' : ''}`} aria-hidden="true" />
							</button>
							<span className="fab-setting-label">Sisi sidebar</span>
							<div className="fab-setting-radios">
								<button
									className={`fab-setting-radio ${settings.side === 'right' ? 'fab-active' : ''}`}
									onClick={() => setSide('right')}
								>
									Kanan
								</button>
								<button
									className={`fab-setting-radio ${settings.side === 'left' ? 'fab-active' : ''}`}
									onClick={() => setSide('left')}
								>
									Kiri
								</button>
							</div>
							<button className="fab-menu-item fab-menu-item--back" onClick={() => setSettingOpen(false)}>
								← Menu
							</button>
						</div>
					) : (
						<div className="fab-menu-grid">
							{menuItems.map((item) => (
								<button
									key={item.id}
									className="fab-menu-item"
									onClick={() => void activate(item.id)}
								>
									<span className="fab-menu-icon">{fabIcons[item.id]}</span>
									<span className="fab-menu-label">{item.label}</span>
								</button>
							))}
						</div>
					)}
				</div>
			</aside>

			<button
				className={`fab-trigger ${side === 'left' ? 'fab-side-left' : ''}`}
				style={triggerStyle}
				aria-label="QA Knitto Recorder"
				aria-expanded={open}
				onClick={() => {
					setOpen((value) => !value);
					setSettingOpen(false);
				}}
			>
				<FabLogo />
			</button>
		</div>
	);
};
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { fabMenuForState, fabRootMenu, type FabIntent, type FabSettings } from './fab-state';
import { isFabStateChanged, openPanelWithIntent, requestFabState } from './fab-messaging';
import { saveFabSettings } from './fab-settings';
import { FabLogo } from './FabLogo';
import { fabIcons, recorderIcon } from './fab-icons';

const SIDEBAR_WIDTH = 500;

type FabView = 'root' | 'recorder' | 'setting';

interface FabAppProps {
	settings: FabSettings;
}

const rootIcons: Record<'recorder' | 'setting', React.ReactElement> = {
	recorder: recorderIcon,
	setting: fabIcons.setting
};

export const FabApp = (props: FabAppProps): React.ReactElement => {
	const [state, setState] = useState<'idle' | 'recording'>('idle');
	const stateRef = useRef<'idle' | 'recording'>('idle');
	const [pending, setPending] = useState(0);
	const [settings, setSettings] = useState<FabSettings>(props.settings);
	const [open, setOpen] = useState(false);
	const [view, setView] = useState<FabView>('root');
	const rootRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		let cancelled = false;
		void requestFabState().then((fabState) => {
			if (cancelled) return;
			const next = fabState.recording ? 'recording' : 'idle';
			setState(next);
			stateRef.current = next;
			setPending(fabState.pendingEvents);
		});
		const onMessage = (message: unknown): void => {
			if (!isFabStateChanged(message)) return;
			const next: 'idle' | 'recording' = message.state.recording ? 'recording' : 'idle';
			stateRef.current = next;
			setState(next);
			setPending(message.state.pendingEvents);
			// Interaktif: saat mulai rekaman langsung tampilkan sub-menu Recorder;
			// saat selesai kembali ke root. Sidebar tidak dipaksa menutup.
			setView(next === 'recording' ? 'recorder' : 'root');
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
				setView('root');
			}
		};
		document.addEventListener('keydown', onKeyDown);
		return () => document.removeEventListener('keydown', onKeyDown);
	}, [open]);

	const closeAll = useCallback(() => {
		setOpen(false);
		setView('root');
	}, []);

	const activate = useCallback(
		async (intent: FabIntent) => {
			setOpen(false);
			setView('root');
			await openPanelWithIntent(intent);
		},
		[]
	);

	const setSide = useCallback((side: 'left' | 'right') => {
		const next = { ...settings, side };
		setSettings(next);
		void saveFabSettings(next);
	}, [settings]);

	const backToRoot = useCallback(() => setView('root'), []);

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
				aria-label="Knitto QA Extension"
				style={sidebarStyle}
				data-open={open}
			>
				<div className="fab-sidebar-header">
					<span>Knitto QA Extension</span>
					{view !== 'root' ? (
						<button
							className="fab-sidebar-back"
							aria-label="Kembali ke menu utama"
							onClick={backToRoot}
						>
							←
						</button>
					) : null}
					<button className="fab-sidebar-close" aria-label="Tutup" onClick={closeAll}>
						✕
					</button>
				</div>
				<div className="fab-sidebar-body">
					{view === 'setting' ? (
						<div className="fab-setting-group">
							<span className="fab-setting-label">Pengaturan</span>
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
						</div>
					) : view === 'recorder' ? (
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
					) : (
						<div className="fab-menu-grid fab-menu-grid--root">
							{fabRootMenu.map((item) => (
								<button
									key={item.id}
									className="fab-menu-item"
									onClick={() => setView(item.id as FabView)}
								>
									<span className="fab-menu-icon">{rootIcons[item.id]}</span>
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
				aria-label="QA Knitto Extension"
				aria-expanded={open}
				onClick={() => {
					setOpen((value) => !value);
					// Buka langsung ke konten yang relevan: Recorder saat recording,
					// root saat idle — jangan minta user naik turun menu.
					setView(stateRef.current === 'recording' ? 'recorder' : 'root');
				}}
			>
				<FabLogo />
				{state === 'recording' ? (
					<span
						className="fab-rec-dot"
						aria-label={pending > 0 ? `${pending} event menunggu dikirim` : 'Recording aktif'}
					/>
				) : null}
			</button>
		</div>
	);
};
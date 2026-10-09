import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GroupScreencaster } from '../groupScreencast';

type Listener = (...args: any[]) => void;

const makeEvent = () => {
	const listeners = new Set<Listener>();
	return {
		addListener: (fn: Listener) => listeners.add(fn),
		removeListener: (fn: Listener) => listeners.delete(fn),
		fire: (...args: any[]) => listeners.forEach((fn) => fn(...args)),
		get size() {
			return listeners.size;
		}
	};
};

describe('GroupScreencaster (video replay multi-tab)', () => {
	const originalChrome = globalThis.chrome;
	let events: Record<string, ReturnType<typeof makeEvent>>;
	let commands: Array<{ tabId: number; method: string }>;
	let attached: number[];
	let detached: number[];
	const tabs: Record<number, chrome.tabs.Tab> = {
		1: { id: 1, groupId: 7, title: 'Checkout', url: 'https://app/checkout', active: true } as chrome.tabs.Tab,
		2: { id: 2, groupId: 7, title: 'Bayar', url: 'https://pay/x', active: false } as chrome.tabs.Tab
	};

	beforeEach(() => {
		events = {
			onEvent: makeEvent(),
			onDetach: makeEvent(),
			onActivated: makeEvent(),
			onUpdated: makeEvent(),
			onRemoved: makeEvent(),
			onCreated: makeEvent()
		};
		commands = [];
		attached = [];
		detached = [];
		(globalThis as any).chrome = {
			runtime: { lastError: undefined },
			debugger: {
				attach: (target: { tabId: number }, _v: string, cb: () => void) => {
					attached.push(target.tabId);
					cb();
				},
				detach: (target: { tabId: number }, cb: () => void) => {
					detached.push(target.tabId);
					cb();
				},
				sendCommand: (target: { tabId: number }, method: string, _p: unknown, cb: () => void) => {
					commands.push({ tabId: target.tabId, method });
					cb();
				},
				onEvent: events.onEvent,
				onDetach: events.onDetach
			},
			tabs: {
				get: vi.fn((id: number, cb?: (tab: chrome.tabs.Tab) => void) => (cb ? cb(tabs[id]) : Promise.resolve(tabs[id]))),
				query: vi.fn(async () => [tabs[1], tabs[2]]),
				onActivated: events.onActivated,
				onUpdated: events.onUpdated,
				onRemoved: events.onRemoved,
				onCreated: events.onCreated
			}
		};
	});

	afterEach(() => {
		globalThis.chrome = originalChrome;
	});

	it('screencast semua tab di group tab replay dan menandai tab awal sebagai aktif', async () => {
		const posted: Array<Record<string, unknown>> = [];
		const caster = new GroupScreencaster((message) => posted.push(message));
		await caster.start(1);

		expect(attached).toEqual([1, 2]);
		expect(commands.filter((c) => c.method === 'Page.startScreencast').map((c) => c.tabId)).toEqual([1, 2]);
		expect(posted[0]).toEqual({ type: 'OFFSCREEN_SET_ACTIVE_TAB', tabId: 1, title: 'Checkout', url: 'https://app/checkout' });
	});

	it('meneruskan frame bersama tabId, ack frame, dan mengikuti tab aktif', async () => {
		const posted: Array<Record<string, unknown>> = [];
		const caster = new GroupScreencaster((message) => posted.push(message));
		await caster.start(1);
		posted.length = 0;

		events.onEvent.fire({ tabId: 2 }, 'Page.screencastFrame', { sessionId: 3, data: 'BBB' });
		events.onEvent.fire({ tabId: 99 }, 'Page.screencastFrame', { sessionId: 1, data: 'X' });
		events.onActivated.fire({ tabId: 2, windowId: 1 });
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(commands).toContainEqual({ tabId: 2, method: 'Page.screencastFrameAck' });
		expect(posted).toEqual([
			{ type: 'OFFSCREEN_ADD_FRAME', tabId: 2, data: 'BBB' },
			{ type: 'OFFSCREEN_SET_ACTIVE_TAB', tabId: 2, title: 'Bayar', url: 'https://pay/x' }
		]);
		expect(caster.activeTabId).toBe(2);
	});

	it('tab baru yang masuk group ikut di-screencast; stop melepas semua tab dan listener', async () => {
		const caster = new GroupScreencaster(() => {});
		await caster.start(1);
		events.onUpdated.fire(3, { groupId: 7 }, { id: 3, groupId: 7, active: false });
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(caster.attachedTabIds).toEqual([1, 2, 3]);

		await caster.stop();
		expect(detached).toEqual([1, 2, 3]);
		expect(events.onEvent.size).toBe(0);
		expect(events.onActivated.size).toBe(0);
	});
});

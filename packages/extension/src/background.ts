/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { debugLog } from './relayConnection';
import { PendingConnections } from './pendingConnection';
import { ConnectedTabGroup, cleanupStalePlaywrightGroups, isNonDebuggableUrl, ungroupTabs, uniqueGroupStyle } from './connectedTabGroup';
import { RecordingController } from './recording/recorder';
import { getToken } from './recording/tokenStore';
import { executeReplay, type ReplayOptions } from './recording/replayEngine';
import { captureBrowserStorageState, type PlaywrightStorageState } from './recording/storageStateCapture';

type PageMessage = {
  type: 'connectionRequested';
  mcpRelayUrl: string;
} | {
  type: 'getTabs';
} | {
  type: 'connectToTab';
  // Picked in the connect page; absent on the token-bypass path where no tab
  // selection happens.
  tab?: chrome.tabs.Tab;
  clientName?: string;
} | {
  type: 'getConnectionStatus';
} | {
  type: 'disconnect';
  connectionId: number;
} | {
  type: 'keepalive';
} | {
  type: 'recordingStart';
  idSession: number;
  apiBaseUrl: string;
  tabIds: number[];
  recordVideo?: boolean;
} | {
  type: 'recordingStop';
} | {
  type: 'recordingStatus';
} | {
  type: 'replay:run';
  options: ReplayOptions;
} | {
  type: 'tabVideo:start';
  tabId?: number;
} | {
  type: 'tabVideo:stop';
} | {
  type: 'fab:getState';
} | {
  type: 'fab:openPanel';
  intent: 'start' | 'checkpoint' | 'end' | 'generate' | 'panel';
} | {
  type: 'fetchSpreadsheetCsv';
  url: string;
} | {
  type: 'cleaner:hardReload';
  tabId?: number;
} | {
  type: 'cleaner:clearCookies';
  url: string;
} | {
  type: 'cleaner:clearStorageAndCache';
  origin: string;
} | {
  type: 'cleaner:cleanAll';
  url: string;
  tabId?: number;
} | {
  type: 'sessionVideo:upload';
  idSession: number;
  apiBaseUrl: string;
  videoDataUrl: string;
} | {
  type: 'storageState:capture';
  targetUrl?: string;
  tabId?: number;
  phase?: 'initial' | 'final' | 'checkpoint';
} | {
  type: 'storageState:upload';
  idSession: number;
  apiBaseUrl: string;
  storageState: PlaywrightStorageState;
} | {
  type: 'api:request';
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  bodyBase64?: string;
} | {
  type: 'media:fetchBlobUrl';
  url: string;
  apiBaseUrl?: string;
  sessionId?: number;
};

class PlaywrightExtension {
  private _connections = new Map<number, ConnectedTabGroup>();
  private _lastConnectionId = 0;
  private _pendingConnections = new PendingConnections();
  // Service worker restarts lose all connection state, so any existing
  // Playwright groups are stale. Connections wait on this before reconciling.
  private _cleanupPromise: Promise<void>;
  private _recorder = new RecordingController();
  private _currentSessionId: number | null = null;
  private _currentApiBaseUrl: string | null = null;

  constructor() {
    chrome.runtime.onMessage.addListener(this._onMessage.bind(this));
    chrome.action.onClicked.addListener(this._onActionClicked.bind(this));
    this._cleanupPromise = cleanupStalePlaywrightGroups();
  }

  // Promise-based message handling is not supported in Chrome: https://issues.chromium.org/issues/40753031
  private _onMessage(message: PageMessage, sender: chrome.runtime.MessageSender, sendResponse: (response: any) => void) {
    if ((message as any)?.target === 'offscreen') {
      return false;
    }
    switch (message.type) {
      case 'connectionRequested': {
        const selectorTabId = sender.tab!.id!;
        this._releaseConnectPage(selectorTabId).then(() => {
          this._pendingConnections.create(selectorTabId, message.mcpRelayUrl);
          sendResponse({ success: true });
        });
        return true;
      }
      case 'getTabs':
        this._getTabs(sender.tab?.id).then(
            tabs => sendResponse({ success: true, tabs, currentTabId: sender.tab?.id }),
            (error: any) => sendResponse({ success: false, error: error.message }));
        return true;
      case 'connectToTab': {
        // Token-bypass (no specific pick) falls back to the connect page itself
        // so `ConnectedTabGroup` always has a concrete tab to start from. Both
        // sender.tab and UI-supplied tabs come from chrome.tabs.query / runtime
        // message sender, where `id` is always defined.
        const selectedTab = (message.tab ?? sender.tab!) as chrome.tabs.Tab & { id: number };
        this._connectTab(sender.tab!.id!, selectedTab, message.clientName).then(
            () => sendResponse({ success: true }),
            (error: any) => sendResponse({ success: false, error: error.message }));
        return true; // Return true to indicate that the response will be sent asynchronously
      }
      case 'getConnectionStatus':
        sendResponse({
          connections: [...this._connections].map(([id, group]) => ({
            id,
            clientName: group.clientName,
            connectedTabIds: group.connectedTabIds(),
          })),
        });
        return false;
      case 'disconnect':
        this._connections.get(message.connectionId)?.close('User disconnected');
        sendResponse({ success: true });
        return false;
      case 'keepalive':
        // Connect page pings us every ~20s so receiving this message resets
        // the MV3 service worker idle timer and keeps the relay WebSocket alive.
        return false;
      case 'recordingStart': {
        const tabIds = (message.tabIds && message.tabIds.length > 0)
          ? message.tabIds
          : (sender.tab?.id ? [sender.tab.id] : []);
        this._startRecording(message.idSession, message.apiBaseUrl, tabIds, message.recordVideo !== false).then(
            groupId => sendResponse({ success: true, groupId }),
            (error: any) => sendResponse({ success: false, error: error.message }));
        return true;
      }
      case 'recordingStop':
        this._recorder.stop().then(
            async () => {
              this._broadcastFabState();
              const videoDataUrl = await this._stopTabVideoRecording();
              let videoUrl: string | null = null;
              let finalStorageState: PlaywrightStorageState | null = null;

              const sid = this._currentSessionId;
              const apiBase = this._currentApiBaseUrl;

              if (sid && apiBase) {
                // 1. Upload Video if available
                if (videoDataUrl) {
                  try {
                    videoUrl = await this._uploadSessionVideoFromBackground(sid, apiBase, videoDataUrl);
                  } catch (uploadErr) {
                    debugLog('Gagal upload video dari background:', uploadErr);
                  }
                }

                // 2. Capture and Upload Final Storage State
                try {
                  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true }).catch(() => []);
                  if (activeTab?.url) {
                    finalStorageState = await captureBrowserStorageState({
                      targetUrl: activeTab.url,
                      tabId: activeTab.id,
                      phase: 'final'
                    });
                    if (finalStorageState) {
                      await this._uploadStorageStateFromBackground(sid, apiBase, finalStorageState);
                    }
                  }
                } catch (stateErr) {
                  debugLog('Gagal capture final storage state:', stateErr);
                }
              }

              this._currentSessionId = null;
              this._currentApiBaseUrl = null;
              sendResponse({
                success: true,
                videoDataUrl,
                videoUrl,
                storageState: finalStorageState,
                idSession: sid
              });
            },
            (error: any) => sendResponse({ success: false, error: error.message }));
        return true;
      case 'sessionVideo:upload': {
        this._uploadSessionVideoFromBackground(message.idSession, message.apiBaseUrl, message.videoDataUrl)
          .then((videoUrl) => sendResponse({ success: true, videoUrl }))
          .catch((err) => sendResponse({ success: false, error: (err as Error).message }));
        return true;
      }
      case 'storageState:capture': {
        const tabId = message.tabId ?? sender.tab?.id;
        const targetUrl = message.targetUrl ?? sender.tab?.url ?? '';
        captureBrowserStorageState({
          targetUrl,
          tabId,
          phase: message.phase || 'final'
        })
          .then((storageState) => sendResponse({ success: true, storageState }))
          .catch((err) => sendResponse({ success: false, error: (err as Error).message }));
        return true;
      }
      case 'storageState:upload': {
        this._uploadStorageStateFromBackground(message.idSession, message.apiBaseUrl, message.storageState)
          .then(() => sendResponse({ success: true }))
          .catch((err) => sendResponse({ success: false, error: (err as Error).message }));
        return true;
      }
      case 'replay:run': {
        const replayOpts = {
          ...message.options,
          onTabReady: async (tabId: number) => {
            try {
              await this._startTabVideoRecording(tabId);
            } catch (err) {
              debugLog('Gagal start video recording saat replay:', err);
            }
          }
        };

        (async () => {
          try {
            const result = await executeReplay(replayOpts);
            let videoDataUrl: string | null = null;
            let videoUrl: string | null = null;

            try {
              videoDataUrl = await this._stopTabVideoRecording();
            } catch (stopErr) {
              debugLog('Gagal stop tab video recording saat replay:', stopErr);
            }

            const targetApiBaseUrl = message.options?.apiBaseUrl || this._currentApiBaseUrl;
            if (videoDataUrl && message.options?.sessionId && targetApiBaseUrl) {
              try {
                videoUrl = await this._uploadSessionVideoFromBackground(
                  message.options.sessionId,
                  targetApiBaseUrl,
                  videoDataUrl
                );
              } catch (uploadErr) {
                debugLog('Gagal upload video replay:', uploadErr);
              }
            }

            sendResponse({
              success: result.success,
              result,
              videoDataUrl,
              videoUrl
            });
          } catch (error: any) {
            try {
              await this._stopTabVideoRecording();
            } catch {
              // Ignore
            }
            sendResponse({ success: false, error: error.message });
          }
        })();
        return true;
      }
      case 'tabVideo:start':
        this._startTabVideoRecording(message.tabId ?? sender.tab?.id ?? 0).then(
            ok => sendResponse({ success: ok }),
            (error: any) => sendResponse({ success: false, error: error.message }));
        return true;
      case 'tabVideo:stop':
        this._stopTabVideoRecording().then(
            dataUrl => sendResponse({ success: true, dataUrl }),
            (error: any) => sendResponse({ success: false, error: error.message }));
        return true;
      case 'recordingStatus':
        sendResponse({
          recording: this._recorder.isRecording,
          pendingEvents: this._recorder.pendingEventCount,
        });
        return false;
      case 'fab:getState':
        sendResponse({
          recording: this._recorder.isRecording,
          pendingEvents: this._recorder.pendingEventCount,
        });
        return false;
      case 'fetchSpreadsheetCsv': {
        fetch(message.url)
          .then(async (res) => {
            if (res.status === 401 || res.status === 403 || (res.redirected && res.url.includes('accounts.google.com'))) {
              sendResponse({
                success: false,
                error: 'Spreadsheet tidak dapat diakses. Pastikan spreadsheet disetel ke "Anyone with the link can view" (Siapa saja yang memiliki link dapat melihat / Public Read-Only).'
              });
              return;
            }
            if (!res.ok) {
              sendResponse({
                success: false,
                error: `Gagal mengunduh spreadsheet (HTTP ${res.status}). Pastikan URL benar.`
              });
              return;
            }
            const text = await res.text();
            if (text.includes('<!DOCTYPE html>') || text.includes('<html')) {
              sendResponse({
                success: false,
                error: 'Spreadsheet meminta login Google. Pastikan izin akses disetel ke "Anyone with the link can view" (Public Read-Only).'
              });
              return;
            }
            sendResponse({ success: true, csv: text });
          })
          .catch((err) => {
            sendResponse({ success: false, error: (err as Error).message || 'Gagal mengambil data dari Google Sheets.' });
          });
        return true;
      }
      case 'cleaner:hardReload': {
        this._getActiveTabId(message.tabId)
          .then(async (tabId) => {
            if (!tabId) {
              sendResponse({ success: false, error: 'Tab aktif tidak ditemukan.' });
              return;
            }
            await chrome.tabs.reload(tabId, { bypassCache: true });
            sendResponse({ success: true });
          })
          .catch((err) => {
            sendResponse({ success: false, error: (err as Error).message || 'Gagal memuat ulang tab.' });
          });
        return true;
      }
      case 'cleaner:clearCookies': {
        if (!message.url) {
          sendResponse({ success: false, error: 'URL tab tidak valid.' });
          return false;
        }
        this._clearCookiesForUrl(message.url)
          .then((count) => sendResponse({ success: true, count }))
          .catch((err) => sendResponse({ success: false, error: (err as Error).message || 'Gagal menghapus cookies.' }));
        return true;
      }
      case 'cleaner:clearStorageAndCache': {
        if (!message.origin) {
          sendResponse({ success: false, error: 'Origin domain tidak valid.' });
          return false;
        }
        this._clearStorageAndCacheForOrigin(message.origin)
          .then(() => sendResponse({ success: true }))
          .catch((err) => sendResponse({ success: false, error: (err as Error).message || 'Gagal menghapus storage dan cache.' }));
        return true;
      }
      case 'cleaner:cleanAll': {
        (async () => {
          if (!message.url) throw new Error('URL tab tidak valid.');
          const urlObj = new URL(message.url);
          const origin = urlObj.origin;
          await Promise.all([
            this._clearCookiesForUrl(message.url),
            this._clearStorageAndCacheForOrigin(origin)
          ]);
          const tabId = await this._getActiveTabId(message.tabId);
          if (tabId) {
            await chrome.tabs.reload(tabId, { bypassCache: true });
          }
        })()
          .then(() => sendResponse({ success: true }))
          .catch((err) => sendResponse({ success: false, error: (err as Error).message || 'Gagal membersihkan data.' }));
        return true;
      }
      case 'api:request': {
        (async () => {
          let reqBody: BodyInit | undefined = message.body;
          if (message.bodyBase64) {
            const binaryStr = atob(message.bodyBase64);
            const bytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) {
              bytes[i] = binaryStr.charCodeAt(i);
            }
            reqBody = bytes;
          }
          const response = await fetch(message.url, {
            method: message.method || 'GET',
            headers: message.headers,
            body: reqBody
          });
          const text = await response.text();
          const headers: [string, string][] = [];
          response.headers.forEach((val, key) => {
            headers.push([key, val]);
          });
          return {
            success: true,
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
            headers,
            body: text
          };
        })()
          .then((result) => sendResponse(result))
          .catch((err) => sendResponse({ success: false, error: (err as Error).message || 'Gagal melakukan request network via background proxy.' }));
        return true;
      }
      case 'media:fetchBlobUrl': {
        (async () => {
          try {
            let fetchUrl = message.url;
            const targetApiBase = message.apiBaseUrl || this._currentApiBaseUrl;
            if (targetApiBase && (fetchUrl.includes('127.0.0.1:9000') || fetchUrl.includes('localhost:9000'))) {
              try {
                const apiHost = new URL(targetApiBase).hostname;
                if (apiHost && apiHost !== '127.0.0.1' && apiHost !== 'localhost') {
                  fetchUrl = fetchUrl.replace('127.0.0.1:9000', `${apiHost}:9000`).replace('localhost:9000', `${apiHost}:9000`);
                }
              } catch {
                // Ignore URL parse error
              }
            }

            let res: Response | null = null;

            // Prioritize backend streaming endpoint if sessionId & targetApiBase are available
            if (targetApiBase && message.sessionId) {
              const streamUrl = `${targetApiBase.replace(/\/+$/, '')}/sessions/${message.sessionId}/video/stream`;
              try {
                const streamRes = await fetch(streamUrl);
                if (streamRes.ok) {
                  res = streamRes;
                }
              } catch {
                // Ignore stream error and fallback to direct fetchUrl
              }
            }

            // Fallback to direct MinIO URL if stream endpoint did not succeed
            if (!res && fetchUrl) {
              try {
                const directRes = await fetch(fetchUrl);
                if (directRes.ok) {
                  res = directRes;
                }
              } catch {
                // Ignore direct fetch error
              }
            }

            if (!res || !res.ok) {
              throw new Error(`Gagal memuat file media`);
            }

            const blob = await res.blob();
            const buffer = await blob.arrayBuffer();
            const bytes = new Uint8Array(buffer);
            let binary = '';
            const chunkSize = 8192;
            for (let i = 0; i < bytes.length; i += chunkSize) {
              binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
            }
            const base64 = btoa(binary);
            const mimeType = blob.type || 'video/webm';
            const dataUrl = `data:${mimeType};base64,${base64}`;
            sendResponse({ success: true, dataUrl, size: blob.size });
          } catch (err) {
            sendResponse({ success: false, error: (err as Error).message });
          }
        })();
        return true;
      }
    }
  }

  private async _getActiveTabId(tabId?: number): Promise<number | undefined> {
    if (tabId && tabId > 0) return tabId;
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      return tab?.id;
    } catch {
      return undefined;
    }
  }

  private async _clearCookiesForUrl(targetUrl: string): Promise<number> {
    if (!chrome.cookies) return 0;
    const urlObj = new URL(targetUrl);
    const domain = urlObj.hostname;

    const [byUrl, byDomain] = await Promise.all([
      chrome.cookies.getAll({ url: targetUrl }),
      chrome.cookies.getAll({ domain })
    ]);

    const map = new Map<string, chrome.cookies.Cookie>();
    for (const c of [...byUrl, ...byDomain]) {
      map.set(`${c.domain}:${c.path}:${c.name}:${c.storeId}`, c);
    }

    let removed = 0;
    for (const cookie of map.values()) {
      const protocol = cookie.secure ? 'https:' : 'http:';
      const cleanDomain = cookie.domain.startsWith('.') ? cookie.domain.slice(1) : cookie.domain;
      const cookieUrl = `${protocol}//${cleanDomain}${cookie.path}`;
      try {
        await chrome.cookies.remove({
          url: cookieUrl,
          name: cookie.name,
          storeId: cookie.storeId
        });
        removed++;
      } catch {
        // Abaikan kegagalan individual cookie
      }
    }
    return removed;
  }

  private async _clearStorageAndCacheForOrigin(origin: string): Promise<void> {
    if (!chrome.browsingData) return;
    await chrome.browsingData.remove(
      { origins: [origin] },
      {
        cache: true,
        fileSystems: true,
        indexedDB: true,
        localStorage: true,
        serviceWorkers: true,
        webSQL: true
      }
    );
  }

  private _isVideoRecordingActive = false;

  private async _ensureOffscreenDocument(): Promise<void> {
    if (!chrome.offscreen) return;
    try {
      if (typeof chrome.offscreen.hasDocument === 'function') {
        const has = await chrome.offscreen.hasDocument();
        if (has) return;
      }
      const offscreenUrl = chrome.runtime?.getURL ? chrome.runtime.getURL('offscreen.html') : 'offscreen.html';
      await chrome.offscreen.createDocument({
        url: offscreenUrl,
        reasons: ['USER_MEDIA'],
        justification: 'Recording tab stream for QA evidence'
      });
    } catch (err) {
      debugLog('Offscreen document error:', err);
    }
  }

  private async _pingOffscreen(maxAttempts = 8): Promise<boolean> {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const res = await new Promise<any>((resolve) => {
          if (!chrome.runtime?.sendMessage) return resolve(null);
          chrome.runtime.sendMessage({ target: 'offscreen', type: 'OFFSCREEN_PING' }, (resp) => {
            if (chrome.runtime?.lastError) {
              resolve(null);
            } else {
              resolve(resp);
            }
          });
        });
        if (res?.pong) return true;
      } catch {
        // Retry
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    return false;
  }

  private async _closeOffscreenDocument(): Promise<void> {
    if (!chrome.offscreen) return;
    try {
      if (typeof chrome.offscreen.hasDocument === 'function') {
        const has = await chrome.offscreen.hasDocument();
        if (!has) return;
      }
      await chrome.offscreen.closeDocument();
    } catch (err) {
      debugLog('Close offscreen error:', err);
    }
  }

  private async _startTabVideoRecording(targetTabId: number): Promise<boolean> {
    try {
      await this._ensureOffscreenDocument();
      const isOffscreenReady = await this._pingOffscreen();
      if (!isOffscreenReady) {
        debugLog('Offscreen document belum merespon ping, mencoba melanjutkan...');
      }

      let streamId: string | null = null;
      if (chrome.tabCapture && typeof chrome.tabCapture.getMediaStreamId === 'function') {
        streamId = await new Promise<string | null>((resolve) => {
          try {
            chrome.tabCapture.getMediaStreamId({ targetTabId }, (id) => {
              if (chrome.runtime?.lastError) {
                debugLog('tabCapture.getMediaStreamId note:', chrome.runtime.lastError.message, '- fallback ke CDP screencast');
                resolve(null);
              } else {
                resolve(id || null);
              }
            });
          } catch (err) {
            debugLog('tabCapture.getMediaStreamId exception:', err, '- fallback ke CDP screencast');
            resolve(null);
          }
        });
      }

      let startRes: any = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        startRes = await new Promise<any>((resolve) => {
          chrome.runtime.sendMessage(
            {
              target: 'offscreen',
              type: 'OFFSCREEN_START_RECORDING',
              streamId
            },
            (response) => {
              if (chrome.runtime?.lastError) {
                resolve(null);
              } else {
                resolve(response);
              }
            }
          );
        });
        if (startRes?.success) break;
        await new Promise((r) => setTimeout(r, 150));
      }

      this._isVideoRecordingActive = Boolean(startRes?.success);
      debugLog('Perekaman video tab status:', this._isVideoRecordingActive, startRes?.mode ? `[mode: ${startRes.mode}]` : '');
      return this._isVideoRecordingActive;
    } catch (err) {
      debugLog('Gagal memulai perekaman video tab:', err);
      return false;
    }
  }

  private async _stopTabVideoRecording(): Promise<string | null> {
    if (!this._isVideoRecordingActive) {
      debugLog('Perekaman video tidak aktif saat recordingStop.');
      return null;
    }
    this._isVideoRecordingActive = false;
    try {
      const res = await new Promise<any>((resolve) => {
        const timeout = setTimeout(() => {
          debugLog('Timeout menunggu stop video recording dari offscreen.');
          resolve({ success: false, dataUrl: null });
        }, 8000);

        chrome.runtime.sendMessage(
          {
            target: 'offscreen',
            type: 'OFFSCREEN_STOP_RECORDING'
          },
          (response) => {
            clearTimeout(timeout);
            resolve(response ?? { success: true, dataUrl: null });
          }
        );
      });
      await this._closeOffscreenDocument();
      const videoDataUrl = (res?.dataUrl as string) ?? null;
      debugLog('Hasil perekaman video didapat:', videoDataUrl ? `Ada (${res?.size || 0} bytes)` : 'Kosong');
      return videoDataUrl;
    } catch (err) {
      debugLog('Gagal menghentikan perekaman video tab:', err);
      await this._closeOffscreenDocument();
      return null;
    }
  }

  private async _uploadSessionVideoFromBackground(
    sessionId: number,
    apiBaseUrl: string,
    videoDataUrl: string
  ): Promise<string | null> {
    try {
      const token = await getToken();
      const cleanBaseUrl = apiBaseUrl.replace(/\/+$/, '');

      const base64Data = videoDataUrl.includes(',') ? videoDataUrl.split(',')[1] : videoDataUrl;
      const mimeMatch = videoDataUrl.match(/^data:([^;]+);/);
      const contentType = mimeMatch ? mimeMatch[1] : 'video/webm';

      // 1. Coba Direct API Upload terlebih dahulu (satu request aman ke port API 8010 tanpa presign S3 host issue)
      try {
        const directUploadRes = await fetch(`${cleanBaseUrl}/sessions/${sessionId}/video/upload`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': token ? `Bearer ${token}` : ''
          },
          body: JSON.stringify({
            video_base64: base64Data,
            content_type: contentType
          })
        });

        if (directUploadRes.ok) {
          const directData = await directUploadRes.json();
          const resObj = directData?.result ?? directData;
          if (resObj?.video_url) {
            debugLog('Direct video upload sukses:', resObj.video_url);
            return resObj.video_url;
          }
        }
      } catch (directErr) {
        debugLog('Direct video upload failed, trying fallback presign:', directErr);
      }

      // 2. Fallback ke Presigned URL upload jika direct upload tidak tersedia
      const binaryStr = atob(base64Data);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: contentType });

      // 1. Presign
      const presignRes = await fetch(`${cleanBaseUrl}/sessions/${sessionId}/video/presign-upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ size_bytes: blob.size, content_type: contentType })
      });
      if (!presignRes.ok) {
        const errJson = await presignRes.json().catch(() => ({}));
        throw new Error(errJson.message || `Presign video failed HTTP ${presignRes.status}`);
      }
      const presignData = await presignRes.json();
      const presign = presignData?.result ?? presignData;
      if (!presign?.upload_url || !presign?.object_key) {
        throw new Error('Upload URL atau object_key tidak ditemukan dalam respon presign');
      }

      // 2. PUT to MinIO
      const minioPutRes = await fetch(presign.upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: blob
      });
      if (!minioPutRes.ok) {
        throw new Error(`MinIO video PUT failed HTTP ${minioPutRes.status}`);
      }

      // 3. Complete
      const completeRes = await fetch(`${cleanBaseUrl}/sessions/${sessionId}/video/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ object_key: presign.object_key })
      });
      if (!completeRes.ok) {
        const errJson = await completeRes.json().catch(() => ({}));
        throw new Error(errJson.message || `Complete video failed HTTP ${completeRes.status}`);
      }
      const completeData = await completeRes.json();
      const complete = completeData?.result ?? completeData;
      debugLog('Presigned video upload sukses:', complete?.video_url);
      return complete?.video_url || null;
    } catch (err) {
      debugLog('Gagal upload video dari background:', (err as Error).message);
      return null;
    }
  }

  private async _uploadStorageStateFromBackground(
    sessionId: number,
    apiBaseUrl: string,
    storageState: PlaywrightStorageState
  ): Promise<void> {
    try {
      const token = await getToken();
      const cleanBaseUrl = apiBaseUrl.replace(/\/+$/, '');
      const jsonStr = JSON.stringify(storageState, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });

      // 1. Presign
      const presignRes = await fetch(`${cleanBaseUrl}/sessions/${sessionId}/artifacts/presign-upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          kind: 'storage_state',
          content_type: 'application/json',
          size_bytes: blob.size
        })
      });
      if (!presignRes.ok) return;
      const presignData = await presignRes.json();
      const presign = presignData?.result ?? presignData;
      const uploadUrl = presign?.upload_url;
      const artifactId = presign?.artifact?.id_artifact;
      if (!uploadUrl || !artifactId) return;

      // 2. PUT
      const minioPutRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: blob
      });
      if (!minioPutRes.ok) return;

      // 3. Complete
      await fetch(`${cleanBaseUrl}/sessions/${sessionId}/artifacts/${artifactId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ size_bytes: blob.size })
      });
    } catch (err) {
      debugLog('Gagal upload storage state artifact:', err);
    }
  }

  private async _startRecording(idSession: number, apiBaseUrl: string, tabIds: number[], recordVideo = true): Promise<number> {
    if (this._recorder.isRecording)
      throw new Error('Recording sudah berjalan.');

    if (tabIds.length === 0) throw new Error('Tidak ada tab untuk direkam.');
    this._currentSessionId = idSession;
    this._currentApiBaseUrl = apiBaseUrl;

    const groupId = await chrome.tabs.group({ tabIds: tabIds as [number, ...number[]] });
    await chrome.tabGroups.update(groupId, { title: 'Knitto QA', color: 'blue' });

    if (recordVideo && tabIds[0]) {
      try {
        await this._startTabVideoRecording(tabIds[0]);
      } catch (err) {
        debugLog('Gagal inisialisasi perekaman video tab:', err);
      }
    }

    // Capture initial storage state asynchronously
    (async () => {
      try {
        if (tabIds[0]) {
          const tab = await chrome.tabs.get(tabIds[0]);
          if (tab?.url && !isNonDebuggableUrl(tab.url)) {
            const initialStorage = await captureBrowserStorageState({
              targetUrl: tab.url,
              tabId: tabIds[0],
              phase: 'initial'
            });
            if (initialStorage) {
              await this._uploadStorageStateFromBackground(idSession, apiBaseUrl, initialStorage);
            }
          }
        }
      } catch (err) {
        debugLog('Gagal capture initial storage state:', err);
      }
    })();

    await this._recorder.start({
      idSession,
      apiBaseUrl,
      getToken,
      recordingGroupId: groupId,
      recordVideo: recordVideo !== false
    });

    this._broadcastFabState();
    return groupId;
  }

  private async _connectTab(selectorTabId: number, tab: chrome.tabs.Tab & { id: number }, clientName: string | undefined): Promise<void> {
    try {
      await this._cleanupPromise;
      this._releaseTab(selectorTabId);
      if (tab.id !== selectorTabId && this._connectedTabIds().has(tab.id))
        throw new Error('This tab is already connected to another client');

      const connection = await this._pendingConnections.take(selectorTabId);
      if (!connection)
        throw new Error('Pending client connection closed');

      const id = ++this._lastConnectionId;
      const taken = [...this._connections.values()].map(group => group.groupStyle);
      const group = new ConnectedTabGroup(connection, tab, clientName, uniqueGroupStyle(clientName, taken), tabId => this._pendingConnections.has(tabId));
      group.onclose = () => this._connections.delete(id);
      this._connections.set(id, group);

      await Promise.all([
        chrome.tabs.update(tab.id, { active: true }),
        chrome.windows.update(tab.windowId, { focused: true }),
      ]).catch(() => {});

      if (tab.id !== selectorTabId)
        await chrome.tabs.remove(selectorTabId).catch(() => {});
    } catch (error: any) {
      debugLog(`Failed to connect tab ${tab.id}:`, error.message);
      throw error;
    }
  }

  // Chrome may create the connect page inside the active client's group.
  private async _releaseConnectPage(tabId: number): Promise<void> {
    this._releaseTab(tabId);
    await ungroupTabs([tabId]);
  }

  private _releaseTab(tabId: number): void {
    for (const group of this._connections.values())
      group.releaseTab(tabId);
  }

  private async _getTabs(selectorTabId: number | undefined): Promise<chrome.tabs.Tab[]> {
    const tabs = await chrome.tabs.query({});
    const connectedTabIds = this._connectedTabIds();
    return tabs.filter(tab => !isNonDebuggableUrl(tab.url) && (tab.id === selectorTabId || !connectedTabIds.has(tab.id!)));
  }

  private _connectedTabIds(): Set<number> {
    return new Set([...this._connections.values()].flatMap(group => group.connectedTabIds()));
  }

  private _broadcastFabState(): void {
    const state = {
      recording: this._recorder.isRecording,
      pendingEvents: this._recorder.pendingEventCount,
    };
    void chrome.tabs.query({}).then((tabs) => {
      for (const tab of tabs) {
        if (typeof tab.id !== 'number') continue;
        chrome.tabs.sendMessage(tab.id, { type: 'fab:stateChanged', state }).catch(() => {});
      }
    });
  }

  private async _onActionClicked(): Promise<void> {
    await chrome.tabs.create({
      url: chrome.runtime.getURL('status.html'),
      active: true
    });
  }
}

new PlaywrightExtension();

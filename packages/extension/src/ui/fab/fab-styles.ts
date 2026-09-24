/**
 * CSS FAB — Modern Knitto Navy SaaS Design System
 * Di-adopt via adoptedStyleSheets di dalam Shadow DOM.
 * Terisolasi penuh dari stylesheet halaman host.
 */

const NAVY = '#2F3574';
const NAVY_HOVER = '#23285c';
const NAVY_ACTIVE = '#1a1e46';
const NAVY_LIGHT = '#f0f2fb';
const NAVY_BORDER = '#d7dcf0';

export const FAB_CSS = `
/* ===== Base & Reset ===== */
*, *::before, *::after {
  box-sizing: border-box;
}

.fab-root {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  font-size: 13px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #0f172a;
}

/* ===== FAB Trigger Button ===== */
.fab-trigger {
  position: fixed;
  top: 40%;
  width: 48px;
  height: 48px;
  border-radius: 12px 0 0 12px;
  border: 1px solid rgba(47, 53, 116, 0.25);
  border-right: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #ffffff;
  box-shadow: 0 8px 24px -4px rgba(15, 23, 42, 0.2), 0 4px 12px -2px rgba(15, 23, 42, 0.12);
  padding: 0;
  z-index: 10000;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.fab-trigger:hover {
  transform: translateY(-2px) scale(1.03);
  box-shadow: 0 12px 28px -4px rgba(47, 53, 116, 0.3);
}
.fab-trigger:focus-visible {
  outline: 2px solid ${NAVY};
  outline-offset: 2px;
}
.fab-trigger.fab-side-left {
  border-radius: 0 12px 12px 0;
  border-right: 1px solid rgba(47, 53, 116, 0.25);
  border-left: none;
}
.fab-logo-wrap {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}
.fab-qa-badge {
  position: absolute;
  right: -8px;
  bottom: -6px;
  min-width: 19px;
  height: 19px;
  border-radius: 9999px;
  background: #f59e0b;
  color: #fff;
  border: 2px solid #fff;
  font-size: 9px;
  font-weight: 800;
  line-height: 15px;
  text-align: center;
  letter-spacing: 0.2px;
  padding: 0 3px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
}
.fab-rec-dot {
  position: absolute;
  top: -3px;
  right: -3px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #ef4444;
  border: 2px solid #fff;
  box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.3);
  animation: fab-pulse 1.6s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
@keyframes fab-pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.2); opacity: 0.7; }
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.k-spin {
  animation: spin 1s linear infinite;
  display: inline-block;
}

/* ===== Backdrop ===== */
.fab-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(2px);
  z-index: 9997;
  border: none;
  width: 100%;
  height: 100%;
  animation: fab-fade-in 0.2s ease-out;
}
@keyframes fab-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* ===== Sidebar Shell ===== */
.fab-sidebar {
  position: fixed;
  top: 0;
  bottom: 0;
  width: 520px;
  min-width: 400px;
  max-width: 95vw;
  background: #f8fafc;
  box-shadow: -8px 0 32px rgba(15, 23, 42, 0.18);
  z-index: 9998;
  transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-left: 1px solid #cbd5e1;
}
.fab-root[data-side="left"] .fab-sidebar {
  border-left: none;
  border-right: 1px solid #cbd5e1;
  box-shadow: 8px 0 32px rgba(15, 23, 42, 0.18);
}

/* ===== Resizable Sidebar Handle ===== */
.fab-sidebar-resizer {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 14px;
  z-index: 9999;
  cursor: ew-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  touch-action: none;
  user-select: none;
}
.fab-root[data-side="right"] .fab-sidebar-resizer {
  left: -7px;
}
.fab-root[data-side="left"] .fab-sidebar-resizer {
  right: -7px;
}
.fab-sidebar-resizer-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: transparent;
  transition: background 0.15s ease;
}
.fab-sidebar-resizer-grip {
  position: relative;
  width: 4px;
  height: 36px;
  border-radius: 9999px;
  background: #94a3b8;
  transition: all 0.15s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
}
.fab-sidebar-resizer:hover .fab-sidebar-resizer-line,
.fab-sidebar-resizer.active .fab-sidebar-resizer-line {
  background: ${NAVY};
}
.fab-sidebar-resizer:hover .fab-sidebar-resizer-grip,
.fab-sidebar-resizer.active .fab-sidebar-resizer-grip {
  background: ${NAVY};
  height: 52px;
  box-shadow: 0 0 0 2px rgba(47, 53, 116, 0.2);
}

/* ===== Sidebar Header ===== */
.fab-sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  color: ${NAVY};
  font-weight: 700;
  font-size: 15px;
  letter-spacing: -0.2px;
  flex: 0 0 auto;
}
.fab-sidebar-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}
.fab-sidebar-title {
  display: flex;
  align-items: center;
  gap: 8px;
}
.fab-sidebar-close,
.fab-sidebar-back {
  border: none;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  transition: all 0.15s ease;
  padding: 0;
}
.fab-sidebar-close:hover,
.fab-sidebar-back:hover {
  background: ${NAVY_LIGHT};
  color: ${NAVY};
}
.fab-sidebar-close:focus-visible,
.fab-sidebar-back:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px #ffffff, 0 0 0 4px ${NAVY};
}
.fab-sidebar-close:active,
.fab-sidebar-back:active {
  transform: scale(0.94);
}

/* ===== Sidebar Body & Footer ===== */
.fab-sidebar-body {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* ===== Modern Navigation Rail Layout ===== */
.fab-layout {
  position: relative;
  display: flex;
  flex-direction: row;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #ffffff;
}

.fab-rail-spacer {
  width: 56px;
  flex: 0 0 56px;
  visibility: hidden;
  pointer-events: none;
}

.fab-rail {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 56px;
  background: #f8fafc;
  border-right: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: space-between;
  padding: 14px 8px;
  box-sizing: border-box;
  user-select: none;
  z-index: 30;
  transition: width 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease;
  overflow: hidden;
}

.fab-rail:hover:not([data-collapsed="true"]):not(.fab-rail-collapsed),
.fab-rail:focus-within:not([data-collapsed="true"]):not(.fab-rail-collapsed),
.fab-rail[data-expanded="true"] {
  width: 216px;
  box-shadow: 6px 0 24px rgba(15, 23, 42, 0.14);
}

.fab-rail[data-collapsed="true"],
.fab-rail.fab-rail-collapsed {
  width: 56px !important;
  box-shadow: none !important;
}

.fab-rail[data-collapsed="true"] .fab-rail-label,
.fab-rail[data-collapsed="true"] .fab-rail-brand-text,
.fab-rail[data-collapsed="true"] .fab-rail-badge,
.fab-rail[data-collapsed="true"] .fab-rail-user-info,
.fab-rail.fab-rail-collapsed .fab-rail-label,
.fab-rail.fab-rail-collapsed .fab-rail-brand-text,
.fab-rail.fab-rail-collapsed .fab-rail-badge,
.fab-rail.fab-rail-collapsed .fab-rail-user-info {
  opacity: 0 !important;
  transform: translateX(-6px) !important;
  pointer-events: none !important;
}

.fab-root[data-side="left"] .fab-rail {
  border-right: 1px solid #e2e8f0;
}

.fab-rail-top {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  width: 100%;
}

.fab-rail-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 0 1px;
  box-sizing: border-box;
  overflow: hidden;
}

.fab-rail-logo {
  width: 38px;
  height: 38px;
  flex: 0 0 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);
}

.fab-rail-brand-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  opacity: 0;
  transform: translateX(-6px);
  transition: opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1), transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  white-space: nowrap;
  overflow: hidden;
}

.fab-rail:hover .fab-rail-brand-text,
.fab-rail:focus-within .fab-rail-brand-text,
.fab-rail[data-expanded="true"] .fab-rail-brand-text {
  opacity: 1;
  transform: translateX(0);
}

.fab-rail-brand-name {
  font-size: 13px;
  font-weight: 700;
  color: ${NAVY};
  line-height: 1.2;
}

.fab-rail-brand-sub {
  font-size: 10px;
  font-weight: 500;
  color: #64748b;
  line-height: 1.2;
}

.fab-rail-nav {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
  width: 100%;
  margin-top: 14px;
}

.fab-rail-btn {
  position: relative;
  width: 100%;
  height: 40px;
  border-radius: 10px;
  border: none;
  background: transparent;
  color: #64748b;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
  padding: 0 10px;
  gap: 10px;
  box-sizing: border-box;
  overflow: hidden;
  text-align: left;
}

.fab-rail-btn-icon {
  position: relative;
  width: 20px;
  height: 20px;
  flex: 0 0 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.fab-rail-btn:hover {
  background: #f1f5f9;
  color: ${NAVY};
}

.fab-rail-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px #ffffff, 0 0 0 4px ${NAVY};
}

.fab-rail-btn:active {
  transform: scale(0.97);
}

.fab-rail-btn.active {
  background: ${NAVY_LIGHT};
  color: ${NAVY};
  font-weight: 600;
  box-shadow: inset 0 0 0 1px rgba(47, 53, 116, 0.15);
}

.fab-rail-label {
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  opacity: 0;
  transform: translateX(-6px);
  transition: opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1), transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  flex: 1 1 auto;
}

.fab-rail:hover .fab-rail-label,
.fab-rail:focus-within .fab-rail-label,
.fab-rail[data-expanded="true"] .fab-rail-label {
  opacity: 1;
  transform: translateX(0);
}

.fab-rail-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 9999px;
  background: #fee2e2;
  color: #ef4444;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  opacity: 0;
  transform: translateX(-4px);
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.fab-rail:hover .fab-rail-badge,
.fab-rail:focus-within .fab-rail-badge,
.fab-rail[data-expanded="true"] .fab-rail-badge {
  opacity: 1;
  transform: translateX(0);
}

.fab-rail-dot {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ef4444;
  border: 2px solid #ffffff;
  box-shadow: 0 0 0 1px rgba(239, 68, 68, 0.3);
  animation: fab-pulse 1.6s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.fab-rail-bottom {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 10px;
  padding-top: 12px;
  border-top: 1px solid #e2e8f0;
  width: 100%;
  box-sizing: border-box;
}

.fab-rail-user {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 4px;
  width: 100%;
  box-sizing: border-box;
  overflow: hidden;
}

.fab-rail-avatar {
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  border-radius: 50%;
  background: ${NAVY};
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  box-shadow: 0 1px 2px rgba(47, 53, 116, 0.25);
  cursor: default;
}

.fab-rail-user-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  opacity: 0;
  transform: translateX(-6px);
  transition: opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1), transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  white-space: nowrap;
  overflow: hidden;
  flex: 1 1 auto;
}

.fab-rail:hover .fab-rail-user-info,
.fab-rail:focus-within .fab-rail-user-info,
.fab-rail[data-expanded="true"] .fab-rail-user-info {
  opacity: 1;
  transform: translateX(0);
}

.fab-rail-user-name {
  font-size: 12px;
  font-weight: 600;
  color: #0f172a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.3;
}

.fab-rail-user-level {
  font-size: 10px;
  font-weight: 600;
  color: ${NAVY};
  background: ${NAVY_LIGHT};
  padding: 1px 6px;
  border-radius: 4px;
  display: inline-block;
  width: fit-content;
  line-height: 1.2;
  margin-top: 1px;
}

.fab-rail-logout:hover {
  background: #fee2e2;
  color: #ef4444;
}

/* ===== Content Panel ===== */
.fab-panel {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  min-width: 0;
  height: 100%;
  background: #f8fafc;
  overflow: hidden;
}

.fab-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  color: ${NAVY};
  font-weight: 700;
  font-size: 15px;
  letter-spacing: -0.2px;
  flex: 0 0 auto;
}

.fab-panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.fab-panel-body {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-sizing: border-box;
}
.fab-sidebar-footer {
  padding: 8px 16px;
  background: #ffffff;
  border-top: 1px solid #e2e8f0;
  color: #64748b;
  font-size: 11.5px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 38px;
  box-sizing: border-box;
}
.fab-sidebar-footer.fab-notice {
  background: #fef2f2;
  color: #b91c1c;
}
.fab-sidebar-footer.fab-footer-recording {
  background: #fef2f2;
  border-top-color: #fecaca;
  color: #dc2626;
}
.fab-footer-left {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  flex: 1 1 auto;
}
.fab-footer-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.fab-footer-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #94a3b8;
  flex-shrink: 0;
}
.fab-footer-dot.ready {
  background: #10b981;
}
.fab-footer-dot.recording {
  background: #ef4444;
  box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.25);
  animation: fab-pulse 1.4s ease-in-out infinite;
}
.fab-footer-dot.busy {
  background: #f59e0b;
  animation: fab-pulse 1s ease-in-out infinite;
}
.fab-footer-badge {
  font-size: 11px;
  font-weight: 500;
  color: #475569;
  background: #f1f5f9;
  padding: 2px 8px;
  border-radius: 9999px;
  border: 1px solid #e2e8f0;
  white-space: nowrap;
  flex-shrink: 0;
}
.fab-footer-badge.recording {
  background: #fee2e2;
  color: #b91c1c;
  border-color: #fca5a5;
  font-weight: 600;
}

/* ===== Modern Card Component ===== */
.k-card,
.sp-card {
  width: 100%;
  box-sizing: border-box;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 1px 2px -1px rgba(15, 23, 42, 0.02);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.k-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  box-sizing: border-box;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #f1f5f9;
}
.k-card-header > div {
  width: 100%;
}
.k-card-title {
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
  letter-spacing: -0.2px;
}
.k-card-desc {
  font-size: 12px;
  color: #64748b;
  margin-top: 2px;
}

/* ===== Modern Form Elements ===== */
.sp-field,
.k-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-bottom: 12px;
}
.sp-label,
.k-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #334155;
}
.k-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
}
.k-input-icon {
  position: absolute;
  left: 10px;
  color: #94a3b8;
  display: flex;
  align-items: center;
  pointer-events: none;
}
.sp-input,
.sp-select,
.sp-textarea,
.k-input,
.k-select,
.k-textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 13px;
  font-family: inherit;
  background-color: #ffffff;
  color: #0f172a;
  transition: all 0.15s ease-in-out;
}
.k-input.has-icon-left {
  padding-left: 34px;
}
.sp-textarea,
.k-textarea {
  min-height: 72px;
  resize: vertical;
  line-height: 1.45;
}
.sp-input:focus,
.sp-select:focus,
.sp-textarea:focus,
.k-input:focus,
.k-select:focus,
.k-textarea:focus {
  outline: none;
  border-color: ${NAVY};
  box-shadow: 0 0 0 3px rgba(47, 53, 116, 0.12);
}
.sp-input:disabled,
.k-input:disabled {
  background-color: #f1f5f9;
  color: #94a3b8;
  cursor: not-allowed;
}

/* ===== Modern Combobox (Searchable Select) ===== */
.k-combobox-wrapper {
  position: relative;
  width: 100%;
}
.k-combobox-trigger {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 13px;
  font-family: inherit;
  background-color: #ffffff;
  color: #0f172a;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease-in-out;
  box-sizing: border-box;
}
.k-combobox-trigger:hover {
  border-color: #94a3b8;
  background-color: #f8fafc;
}
.k-combobox-trigger:focus,
.k-combobox-trigger:focus-visible {
  outline: none;
  border-color: ${NAVY};
  box-shadow: 0 0 0 3px rgba(47, 53, 116, 0.12);
}
.k-combobox-trigger.open {
  border-color: ${NAVY};
  box-shadow: 0 0 0 3px rgba(47, 53, 116, 0.12);
}
.k-combobox-trigger:disabled {
  background-color: #f1f5f9;
  color: #94a3b8;
  cursor: not-allowed;
}
.k-combobox-value {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}
.k-combobox-placeholder {
  color: #94a3b8;
}
.k-combobox-icon {
  flex-shrink: 0;
  color: #64748b;
  margin-left: 8px;
  display: flex;
  align-items: center;
}
.k-combobox-popover {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background-color: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.15), 0 8px 10px -6px rgba(15, 23, 42, 0.1);
  z-index: 1000;
  overflow: hidden;
  animation: combobox-fade-in 0.15s ease-out;
}
@keyframes combobox-fade-in {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}
.k-combobox-search {
  display: flex;
  align-items: center;
  padding: 8px 10px;
  border-bottom: 1px solid #e2e8f0;
  background-color: #f8fafc;
  gap: 6px;
}
.k-combobox-search-icon {
  color: #64748b;
  flex-shrink: 0;
  display: flex;
  align-items: center;
}
.k-combobox-search-input {
  flex: 1;
  border: none;
  background: transparent;
  outline: none;
  font-size: 12px;
  font-family: inherit;
  color: #0f172a;
  padding: 0;
}
.k-combobox-search-input::placeholder {
  color: #94a3b8;
}
.k-combobox-search-clear {
  border: none;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  padding: 0 4px;
  font-size: 14px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
.k-combobox-search-clear:hover {
  color: #475569;
}
.k-combobox-list {
  max-height: 200px;
  overflow-y: auto;
  padding: 4px;
}
.k-combobox-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border-radius: 6px;
  font-size: 12px;
  color: #1e293b;
  cursor: pointer;
  transition: all 0.1s ease;
  user-select: none;
}
.k-combobox-item:hover,
.k-combobox-item.highlighted {
  background-color: #f1f5f9;
  color: #0f172a;
}
.k-combobox-item.selected {
  background-color: ${NAVY_LIGHT};
  color: ${NAVY};
  font-weight: 500;
}
.k-combobox-item-left {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}
.k-combobox-item-check {
  flex-shrink: 0;
  color: ${NAVY};
  display: flex;
  align-items: center;
}
.k-combobox-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  background: #e2e8f0;
  color: #475569;
  font-weight: 500;
  flex-shrink: 0;
}
.k-combobox-empty {
  padding: 16px 12px;
  text-align: center;
  font-size: 12px;
  color: #64748b;
}

/* ===== Modern Buttons (Modern Web Guidance) ===== */
.sp-button,
.k-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 38px;
  padding: 0 16px;
  border-radius: 8px;
  border: 1px solid transparent;
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
  line-height: 1;
  text-decoration: none;
  transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
  box-sizing: border-box;
}

.sp-button:focus-visible,
.k-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px #ffffff, 0 0 0 4px ${NAVY};
}

.sp-button:disabled,
.k-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
  transform: none !important;
  box-shadow: none !important;
}

/* Primary Variant */
.sp-button:not(.secondary):not(.danger):not(.success),
.k-btn-primary {
  background-color: ${NAVY};
  border-color: ${NAVY};
  color: #ffffff;
  box-shadow: 0 1px 3px rgba(47, 53, 116, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15);
}
.sp-button:not(.secondary):not(.danger):not(.success):hover:not(:disabled),
.k-btn-primary:hover:not(:disabled) {
  background-color: ${NAVY_HOVER};
  border-color: ${NAVY_HOVER};
  box-shadow: 0 3px 8px rgba(47, 53, 116, 0.28);
  transform: translateY(-1px);
}
.sp-button:not(.secondary):not(.danger):not(.success):active:not(:disabled),
.k-btn-primary:active:not(:disabled) {
  background-color: ${NAVY_ACTIVE};
  border-color: ${NAVY_ACTIVE};
  transform: translateY(0) scale(0.98);
  box-shadow: 0 1px 2px rgba(47, 53, 116, 0.2);
}

/* Secondary Variant */
.sp-button.secondary,
.k-btn-secondary {
  background-color: #ffffff;
  color: #334155;
  border: 1px solid #cbd5e1;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}
.sp-button.secondary:hover:not(:disabled),
.k-btn-secondary:hover:not(:disabled) {
  background-color: #f8fafc;
  border-color: #94a3b8;
  color: #0f172a;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.06);
  transform: translateY(-1px);
}
.sp-button.secondary:active:not(:disabled),
.k-btn-secondary:active:not(:disabled) {
  background-color: #f1f5f9;
  border-color: #94a3b8;
  transform: translateY(0) scale(0.98);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.05);
}

/* Success Variant (Rekam / Skenario Aktif) */
.sp-button.success,
.k-btn-success {
  background-color: #16a34a;
  border-color: #15803d;
  color: #ffffff;
  box-shadow: 0 1px 3px rgba(22, 163, 74, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.2);
}
.sp-button.success:hover:not(:disabled),
.k-btn-success:hover:not(:disabled) {
  background-color: #15803d;
  border-color: #166534;
  box-shadow: 0 3px 8px rgba(22, 163, 74, 0.35);
  transform: translateY(-1px);
}
.sp-button.success:active:not(:disabled),
.k-btn-success:active:not(:disabled) {
  background-color: #166534;
  transform: translateY(0) scale(0.98);
}

/* Danger Variant */
.sp-button.danger,
.k-btn-danger {
  background-color: #ef4444;
  border-color: #dc2626;
  color: #ffffff;
  box-shadow: 0 1px 3px rgba(239, 68, 68, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.15);
}
.sp-button.danger:hover:not(:disabled),
.k-btn-danger:hover:not(:disabled) {
  background-color: #dc2626;
  border-color: #b91c1c;
  box-shadow: 0 3px 8px rgba(239, 68, 68, 0.35);
  transform: translateY(-1px);
}
.sp-button.danger:active:not(:disabled),
.k-btn-danger:active:not(:disabled) {
  background-color: #b91c1c;
  transform: translateY(0) scale(0.98);
}

/* Outline Variant */
.k-btn-outline {
  background: transparent;
  color: ${NAVY};
  border: 1px solid ${NAVY_BORDER};
}
.k-btn-outline:hover:not(:disabled) {
  background: ${NAVY_LIGHT};
  border-color: ${NAVY};
  transform: translateY(-1px);
}
.k-btn-outline:active:not(:disabled) {
  background: ${NAVY_LIGHT};
  transform: translateY(0) scale(0.98);
}

/* Ghost Variant */
.k-btn-ghost {
  background: transparent;
  border-color: transparent;
  color: #475569;
  box-shadow: none;
}
.k-btn-ghost:hover:not(:disabled) {
  background: #f1f5f9;
  color: #0f172a;
}
.k-btn-ghost:active:not(:disabled) {
  background: #e2e8f0;
  transform: translateY(0) scale(0.98);
}
.k-btn-ghost.k-btn-danger-ghost {
  color: #b91c1c;
}
.k-btn-ghost.k-btn-danger-ghost:hover:not(:disabled) {
  background: #fef2f2;
  color: #dc2626;
}

/* Standard Sizing */
.k-btn-xs {
  height: 26px;
  padding: 0 8px;
  font-size: 11px;
  border-radius: 6px;
  gap: 4px;
}
.k-btn-sm {
  height: 32px;
  padding: 0 12px;
  font-size: 12px;
  border-radius: 7px;
  gap: 5px;
}
.k-btn-md {
  height: 38px;
  padding: 0 16px;
  font-size: 13px;
  border-radius: 8px;
  gap: 6px;
}
.k-btn-lg {
  height: 42px;
  padding: 0 20px;
  font-size: 14px;
  font-weight: 600;
  border-radius: 9px;
  gap: 8px;
}

/* Square Icon Buttons */
.k-btn-icon {
  padding: 0 !important;
  width: 38px;
  height: 38px;
  border-radius: 8px;
  flex-shrink: 0;
}
.k-btn-icon.k-btn-xs {
  width: 26px;
  height: 26px;
  border-radius: 6px;
}
.k-btn-icon.k-btn-sm {
  width: 32px;
  height: 32px;
  border-radius: 7px;
}
.k-btn-icon.k-btn-lg {
  width: 42px;
  height: 42px;
  border-radius: 9px;
}

.sp-button-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}

/* ===== Badges & Pills ===== */
.sp-badge,
.k-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 8px;
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 600;
  line-height: 16px;
  background-color: ${NAVY_LIGHT};
  color: ${NAVY};
  border: 1px solid ${NAVY_BORDER};
}
.k-badge-success {
  background-color: #f0fdf4;
  color: #16a34a;
  border-color: #bbf7d0;
}
.k-badge-danger {
  background-color: #fef2f2;
  color: #dc2626;
  border-color: #fecaca;
}
.k-badge-warning {
  background-color: #fffbeb;
  color: #d97706;
  border-color: #fde68a;
}
.k-badge-neutral {
  background-color: #f1f5f9;
  color: #475569;
  border-color: #e2e8f0;
}

/* ===== Live Stopwatch Dashboard (ActiveView) ===== */
.k-stopwatch {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: linear-gradient(180deg, #f8faff 0%, #edf1fd 100%);
  border: 1px solid ${NAVY_BORDER};
  border-radius: 12px;
  margin: 4px 0 12px 0;
}
.k-stopwatch-time {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 32px;
  font-weight: 800;
  letter-spacing: 1px;
  color: ${NAVY};
  font-variant-numeric: tabular-nums;
}
.k-stopwatch-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: #64748b;
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
}
.k-pulse-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ef4444;
  animation: fab-pulse 1.4s ease-in-out infinite;
}

/* ===== Metrics Cards ===== */
.sp-metrics,
.k-metrics {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  margin: 10px 0;
}
.sp-metric,
.k-metric-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 10px 12px;
  text-align: center;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
}
.sp-metric-value,
.k-metric-value {
  font-size: 20px;
  font-weight: 800;
  color: ${NAVY};
  line-height: 1.2;
}
.sp-metric-label,
.k-metric-label {
  font-size: 11px;
  font-weight: 500;
  color: #64748b;
  margin-top: 2px;
}

/* ===== Segmented Radio Controls (Result / Setting) ===== */
.k-segmented {
  display: flex;
  background: #f1f5f9;
  padding: 4px;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  gap: 4px;
  box-sizing: border-box;
}
.k-segmented-btn {
  flex: 1;
  padding: 8px 12px;
  border-radius: 7px;
  border: 1px solid transparent;
  background: transparent;
  color: #64748b;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  user-select: none;
}
.k-segmented-btn:hover:not(.active):not(.active-pass):not(.active-fail):not(.active-blocked) {
  color: #1e293b;
  background: rgba(255, 255, 255, 0.7);
}
.k-segmented-btn.active {
  background: #ffffff;
  color: ${NAVY};
  border-color: #cbd5e1;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04);
}
.k-segmented-btn.active-pass {
  background: #16a34a;
  border-color: #15803d;
  color: #ffffff;
  box-shadow: 0 2px 6px rgba(22, 163, 74, 0.35);
}
.k-segmented-btn.active-fail {
  background: #dc2626;
  border-color: #b91c1c;
  color: #ffffff;
  box-shadow: 0 2px 6px rgba(220, 38, 38, 0.35);
}
.k-segmented-btn.active-blocked {
  background: #d97706;
  border-color: #b45309;
  color: #ffffff;
  box-shadow: 0 2px 6px rgba(217, 119, 6, 0.35);
}

/* ===== Floating Toast Notification ===== */
.k-toast {
  position: absolute;
  bottom: 50px;
  left: 16px;
  right: 16px;
  background: #0f172a;
  color: #ffffff;
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
  z-index: 9999;
  animation: k-toast-slide 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes k-toast-slide {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
.k-toast-content {
  display: flex;
  align-items: center;
  gap: 8px;
}
.k-toast-success { background: #064e3b; border: 1px solid #059669; }
.k-toast-error { background: #7f1d1d; border: 1px solid #dc2626; }
.k-toast-info { background: ${NAVY}; border: 1px solid ${NAVY_HOVER}; }

/* ===== Code Preview Modal / Drawer ===== */
.k-modal-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(15, 23, 42, 0.5);
  backdrop-filter: blur(2px);
  z-index: 10001;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  animation: fab-fade-in 0.2s ease-out;
}
.k-modal-sheet {
  background: #ffffff;
  border-radius: 16px 16px 0 0;
  border: 1px solid #cbd5e1;
  border-bottom: none;
  max-height: 88%;
  display: flex;
  flex-direction: column;
  box-shadow: 0 -8px 28px rgba(15, 23, 42, 0.2);
  overflow: hidden;
  animation: k-sheet-up 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes k-sheet-up {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
.k-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid #e2e8f0;
  background: #ffffff;
}
.k-modal-body {
  flex: 1 1 auto;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  padding: 18px 20px;
  gap: 12px;
  box-sizing: border-box;
}
.k-modal-body.no-padding {
  padding: 0;
  gap: 0;
}
.k-modal-footer {
  padding: 12px 20px;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.k-code-block {
  margin: 0;
  padding: 12px 16px;
  background: #0f172a;
  color: #e2e8f0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  line-height: 1.6;
  overflow: auto;
  flex: 1;
}

/* ===== Root Menu Grid ===== */
.fab-menu-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}
.fab-menu-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 20px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #ffffff;
  color: ${NAVY};
  cursor: pointer;
  font: inherit;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.fab-menu-item:hover,
.fab-menu-item:focus-visible {
  background: ${NAVY_LIGHT};
  border-color: ${NAVY};
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(47, 53, 116, 0.12);
}
.fab-menu-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  color: ${NAVY};
}
.fab-menu-label {
  font-size: 13px;
  font-weight: 600;
}

/* ===== Legacy Helpers for Backward Compatibility ===== */
.sp-error {
  background-color: #fef2f2;
  border: 1px solid #fecaca;
  color: #991b1b;
  border-radius: 8px;
  padding: 8px 12px;
  margin-bottom: 12px;
  font-size: 12px;
}
.sp-success {
  background-color: #f0fdf4;
  border: 1px solid #bbf7d0;
  color: #166534;
  border-radius: 8px;
  padding: 8px 12px;
  margin-bottom: 12px;
  font-size: 12px;
}
.sp-muted {
  color: #64748b;
  font-size: 12px;
}
.sp-list-item {
  border-top: 1px solid #f1f5f9;
  padding: 10px 0;
}
.sp-pre {
  background: #0f172a;
  color: #e2e8f0;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 10px;
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 11px;
  max-height: 180px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
  margin-top: 8px;
}
`;
/**
 * CSS FAB — pola sidebar-geser ala knitto-admin-extension.
 * Diadopt via adoptedStyleSheets di dalam Shadow DOM; tema navy #2F3574.
 */
const NAVY = '#2F3574';
const NAVY_HOVER = '#1f2860';
const NAVY_100 = '#eceef8';
const QA_BADGE_BG = '#f4b400';

export const FAB_CSS = `
.fab-root {
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 14px;
  -webkit-font-smoothing: antialiased;
  color: #1f1f1f;
}
.fab-trigger {
  position: fixed;
  top: 40%;
  width: 48px;
  height: 48px;
  border-radius: 8px 0 0 8px;
  border: 1px solid rgba(47, 53, 116, 0.3);
  border-right: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
  padding: 0;
  z-index: 10000;
  transition: all 0.5s ease;
}
.fab-trigger:hover,
.fab-trigger:focus-visible {
  transform: scale(1.04);
  outline: 2px solid ${NAVY};
  outline-offset: 2px;
}
.fab-trigger.fab-side-left {
  border-radius: 0 8px 8px 0;
  border-right: 1px solid rgba(47, 53, 116, 0.3);
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
  border-radius: 10px;
  background: ${QA_BADGE_BG};
  color: #fff;
  border: 2px solid #fff;
  font-size: 9px;
  font-weight: 800;
  line-height: 14px;
  text-align: center;
  letter-spacing: 0.2px;
  padding: 0 1px;
}
.fab-rec-dot {
  position: absolute;
  top: -3px;
  right: -3px;
  min-width: 17px;
  height: 17px;
  border-radius: 9px;
  background: #e53935;
  color: #fff;
  border: 2px solid #fff;
  font-size: 10px;
  font-weight: 700;
  line-height: 12px;
  text-align: center;
  padding: 0 3px;
  animation: fab-pulse 1.6s ease-in-out infinite;
}
@keyframes fab-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.55; }
}
.fab-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.55);
  z-index: 9997;
  border: none;
  width: 100%;
  height: 100%;
}
.fab-sidebar {
  position: fixed;
  top: 0;
  bottom: 0;
  width: 500px;
  max-width: 92vw;
  background: #fff;
  box-shadow: 0 0 24px rgba(0, 0, 0, 0.25);
  z-index: 9998;
  transition: all 0.5s ease;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.fab-sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #edf0f7;
  color: ${NAVY};
  font-weight: 700;
  flex: 0 0 auto;
}
.fab-sidebar-close {
  border: none;
  background: transparent;
  color: ${NAVY};
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  padding: 4px 6px;
}
.fab-sidebar-back {
  border: none;
  background: transparent;
  color: ${NAVY};
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  padding: 4px 8px;
  margin-right: auto;
}
.fab-sidebar-close:hover { background: ${NAVY_100}; border-radius: 6px; }
.fab-sidebar-body {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 16px;
}
.fab-menu-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}
.fab-menu-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 14px 8px;
  border: 1px solid #e6e9f2;
  border-radius: 10px;
  background: #fff;
  color: ${NAVY};
  cursor: pointer;
  font: inherit;
  box-shadow: 0px 4px 8px 0px #00000014;
  transition: background 0.15s ease;
}
.fab-menu-item:hover,
.fab-menu-item:focus-visible {
  background: ${NAVY_100};
  outline: 2px solid ${NAVY};
  outline-offset: -2px;
}
.fab-menu-icon {
  width: 26px;
  height: 26px;
}
.fab-menu-item svg {
  width: 26px;
  height: 26px;
}
.fab-menu-label { font-size: 12px; text-align: center; }
.fab-setting-group { display: flex; flex-direction: column; gap: 12px; }
.fab-setting-toggler {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #e6e9f2;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  color: #1f1f1f;
  font: inherit;
}
.fab-setting-check {
  width: 34px;
  height: 18px;
  border-radius: 9px;
  background: #d0d3dd;
  position: relative;
  flex: 0 0 auto;
}
.fab-setting-check.fab-on { background: ${NAVY}; }
.fab-setting-check::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.12s ease;
}
.fab-setting-check.fab-on::after { transform: translateX(16px); }
.fab-setting-label {
  font-size: 12px;
  font-weight: 700;
  color: ${NAVY_HOVER};
}
.fab-setting-radios { display: flex; gap: 8px; }
.fab-setting-radio {
  flex: 1;
  padding: 7px 10px;
  border: 1px solid #d0d3dd;
  border-radius: 8px;
  background: #fff;
  color: #444;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  text-align: center;
}
.fab-setting-radio.fab-active { background: ${NAVY}; border-color: ${NAVY}; color: #fff; }
.fab-setting-radio:hover:not(.fab-active) { background: ${NAVY_100}; }
`;
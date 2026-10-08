/**
 * Script yang dieksekusi di world utama halaman untuk menangkap aksi tester.
 * Hasil dikirim balik lewat CDP binding `__qaRecorderBinding`.
 */
import { installLocatorEngine } from './locatorEngine';

export const ACTION_BINDING_NAME = '__qaRecorderBinding';

export const actionCaptureScript = (): string => `
(() => {
  if (window.__qaRecorderInstalled) return;
  window.__qaRecorderInstalled = true;
  const locatorEngine = (${installLocatorEngine.toString()})(window);

  const send = (payload) => {
    try {
      payload.pageUrl = location.href;
      window.${ACTION_BINDING_NAME}(JSON.stringify(payload));
    } catch (error) {}
  };

  const getAssociatedLabel = (element) => {
    if (!element) return undefined;
    if (element.id) {
      try {
        const label = document.querySelector('label[for="' + CSS.escape(element.id) + '"]');
        if (label) return (label.innerText || label.textContent || '').trim();
      } catch (e) {}
    }
    const parentLabel = element.closest('label');
    if (parentLabel) {
      return (parentLabel.innerText || parentLabel.textContent || '').trim();
    }
    return undefined;
  };

  const isExtensionElement = (el) => {
    // Naik melewati batas shadow root: target dari composedPath() bisa berada di dalam shadow root FAB.
    let node = el;
    while (node && node instanceof Element) {
      if (typeof node.closest === 'function' && node.closest('#qa-knitto-fab-host, [data-qa-knitto-ext]')) return true;
      const root = typeof node.getRootNode === 'function' ? node.getRootNode() : null;
      node = root && root !== document && root.host ? root.host : null;
    }
    return false;
  };

  const descriptor = (element) => {
    if (!element || !element.tagName) return null;
    const testId = element.getAttribute('data-testid');
    const text = (element.innerText || element.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 120);
    const labelText = getAssociatedLabel(element);
    const type = (element.getAttribute('type') || '').toLowerCase();
    const checked = element.checked !== undefined ? Boolean(element.checked) : undefined;
    
    let selectedText = undefined;
    if (element.tagName === 'SELECT') {
      const opt = element.selectedOptions && element.selectedOptions[0];
      if (opt) selectedText = (opt.text || opt.innerText || '').trim();
    }

    const ariaLabel = element.getAttribute('aria-label') || undefined;
    let candidates = [];
    try { candidates = locatorEngine.describeCandidates(element); } catch (e) {}

    return {
      tagName: element.tagName,
      id: element.id && !locatorEngine.isDynamicId(element.id) ? element.id : undefined,
      testId: testId || undefined,
      role: locatorEngine.roleOf(element) || undefined,
      accessibleName: locatorEngine.accessibleName(element) || undefined,
      ariaLabel: ariaLabel,
      labelText: labelText || undefined,
      placeholder: element.getAttribute('placeholder') || undefined,
      name: element.getAttribute('name') || undefined,
      type: type || undefined,
      checked: checked,
      selectedText: selectedText || undefined,
      title: element.getAttribute('title') || undefined,
      alt: element.getAttribute('alt') || undefined,
      text: text || undefined,
      cssPath: locatorEngine.cssPath(element) || undefined,
      classes: Array.from(element.classList || []),
      candidates: candidates
    };
  };

  const isSensitive = (element) => {
    if (!element) return false;
    const type = (element.getAttribute('type') || '').toLowerCase();
    const name = (element.getAttribute('name') || '').toLowerCase();
    return type === 'password' || /pass|secret|token|otp/.test(name);
  };

  const INTERACTIVE_SELECTOR = 'button, a[href], input, select, textarea, summary, label, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], [role="option"], [role="switch"], [role="checkbox"], [role="radio"], [role="treeitem"], [role="combobox"], [contenteditable="true"]';

  const getInteractiveTarget = (rawTarget) => {
    if (!rawTarget || !(rawTarget instanceof Element)) return rawTarget;
    // Elemen yang diklik sendiri sudah interaktif: pakai apa adanya.
    if (rawTarget.matches && rawTarget.matches(INTERACTIVE_SELECTOR)) return rawTarget;
    // Naik ke ancestor interaktif terdekat (mis. <svg>/<span> di dalam <button>).
    const found = typeof rawTarget.closest === 'function' ? rawTarget.closest(INTERACTIVE_SELECTOR) : null;
    if (found && !isExtensionElement(found)) return found;
    // Elemen custom tanpa semantik: hanya naik bila ancestor punya onclick/cursor pointer, maksimal 3 level.
    let cur = rawTarget;
    for (let depth = 0; cur && depth < 3; depth++) {
      if (isExtensionElement(cur)) break;
      if (cur.hasAttribute && (cur.hasAttribute('onclick') || cur.hasAttribute('data-testid'))) return cur;
      try {
        const parent = cur.parentElement;
        const style = window.getComputedStyle(cur);
        const parentPointer = parent && window.getComputedStyle(parent).cursor === 'pointer';
        if (style && style.cursor === 'pointer' && !parentPointer) return cur;
      } catch (e) {}
      cur = cur.parentElement;
    }
    return rawTarget;
  };

  let inputTimer = null;
  let lastInputElement = null;

  const flushPendingInput = () => {
    if (inputTimer && lastInputElement) {
      clearTimeout(inputTimer);
      inputTimer = null;
      const el = lastInputElement;
      lastInputElement = null;
      const sensitive = isSensitive(el);
      const isContentEdit = el.isContentEditable || el.getAttribute('contenteditable') === 'true' || el.getAttribute('role') === 'textbox';
      const val = sensitive
        ? null
        : (isContentEdit
            ? (el.innerText || el.textContent || '').slice(0, 1000)
            : (typeof el.value === 'string' ? el.value.slice(0, 1000) : null));
      send({
        action: 'input',
        element: descriptor(el),
        value: val,
        value_redacted: sensitive
      });
    }
  };

  // Target asli event (menembus open shadow DOM; event.target di document sudah di-retarget ke host).
  const realTarget = (event) => {
    const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
    const first = path.find((node) => node instanceof Element);
    return first || event.target;
  };

  // Rantai locator iframe (terluar → terdalam) untuk aksi di dalam frame same-origin.
  // Frame cross-origin tidak bisa membaca parent: ditandai, recorder melengkapi via CDP.
  const frameChain = () => {
    if (window === window.top) return { frames: null, crossOrigin: false };
    const frames = [];
    let win = window;
    try {
      while (win !== win.top) {
        const owner = win.frameElement;
        const parentEngine = win.parent.__knittoLocator;
        if (!owner || !parentEngine) return { frames: null, crossOrigin: true };
        frames.unshift(parentEngine.describeCandidates(owner));
        win = win.parent;
      }
    } catch (e) {
      return { frames: null, crossOrigin: true };
    }
    return { frames, crossOrigin: false };
  };

  const sendAction = (payload) => {
    const chain = frameChain();
    if (chain.frames) payload.frames = chain.frames;
    if (chain.crossOrigin) payload.crossOriginFrame = true;
    send(payload);
  };

  // ---- Hover yang membuka menu: dicatat hanya bila elemen yang kemudian diklik
  // muncul di DOM setelah hover (terdeteksi MutationObserver), agar tidak berisik.
  const HOVER_WINDOW_MS = 4000;
  let pendingHover = null;
  const hoverObserver = new MutationObserver((mutations) => {
    if (!pendingHover || Date.now() - pendingHover.at > HOVER_WINDOW_MS) return;
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof Element) pendingHover.added.push(node);
      });
    }
  });
  try {
    hoverObserver.observe(document.documentElement, { childList: true, subtree: true });
  } catch (e) {}

  document.addEventListener('mouseover', (event) => {
    const raw = realTarget(event);
    if (!(raw instanceof Element) || isExtensionElement(raw)) return;
    const host = raw.closest('[aria-haspopup], [aria-expanded], [role="menuitem"], button, a[href], li, nav *');
    if (!host || (pendingHover && pendingHover.el === host)) return;
    pendingHover = { el: host, at: Date.now(), added: [], emitted: false };
  }, true);

  const flushHoverFor = (target) => {
    const hover = pendingHover;
    if (!hover || hover.emitted || Date.now() - hover.at > HOVER_WINDOW_MS) return;
    if (hover.el.contains(target)) return;
    const revealed = hover.added.some((node) => node === target || node.contains(target));
    if (!revealed) return;
    hover.emitted = true;
    sendAction({ action: 'hover', element: descriptor(hover.el) });
  };

  // ---- Klik, double-click, klik kanan
  document.addEventListener('click', (event) => {
    const rawTarget = realTarget(event);
    if (!rawTarget || !(rawTarget instanceof Element) || isExtensionElement(rawTarget)) return;
    if (suppressClickUntil > Date.now()) return;

    // Pastikan input tertunda dikirimkan sebelum event click
    flushPendingInput();

    const interactiveTarget = getInteractiveTarget(rawTarget);
    if (isExtensionElement(interactiveTarget)) return;

    flushHoverFor(interactiveTarget);
    // event.detail === 2 adalah klik kedua dari double-click; dblclick dicatat terpisah.
    if (event.detail >= 2) return;
    sendAction({ action: 'click', element: descriptor(interactiveTarget) });
  }, true);

  document.addEventListener('dblclick', (event) => {
    const rawTarget = realTarget(event);
    if (!(rawTarget instanceof Element) || isExtensionElement(rawTarget)) return;
    flushPendingInput();
    sendAction({ action: 'dblclick', element: descriptor(getInteractiveTarget(rawTarget)) });
  }, true);

  document.addEventListener('contextmenu', (event) => {
    const rawTarget = realTarget(event);
    if (!(rawTarget instanceof Element) || isExtensionElement(rawTarget)) return;
    flushPendingInput();
    sendAction({ action: 'rightclick', element: descriptor(getInteractiveTarget(rawTarget)) });
  }, true);

  // ---- Drag & drop: HTML5 (dragstart/drop) atau berbasis pointer (dnd-kit, sortable, dll.)
  let dragSource = null;
  let pointerDown = null;
  let suppressClickUntil = 0;
  const DRAG_MIN_DISTANCE = 12;

  document.addEventListener('dragstart', (event) => {
    const raw = realTarget(event);
    if (raw instanceof Element && !isExtensionElement(raw)) dragSource = getInteractiveTarget(raw.closest('[draggable="true"]') || raw);
  }, true);

  document.addEventListener('drop', (event) => {
    const raw = realTarget(event);
    if (!dragSource || !(raw instanceof Element) || isExtensionElement(raw)) return;
    sendAction({ action: 'drag', element: descriptor(dragSource), target: descriptor(raw) });
    dragSource = null;
    pointerDown = null;
  }, true);

  document.addEventListener('pointerdown', (event) => {
    const raw = realTarget(event);
    if (event.button !== 0 || !(raw instanceof Element) || isExtensionElement(raw)) return;
    pointerDown = { el: getInteractiveTarget(raw), x: event.clientX, y: event.clientY };
  }, true);

  document.addEventListener('pointerup', (event) => {
    const down = pointerDown;
    pointerDown = null;
    if (!down || dragSource) return;
    const distance = Math.hypot(event.clientX - down.x, event.clientY - down.y);
    if (distance < DRAG_MIN_DISTANCE) return;
    const dropTarget = document.elementFromPoint(event.clientX, event.clientY);
    if (!dropTarget || dropTarget === down.el || down.el.contains(dropTarget) || isExtensionElement(dropTarget)) return;
    // Seleksi teks (geser di dalam input) bukan drag.
    if (down.el.matches && down.el.matches('input, textarea, [contenteditable="true"]')) return;
    sendAction({ action: 'drag', element: descriptor(down.el), target: descriptor(dropTarget) });
    // Klik sintetis setelah drag pointer bukan aksi tester.
    suppressClickUntil = Date.now() + 300;
  }, true);

  // Input listener dengan support input, textarea, dan contenteditable
  document.addEventListener('input', (event) => {
    const element = realTarget(event);
    if (!element || !(element instanceof Element) || isExtensionElement(element)) return;
    const isInputOrTextArea = element.tagName === 'INPUT' || element.tagName === 'TEXTAREA';
    const isContentEdit = element.isContentEditable || element.getAttribute('contenteditable') === 'true' || element.getAttribute('role') === 'textbox';
    if (!isInputOrTextArea && !isContentEdit) return;
    // file/checkbox/radio tidak diketik: dicatat lewat change (upload/check) — event input-nya (value "on") jangan jadi fill.
    if (element.tagName === 'INPUT' && ['file', 'checkbox', 'radio'].includes((element.getAttribute('type') || '').toLowerCase())) return;

    lastInputElement = element;
    if (inputTimer) clearTimeout(inputTimer);
    inputTimer = setTimeout(() => {
      flushPendingInput();
    }, 300);
  }, true);

  const onChange = (event) => {
    flushPendingInput();
    const element = realTarget(event);
    if (!element || !(element instanceof Element) || isExtensionElement(element)) return;
    const desc = descriptor(element);
    // Upload file: nama file saja (path asli tidak bisa & tidak boleh dibaca).
    if (element.tagName === 'INPUT' && (element.getAttribute('type') || '').toLowerCase() === 'file') {
      const files = Array.from(element.files || []).map((file) => file.name).slice(0, 20);
      sendAction({ action: 'upload', element: desc, files });
      return;
    }
    const sensitive = isSensitive(element);
    sendAction({
      action: 'change',
      element: desc,
      value: sensitive ? null : (element && typeof element.value === 'string' ? element.value.slice(0, 1000) : null),
      checked: desc?.checked,
      selectedText: desc?.selectedText,
      value_redacted: sensitive
    });
  };
  document.addEventListener('change', onChange, true);

  // Event change tidak "composed": pasang listener di setiap open shadow root yang disentuh tester.
  const instrumentedRoots = new WeakSet();
  document.addEventListener('focusin', (event) => {
    const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
    for (const node of path) {
      if (typeof ShadowRoot !== 'undefined' && node instanceof ShadowRoot && !instrumentedRoots.has(node)) {
        instrumentedRoots.add(node);
        node.addEventListener('change', onChange, true);
      }
    }
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== 'Tab' && event.key !== 'Escape') return;
    flushPendingInput();
    const element = realTarget(event);
    if (!element || !(element instanceof Element) || isExtensionElement(element)) return;
    sendAction({ action: 'keydown', key: event.key, element: descriptor(element) });
  }, true);
})();
`;

/**
 * Script yang dieksekusi di world utama halaman untuk menangkap aksi tester.
 * Hasil dikirim balik lewat CDP binding `__qaRecorderBinding`.
 */
export const ACTION_BINDING_NAME = '__qaRecorderBinding';

export const actionCaptureScript = (): string => `
(() => {
  if (window.__qaRecorderInstalled) return;
  window.__qaRecorderInstalled = true;

  const send = (payload) => {
    try { window.${ACTION_BINDING_NAME}(JSON.stringify(payload)); } catch (error) {}
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

  const computeCssPath = (el) => {
    if (!(el instanceof Element)) return '';
    const path = [];
    while (el && el.nodeType === Node.ELEMENT_NODE) {
      let selector = el.nodeName.toLowerCase();
      if (el.id && /^[A-Za-z][\\w-]*$/.test(el.id)) {
        selector += '#' + el.id;
        path.unshift(selector);
        break;
      } else {
        let sib = el, nth = 1;
        while (sib = sib.previousElementSibling) {
          if (sib.nodeName.toLowerCase() === selector) nth++;
        }
        if (nth !== 1) selector += ':nth-of-type(' + nth + ')';
      }
      path.unshift(selector);
      el = el.parentElement;
    }
    return path.join(' > ');
  };

  const isExtensionElement = (el) => {
    if (!el || !(el instanceof Element)) return false;
    if (el.id === 'qa-knitto-fab-host' || (typeof el.closest === 'function' && el.closest('#qa-knitto-fab-host'))) return true;
    if (el.hasAttribute && el.hasAttribute('data-qa-knitto-ext')) return true;
    if (typeof el.closest === 'function' && el.closest('[data-qa-knitto-ext]')) return true;
    return false;
  };

  const descriptor = (element) => {
    if (!element || !element.tagName) return null;
    const testId = element.getAttribute('data-testid')
      || element.getAttribute('data-test-id')
      || element.getAttribute('data-cy');
    const text = (element.innerText || element.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 120);
    const labelText = getAssociatedLabel(element);
    const type = (element.getAttribute('type') || '').toLowerCase();
    const checked = element.checked !== undefined ? Boolean(element.checked) : undefined;
    
    let selectedText = undefined;
    if (element.tagName === 'SELECT') {
      const opt = element.selectedOptions && element.selectedOptions[0];
      if (opt) selectedText = (opt.text || opt.innerText || '').trim();
    }

    const ariaLabel = element.getAttribute('aria-label') || element.getAttribute('title') || undefined;

    return {
      tagName: element.tagName,
      id: element.id || undefined,
      testId: testId || undefined,
      role: element.getAttribute('role') || undefined,
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
      cssPath: computeCssPath(element) || undefined,
      classes: Array.from(element.classList || [])
    };
  };

  const isSensitive = (element) => {
    if (!element) return false;
    const type = (element.getAttribute('type') || '').toLowerCase();
    const name = (element.getAttribute('name') || '').toLowerCase();
    return type === 'password' || /pass|secret|token|otp/.test(name);
  };

  const getInteractiveTarget = (rawTarget) => {
    if (!rawTarget || !(rawTarget instanceof Element)) return rawTarget;
    const selector = 'button, a, input, select, textarea, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="option"], [role="switch"], [role="checkbox"], [role="radio"], [role="treeitem"], [tabindex], [onclick], [data-action], [aria-label], [title], [class*="btn"], [class*="button"], [class*="submit"], [class*="send"], [class*="action"], [class*="clickable"]';
    if (typeof rawTarget.closest === 'function') {
      const found = rawTarget.closest(selector);
      if (found && !isExtensionElement(found)) return found;
    }
    let cur = rawTarget;
    let depth = 0;
    while (cur && depth < 5) {
      if (isExtensionElement(cur)) break;
      const tag = (cur.tagName || '').toLowerCase();
      if (tag === 'button' || tag === 'a' || cur.getAttribute('role') === 'button' || cur.getAttribute('data-testid') || cur.getAttribute('onclick')) {
        return cur;
      }
      try {
        const style = window.getComputedStyle(cur);
        if (style && style.cursor === 'pointer' && cur.parentElement && cur.parentElement !== document.body) {
          return cur;
        }
      } catch (e) {}
      cur = cur.parentElement;
      depth++;
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

  document.addEventListener('click', (event) => {
    const rawTarget = event.target;
    if (!rawTarget || !(rawTarget instanceof Element) || isExtensionElement(rawTarget)) return;

    // Pastikan input tertunda dikirimkan sebelum event click
    flushPendingInput();

    const interactiveTarget = getInteractiveTarget(rawTarget);
    if (isExtensionElement(interactiveTarget)) return;

    send({ action: 'click', element: descriptor(interactiveTarget) });
  }, true);

  // Input listener dengan support input, textarea, dan contenteditable
  document.addEventListener('input', (event) => {
    const element = event.target;
    if (!element || !(element instanceof Element) || isExtensionElement(element)) return;
    const isInputOrTextArea = element.tagName === 'INPUT' || element.tagName === 'TEXTAREA';
    const isContentEdit = element.isContentEditable || element.getAttribute('contenteditable') === 'true' || element.getAttribute('role') === 'textbox';
    if (!isInputOrTextArea && !isContentEdit) return;

    lastInputElement = element;
    if (inputTimer) clearTimeout(inputTimer);
    inputTimer = setTimeout(() => {
      flushPendingInput();
    }, 300);
  }, true);

  document.addEventListener('change', (event) => {
    flushPendingInput();
    const element = event.target;
    if (!element || !(element instanceof Element) || isExtensionElement(element)) return;
    const sensitive = isSensitive(element);
    const desc = descriptor(element);
    send({
      action: 'change',
      element: desc,
      value: sensitive ? null : (element && typeof element.value === 'string' ? element.value.slice(0, 1000) : null),
      checked: desc?.checked,
      selectedText: desc?.selectedText,
      value_redacted: sensitive
    });
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== 'Tab' && event.key !== 'Escape') return;
    flushPendingInput();
    const element = event.target;
    if (!element || !(element instanceof Element) || isExtensionElement(element)) return;
    send({ action: 'keydown', key: event.key, element: descriptor(element) });
  }, true);
})();
`;

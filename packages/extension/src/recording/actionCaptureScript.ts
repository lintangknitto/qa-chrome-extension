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

  const descriptor = (element) => {
    if (!element || !element.tagName) return null;
    const testId = element.getAttribute('data-testid')
      || element.getAttribute('data-test-id')
      || element.getAttribute('data-cy');
    const text = (element.innerText || element.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 120);
    return {
      tagName: element.tagName,
      id: element.id || undefined,
      testId: testId || undefined,
      role: element.getAttribute('role') || undefined,
      ariaLabel: element.getAttribute('aria-label') || undefined,
      placeholder: element.getAttribute('placeholder') || undefined,
      name: element.getAttribute('name') || undefined,
      text: text || undefined,
      classes: Array.from(element.classList || [])
    };
  };

  const isSensitive = (element) => {
    if (!element) return false;
    const type = (element.getAttribute('type') || '').toLowerCase();
    const name = (element.getAttribute('name') || '').toLowerCase();
    return type === 'password' || /pass|secret|token|otp/.test(name);
  };

  document.addEventListener('click', (event) => {
    send({ action: 'click', element: descriptor(event.target) });
  }, true);

  document.addEventListener('change', (event) => {
    const element = event.target;
    const sensitive = isSensitive(element);
    send({
      action: 'change',
      element: descriptor(element),
      value: sensitive ? null : (element && typeof element.value === 'string' ? element.value.slice(0, 500) : null),
      value_redacted: sensitive
    });
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== 'Tab') return;
    send({ action: 'keydown', key: event.key, element: descriptor(event.target) });
  }, true);
})();
`;

/* Protection contre les appuis répétés pour l'interface web du Moniteur JSB.
   Les actions répétables (compteur de tours AMRAP, curseur) n'utilisent pas ce verrou. */
(function (root) {
  'use strict';

  function createInteractionGate(now = () => Date.now()) {
    const last = new Map();
    const active = new Set();

    return {
      allow(action, cooldownMs = 350) {
        if (active.has(action)) return false;
        const current = now();
        const previous = last.get(action);
        if (previous !== undefined && current - previous < cooldownMs) return false;
        last.set(action, current);
        return true;
      },
      begin(action) {
        if (active.has(action)) return false;
        active.add(action);
        return true;
      },
      end(action) {
        active.delete(action);
      },
      isActive(action) {
        return active.has(action);
      },
    };
  }

  const api = { createInteractionGate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.JSBInteractionGate = api;
})(typeof window !== 'undefined' ? window : globalThis);

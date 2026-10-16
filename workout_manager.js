/* Opérations pures sur les minuteurs personnalisés.
 * Aucune écriture sur les présets système : une personnalisation devient une copie.
 */
(function (root) {
  'use strict';

  function makeCopy(workout, id) {
    return {
      ...workout,
      id,
      name: workout.name + ' (copie)',
    };
  }

  function upsertCustom(customs, workout, targetId = null) {
    if (!Array.isArray(customs)) throw new TypeError('Liste de minuteurs invalide');
    if (!targetId) return [...customs, workout];

    const index = customs.findIndex((entry) => entry.id === targetId);
    if (index < 0) throw new Error('Minuteur personnalisé introuvable');
    return customs.map((entry, i) =>
      i === index ? { ...workout, id: targetId } : entry);
  }

  function removeCustom(customs, id) {
    if (!Array.isArray(customs)) throw new TypeError('Liste de minuteurs invalide');
    return customs.filter((entry) => entry.id !== id);
  }

  const api = { makeCopy, upsertCustom, removeCustom };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.JSBWorkoutManager = api;
})(typeof window !== 'undefined' ? window : globalThis);

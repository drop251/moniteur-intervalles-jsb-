/* Catalogue local des minuteurs : favoris, tri et filtres.
 * Les données restent sur l'appareil ; aucune requête réseau.
 */
(function(root){
  'use strict';

  const MODES = Object.freeze(['all','hiit','tabata','emom','amrap','boxe']);

  function normalizeFavorites(saved, availableIds) {
    const allowed = availableIds == null ? null : new Set(availableIds);
    if(!Array.isArray(saved)) return [];
    const result = [];
    const seen = new Set();
    for(const id of saved){
      if(typeof id !== 'string' || !id.trim() || seen.has(id)) continue;
      if(allowed && !allowed.has(id)) continue;
      seen.add(id);
      result.push(id);
    }
    return result;
  }

  function toggleFavorite(saved, id) {
    const favorites = normalizeFavorites(saved);
    if(typeof id !== 'string' || !id.trim()) return favorites;
    return favorites.includes(id)
      ? favorites.filter(value => value !== id)
      : [...favorites, id];
  }

  function filterWorkouts(workouts, options = {}) {
    const mode = MODES.includes(options.mode) ? options.mode : 'all';
    const onlyFavorites = options.onlyFavorites === true;
    const favoriteSet = new Set(normalizeFavorites(options.favorites));
    // Sort stable : favoris en haut, puis ordre original des présets et créations.
    return workouts
      .filter(w => w && typeof w.id === 'string'
        && (mode === 'all' || w.kind === mode)
        && (!onlyFavorites || favoriteSet.has(w.id)))
      .sort((a,b) => Number(favoriteSet.has(b.id)) - Number(favoriteSet.has(a.id)));
  }

  const api = { MODES, normalizeFavorites, toggleFavorite, filterWorkouts };
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
  root.JSBWorkoutLibrary = api;
})(typeof window !== 'undefined' ? window : globalThis);

/* Catalogue local des minuteurs : recherche, favoris ordonnés et filtres.
 * Les données restent sur l'appareil ; aucune requête réseau.
 */
(function(root){
  'use strict';

  const MODES = Object.freeze(['all','randori','golden','random','tabata','hiit','boxe']);

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

  /* Déplacement d'une place. Utiliser -1 pour monter, +1 pour descendre. */
  function moveFavorite(saved, id, direction) {
    const favorites = normalizeFavorites(saved);
    if(direction !== -1 && direction !== 1) return favorites;
    const from = favorites.indexOf(id);
    const to = from + direction;
    if(from < 0 || to < 0 || to >= favorites.length) return favorites;
    [favorites[from],favorites[to]] = [favorites[to],favorites[from]];
    return favorites;
  }

  function normalizedSearch(text) {
    return String(text == null ? '' : text)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g,'')
      .toLocaleLowerCase('fr')
      .trim();
  }

  function filterWorkouts(workouts, options = {}) {
    // Ne jamais convertir silencieusement un ancien filtre EMOM/AMRAP en « Tous ».
    if(options.mode && !MODES.includes(options.mode)) return [];
    const mode = MODES.includes(options.mode) ? options.mode : 'all';
    const query = normalizedSearch(options.query);
    const onlyFavorites = options.onlyFavorites === true;
    const favorites = normalizeFavorites(options.favorites);
    const favoriteOrder = new Map(favorites.map((id,index) => [id,index]));
    // Favoris dans l'ordre choisi, puis non-favoris dans l'ordre du catalogue.
    return workouts
      .map((workout,index) => ({workout,index}))
      .filter(({workout:w}) => w && typeof w.id === 'string'
        && (mode === 'all' || w.kind === mode)
        && (!query || normalizedSearch(w.name).includes(query))
        && (!onlyFavorites || favoriteOrder.has(w.id)))
      .sort((a,b) => {
        const aRank = favoriteOrder.has(a.workout.id)
          ? favoriteOrder.get(a.workout.id) : Infinity;
        const bRank = favoriteOrder.has(b.workout.id)
          ? favoriteOrder.get(b.workout.id) : Infinity;
        return aRank - bRank || a.index - b.index;
      })
      .map(({workout}) => workout);
  }

  const api = { MODES, normalizeFavorites, toggleFavorite, moveFavorite,
    normalizedSearch, filterWorkouts };
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
  root.JSBWorkoutLibrary = api;
})(typeof window !== 'undefined' ? window : globalThis);

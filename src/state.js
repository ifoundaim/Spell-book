// Application state
let state = {
  spells: [],
  selectedSpell: null,
  total: 0,
  offset: 0,
  loading: {
    list: false,
    spell: false,
    save: false,
    delete: false
  },
  error: null,
  searchQuery: '',
  sortOrder: 'asc' // 'asc' | 'desc'
};

// Callback for state updates
let onStateChange = null;

/**
 * Set state change callback
 */
export function setStateChangeCallback(callback) {
  onStateChange = callback;
}

/**
 * Get current state
 */
export function getState() {
  return { ...state };
}

/**
 * Update state and trigger UI refresh
 */
function updateState(updates) {
  state = { ...state, ...updates };
  if (onStateChange) {
    onStateChange(state);
  }
}

/**
 * Set spells and total
 */
export function setSpells(spells, total) {
  updateState({ spells, total, offset: spells.length });
}

/**
 * Append spells (for pagination)
 */
export function appendSpells(newSpells, total) {
  updateState({
    spells: [...state.spells, ...newSpells],
    total,
    offset: state.spells.length + newSpells.length
  });
}

/**
 * Set selected spell
 */
export function setSelectedSpell(spell) {
  updateState({ selectedSpell: spell });
}

/**
 * Clear selected spell
 */
export function clearSelectedSpell() {
  updateState({ selectedSpell: null });
}

/**
 * Set loading state
 */
export function setLoading(key, value) {
  updateState({
    loading: { ...state.loading, [key]: value }
  });
}

/**
 * Set error
 */
export function setError(error) {
  updateState({ error });
}

/**
 * Clear error
 */
export function clearError() {
  updateState({ error: null });
}

/**
 * Set search query
 */
export function setSearchQuery(query) {
  updateState({ searchQuery: query });
}

/**
 * Set sort order
 */
export function setSortOrder(order) {
  updateState({ sortOrder: order });
}

/**
 * Update spell in list (after save)
 */
export function updateSpellInList(updatedSpell) {
  const index = state.spells.findIndex(s => s.id === updatedSpell.id);
  if (index !== -1) {
    const newSpells = [...state.spells];
    newSpells[index] = updatedSpell;
    updateState({ spells: newSpells });
  } else {
    // New spell, add to beginning
    updateState({ spells: [updatedSpell, ...state.spells], total: state.total + 1 });
  }
}

/**
 * Remove spell from list (after delete)
 */
export function removeSpellFromList(id) {
  const newSpells = state.spells.filter(s => s.id !== id);
  updateState({ spells: newSpells, total: Math.max(0, state.total - 1) });
}

/**
 * Get filtered and sorted spells
 */
export function getFilteredSpells() {
  let filtered = [...state.spells];

  // Apply search filter
  if (state.searchQuery.trim()) {
    const query = state.searchQuery.toLowerCase();
    filtered = filtered.filter(spell =>
      spell.name.toLowerCase().includes(query) ||
      spell.description.toLowerCase().includes(query) ||
      spell.element.toLowerCase().includes(query)
    );
  }

  // Apply sort
  filtered.sort((a, b) => {
    const comparison = a.name.localeCompare(b.name);
    return state.sortOrder === 'asc' ? comparison : -comparison;
  });

  return filtered;
}

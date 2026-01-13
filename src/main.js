import * as api from './api.js';
import * as state from './state.js';
import * as ui from './ui.js';

const PAGE_SIZE = 20;

/**
 * Initialize the application
 */
async function init() {
  // Set up state change callback
  state.setStateChangeCallback(ui.renderAll);

  // Set up event listeners
  setupEventListeners();

  // Load initial spells
  await loadSpells(0);
}

/**
 * Set up all event listeners
 */
function setupEventListeners() {
  // Search input
  document.addEventListener('input', (e) => {
    if (e.target.id === 'search-input') {
      state.setSearchQuery(e.target.value);
      // Only re-render the list, not controls (to preserve focus)
      ui.renderSpellList(state.getState());
    }
  });

  // Sort toggle
  document.addEventListener('click', (e) => {
    if (e.target.id === 'sort-toggle') {
      const currentState = state.getState();
      const newOrder = currentState.sortOrder === 'asc' ? 'desc' : 'asc';
      state.setSortOrder(newOrder);
      ui.renderAll(state.getState());
    }
  });

  // Load more button
  document.addEventListener('click', async (e) => {
    if (e.target.id === 'load-more-btn' && !e.target.disabled) {
      const currentState = state.getState();
      await loadSpells(currentState.offset);
    }
  });

  // Spell card clicks
  document.addEventListener('click', async (e) => {
    const card = e.target.closest('.spell-card');
    if (card) {
      const spellId = card.dataset.spellId;
      await loadSpell(spellId);
    }
  });

  // Form submit (save)
  document.addEventListener('submit', async (e) => {
    if (e.target.id === 'spell-form') {
      e.preventDefault();
      await saveSpell();
    }
  });

  // New spell button (in editor)
  document.addEventListener('click', (e) => {
    if (e.target.id === 'new-spell-btn' || e.target.closest('#new-spell-btn')) {
      createNewSpell();
    }
  });

  // Add spell button (in controls)
  document.addEventListener('click', (e) => {
    if (e.target.id === 'add-spell-btn' || e.target.closest('#add-spell-btn')) {
      createNewSpell();
    }
  });

  // Delete spell button
  document.addEventListener('click', async (e) => {
    if (e.target.id === 'delete-spell-btn' || e.target.closest('#delete-spell-btn')) {
      const currentState = state.getState();
      if (currentState.selectedSpell && currentState.selectedSpell.id) {
        await deleteSpell(currentState.selectedSpell.id);
      }
    }
  });
}

/**
 * Load spells (with pagination)
 */
async function loadSpells(offset = 0) {
  const currentState = state.getState();
  
  if (currentState.loading.list) return;

  state.setLoading('list', true);
  state.clearError();

  try {
    const response = await api.fetchSpells(PAGE_SIZE, offset);
    
    if (offset === 0) {
      state.setSpells(response.items, response.total);
    } else {
      state.appendSpells(response.items, response.total);
    }
  } catch (error) {
    state.setError(error.message);
    ui.showToast(`Failed to load spells: ${error.message}`, 'error');
  } finally {
    state.setLoading('list', false);
  }
}

/**
 * Load a single spell
 */
async function loadSpell(id) {
  const currentState = state.getState();
  
  if (currentState.loading.spell) return;

  state.setLoading('spell', true);
  state.clearError();

  try {
    const spell = await api.fetchSpell(id);
    state.setSelectedSpell(spell);
  } catch (error) {
    state.setError(error.message);
    ui.showToast(`Failed to load spell: ${error.message}`, 'error');
  } finally {
    state.setLoading('spell', false);
  }
}

/**
 * Save spell (create or update)
 */
async function saveSpell() {
  const currentState = state.getState();
  
  if (!currentState.selectedSpell || currentState.loading.save) return;

  const form = document.getElementById('spell-form');
  if (!form) return;

  // Check HTML5 validation
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  state.setLoading('save', true);
  state.clearError();

  try {
    const formData = new FormData(form);

    // Get and validate name
    const name = (formData.get('name') || '').trim();
    if (!name) {
      throw new Error('Name is required');
    }

    const ingredientsText = formData.get('ingredients') || '';
    const spellData = {
      name: name,
      element: formData.get('element'),
      rarity: formData.get('rarity'),
      manaCost: parseInt(formData.get('manaCost')) || 0,
      cooldownSec: parseInt(formData.get('cooldownSec')) || 0,
      description: formData.get('description') || '',
      ingredients: ingredientsText
        .split('\n')
        .map(ing => ing.trim())
        .filter(ing => ing.length > 0)
    };

    let savedSpell;

    if (currentState.selectedSpell.id) {
      // Update existing
      savedSpell = await api.updateSpell(currentState.selectedSpell.id, spellData);
      ui.showToast('Spell updated successfully!', 'success');
    } else {
      // Create new
      savedSpell = await api.createSpell(spellData);
      ui.showToast('Spell created successfully!', 'success');
    }

    // Update selected spell first
    state.setSelectedSpell(savedSpell);

    // If it was a new spell, reload the list from the beginning to ensure consistency
    // This ensures the spell persists and is in the correct position according to the server
    if (!currentState.selectedSpell.id) {
      // New spell - reload from beginning to get server's authoritative view
      // This ensures the spell is in the correct position and won't disappear
      await loadSpells(0);
      // Re-select the spell we just saved after reload
      state.setSelectedSpell(savedSpell);
    } else {
      // Existing spell - just update it in the list
      state.updateSpellInList(savedSpell);
    }
  } catch (error) {
    state.setError(error.message);
    ui.showToast(`Failed to save spell: ${error.message}`, 'error');
  } finally {
    state.setLoading('save', false);
  }
}

/**
 * Delete spell
 */
async function deleteSpell(id) {
  if (!confirm('Are you sure you want to delete this spell?')) {
    return;
  }

  const currentState = state.getState();
  
  if (currentState.loading.delete) return;

  state.setLoading('delete', true);
  state.clearError();

  try {
    await api.deleteSpell(id);
    
    // Remove from list
    state.removeSpellFromList(id);
    
    // Clear selection
    state.clearSelectedSpell();
    
    ui.showToast('Spell deleted successfully!', 'success');
  } catch (error) {
    state.setError(error.message);
    ui.showToast(`Failed to delete spell: ${error.message}`, 'error');
  } finally {
    state.setLoading('delete', false);
  }
}

/**
 * Create new spell (clear form)
 */
function createNewSpell() {
  const newSpell = {
    name: '',
    element: 'Arcane',
    rarity: 'Common',
    manaCost: 0,
    cooldownSec: 0,
    description: '',
    ingredients: []
  };
  
  state.setSelectedSpell(newSpell);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

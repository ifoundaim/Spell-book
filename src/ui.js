import { getFilteredSpells } from './state.js';

// SVG Icons
const ICONS = {
  quill: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M2 2l20 20M16 4l4 4-8 8-4-4 8-8zM6 6l8 8M14 14l-4-4"/>
  </svg>`,
  scroll: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M4 4h16v16H4zM8 8h8M8 12h8M8 16h6"/>
  </svg>`,
  candle: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="10" y="4" width="4" height="12" rx="1"/>
    <path d="M8 16h8M10 2v2M14 2v2"/>
  </svg>`,
  potion: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M12 2v4M10 6h4M8 8h8v12a2 2 0 01-2 2h-4a2 2 0 01-2-2V8z"/>
  </svg>`
};

/**
 * Render element chip
 */
function renderElementChip(element) {
  const colors = {
    Arcane: { bg: '#6b46c1', text: '#fff' },
    Fire: { bg: '#dc2626', text: '#fff' },
    Frost: { bg: '#0284c7', text: '#fff' },
    Storm: { bg: '#eab308', text: '#000' },
    Nature: { bg: '#16a34a', text: '#fff' }
  };
  
  const color = colors[element] || colors.Arcane;
  return `<span class="element-chip" style="background-color: ${color.bg}; color: ${color.text}">${element}</span>`;
}

/**
 * Render rarity badge
 */
function renderRarityBadge(rarity) {
  const colors = {
    Common: { bg: '#6b7280', text: '#fff' },
    Uncommon: { bg: '#16a34a', text: '#fff' },
    Rare: { bg: '#2563eb', text: '#fff' },
    Mythic: { bg: '#a855f7', text: '#fff' }
  };
  
  const color = colors[rarity] || colors.Common;
  return `<span class="rarity-badge" style="background-color: ${color.bg}; color: ${color.text}">${rarity}</span>`;
}

/**
 * Render controls panel
 */
export function renderControls(state) {
  const container = document.getElementById('controls');
  if (!container) return;

  const filteredCount = getFilteredSpells().length;
  const hasMore = state.offset < state.total;

  // Preserve focus and cursor position for search input
  const searchInput = document.getElementById('search-input');
  const wasFocused = document.activeElement === searchInput;
  const cursorPosition = wasFocused ? searchInput?.selectionStart : null;

  container.innerHTML = `
    <div class="search-container">
      <input 
        type="text" 
        id="search-input" 
        class="search-input" 
        placeholder="Search spells..." 
        value="${escapeHtml(state.searchQuery)}"
      />
    </div>
    <div class="controls-row">
      <button id="add-spell-btn" class="btn-primary">
        ${ICONS.quill} Add Spell
      </button>
      <button id="sort-toggle" class="btn-secondary">
        ${state.sortOrder === 'asc' ? 'A–Z' : 'Z–A'}
      </button>
      <button id="load-more-btn" class="btn-secondary" ${!hasMore || state.loading.list ? 'disabled' : ''}>
        Load More
      </button>
      <span class="loaded-count">Loaded: ${state.spells.length} / ${state.total}</span>
    </div>
  `;

  // Restore focus and cursor position if it was focused
  if (wasFocused && cursorPosition !== null) {
    const newSearchInput = document.getElementById('search-input');
    if (newSearchInput) {
      newSearchInput.focus();
      newSearchInput.setSelectionRange(cursorPosition, cursorPosition);
    }
  }
}

/**
 * Render spell list
 */
export function renderSpellList(state) {
  const container = document.getElementById('spell-list');
  if (!container) return;

  if (state.loading.list && state.spells.length === 0) {
    container.innerHTML = '<div class="loading-message">Loading spells...</div>';
    return;
  }

  if (state.error && state.spells.length === 0) {
    container.innerHTML = `<div class="error-message">${state.error}</div>`;
    return;
  }

  const filteredSpells = getFilteredSpells();

  if (filteredSpells.length === 0) {
    container.innerHTML = '<div class="empty-message">No spells found</div>';
    return;
  }

  container.innerHTML = filteredSpells.map(spell => `
    <div class="spell-card" data-spell-id="${spell.id}">
      <div class="spell-card-header">
        <h3 class="spell-card-name">${escapeHtml(spell.name)}</h3>
        <div class="spell-card-badges">
          ${renderElementChip(spell.element)}
          ${renderRarityBadge(spell.rarity)}
        </div>
      </div>
      <div class="spell-card-meta">
        <span>${spell.manaCost} mana</span>
        <span>•</span>
        <span>${spell.cooldownSec}s cooldown</span>
      </div>
    </div>
  `).join('');
}

/**
 * Render spell editor
 */
export function renderSpellEditor(state) {
  const container = document.getElementById('editor-panel');
  if (!container) return;

  if (!state.selectedSpell) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">${ICONS.scroll}</div>
        <p>Select a spell from the list to view or edit it, or create a new spell.</p>
      </div>
    `;
    return;
  }

  const spell = state.selectedSpell;
  const isNew = !spell.id;
  const isLoading = state.loading.save || state.loading.delete;

  container.innerHTML = `
    <div class="editor-header">
      <h2>${isNew ? 'New Spell' : 'Edit Spell'}</h2>
    </div>
    <form id="spell-form" class="spell-form">
      <div class="form-group">
        <label for="spell-name">Name *</label>
        <input 
          type="text" 
          id="spell-name" 
          name="name" 
          required 
          value="${escapeHtml(spell.name || '')}"
          ${isLoading ? 'disabled' : ''}
        />
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="spell-element">Element</label>
          <select id="spell-element" name="element" ${isLoading ? 'disabled' : ''}>
            <option value="Arcane" ${spell.element === 'Arcane' ? 'selected' : ''}>Arcane</option>
            <option value="Fire" ${spell.element === 'Fire' ? 'selected' : ''}>Fire</option>
            <option value="Frost" ${spell.element === 'Frost' ? 'selected' : ''}>Frost</option>
            <option value="Storm" ${spell.element === 'Storm' ? 'selected' : ''}>Storm</option>
            <option value="Nature" ${spell.element === 'Nature' ? 'selected' : ''}>Nature</option>
          </select>
        </div>

        <div class="form-group">
          <label for="spell-rarity">Rarity</label>
          <select id="spell-rarity" name="rarity" ${isLoading ? 'disabled' : ''}>
            <option value="Common" ${spell.rarity === 'Common' ? 'selected' : ''}>Common</option>
            <option value="Uncommon" ${spell.rarity === 'Uncommon' ? 'selected' : ''}>Uncommon</option>
            <option value="Rare" ${spell.rarity === 'Rare' ? 'selected' : ''}>Rare</option>
            <option value="Mythic" ${spell.rarity === 'Mythic' ? 'selected' : ''}>Mythic</option>
          </select>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="spell-mana-cost">Mana Cost</label>
          <input 
            type="number" 
            id="spell-mana-cost" 
            name="manaCost" 
            min="0" 
            value="${spell.manaCost || 0}"
            ${isLoading ? 'disabled' : ''}
          />
        </div>

        <div class="form-group">
          <label for="spell-cooldown">Cooldown (seconds)</label>
          <input 
            type="number" 
            id="spell-cooldown" 
            name="cooldownSec" 
            min="0" 
            value="${spell.cooldownSec || 0}"
            ${isLoading ? 'disabled' : ''}
          />
        </div>
      </div>

      <div class="form-group">
        <label for="spell-description">Description</label>
        <textarea 
          id="spell-description" 
          name="description" 
          rows="4"
          ${isLoading ? 'disabled' : ''}
        >${escapeHtml(spell.description || '')}</textarea>
      </div>

      <div class="form-group">
        <label for="spell-ingredients">Ingredients (one per line)</label>
        <textarea 
          id="spell-ingredients" 
          name="ingredients" 
          rows="4"
          placeholder="Dragon scale&#10;Moonlight essence&#10;..."
          ${isLoading ? 'disabled' : ''}
        >${(spell.ingredients || []).join('\n')}</textarea>
      </div>

      <div class="form-actions">
        <button type="button" id="new-spell-btn" class="btn-secondary" ${isLoading ? 'disabled' : ''}>
          ${ICONS.quill} New Spell
        </button>
        <div class="form-actions-right">
          <button type="button" id="delete-spell-btn" class="btn-danger" ${isNew || isLoading ? 'disabled' : ''}>
            ${ICONS.potion} Delete
          </button>
          <button type="submit" class="btn-primary" ${isLoading ? 'disabled' : ''}>
            ${ICONS.candle} Save
          </button>
        </div>
      </div>
    </form>
  `;
}

/**
 * Show toast notification
 */
export function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  
  container.appendChild(toast);

  // Trigger animation
  setTimeout(() => toast.classList.add('show'), 10);

  // Remove after delay
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Render all UI components
 */
export function renderAll(state) {
  renderControls(state);
  renderSpellList(state);
  renderSpellEditor(state);
  renderFooter(state);
}

/**
 * Render footer status
 */
function renderFooter(state) {
  const statusElement = document.getElementById('api-status');
  if (!statusElement) return;

  const apiStatus = state.apiStatus || { ok: null, message: 'Checking...' };

  if (apiStatus.ok === true) {
    statusElement.textContent = 'API: Connected';
    statusElement.className = 'api-status api-status-ok';
    return;
  }

  if (apiStatus.ok === false) {
    const message = apiStatus.message ? ` (${apiStatus.message})` : '';
    statusElement.textContent = `API: Not reachable${message}`;
    statusElement.className = 'api-status api-status-error';
    return;
  }

  statusElement.textContent = 'API: Checking...';
  statusElement.className = 'api-status api-status-pending';
}

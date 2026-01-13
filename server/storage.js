import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const SPELLS_FILE = path.join(DATA_DIR, 'spells.json');
const TRASH_FILE = path.join(DATA_DIR, 'trash.json');

// In-memory cache
let spellsCache = null;
let trashCache = null;

/**
 * Ensure data directory exists
 */
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * Load spells from JSON file
 */
export function loadSpells() {
  if (spellsCache !== null) {
    return spellsCache;
  }

  ensureDataDir();

  if (!fs.existsSync(SPELLS_FILE)) {
    spellsCache = [];
    saveSpells(); // Create empty file
    return spellsCache;
  }

  try {
    const data = fs.readFileSync(SPELLS_FILE, 'utf8');
    spellsCache = JSON.parse(data);
    if (!Array.isArray(spellsCache)) {
      spellsCache = [];
    }
    return spellsCache;
  } catch (error) {
    console.error('Error loading spells:', error);
    spellsCache = [];
    return spellsCache;
  }
}

/**
 * Save spells to JSON file
 */
export function saveSpells() {
  ensureDataDir();

  try {
    fs.writeFileSync(SPELLS_FILE, JSON.stringify(spellsCache, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error saving spells:', error);
    return false;
  }
}

/**
 * Get spell by ID
 */
export function getSpellById(id) {
  const spells = loadSpells();
  return spells.find(spell => spell.id === id) || null;
}

/**
 * Add a new spell
 */
export function addSpell(spell) {
  const spells = loadSpells();
  spells.push(spell);
  saveSpells();
  return spell;
}

/**
 * Update an existing spell
 */
export function updateSpell(id, updates) {
  const spells = loadSpells();
  const index = spells.findIndex(spell => spell.id === id);
  
  if (index === -1) {
    return null;
  }

  spells[index] = { ...spells[index], ...updates };
  saveSpells();
  return spells[index];
}

/**
 * Load trash (deleted spells)
 */
function loadTrash() {
  if (trashCache !== null) {
    return trashCache;
  }

  ensureDataDir();

  if (!fs.existsSync(TRASH_FILE)) {
    trashCache = [];
    saveTrash();
    return trashCache;
  }

  try {
    const data = fs.readFileSync(TRASH_FILE, 'utf8');
    trashCache = JSON.parse(data);
    if (!Array.isArray(trashCache)) {
      trashCache = [];
    }
    return trashCache;
  } catch (error) {
    console.error('Error loading trash:', error);
    trashCache = [];
    return trashCache;
  }
}

/**
 * Save trash to JSON file
 */
function saveTrash() {
  ensureDataDir();

  try {
    fs.writeFileSync(TRASH_FILE, JSON.stringify(trashCache, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error saving trash:', error);
    return false;
  }
}

/**
 * Delete a spell (moves to trash)
 */
export function deleteSpell(id) {
  const spells = loadSpells();
  const index = spells.findIndex(spell => spell.id === id);
  
  if (index === -1) {
    return null;
  }

  const deletedSpell = spells[index];
  const trash = loadTrash();
  
  // Add deletion timestamp
  const trashedSpell = {
    ...deletedSpell,
    deletedAt: new Date().toISOString()
  };
  
  trash.push(trashedSpell);
  saveTrash();
  
  spells.splice(index, 1);
  saveSpells();
  
  return deletedSpell; // Return the spell that was deleted
}

/**
 * Get all deleted spells
 */
export function getTrash() {
  return loadTrash();
}

/**
 * Restore a spell from trash
 */
export function restoreSpell(id) {
  const trash = loadTrash();
  const index = trash.findIndex(spell => spell.id === id);
  
  if (index === -1) {
    return null;
  }

  const spellToRestore = trash[index];
  // Remove deletedAt field
  const { deletedAt, ...spell } = spellToRestore;
  
  const spells = loadSpells();
  spells.push(spell);
  saveSpells();
  
  trash.splice(index, 1);
  saveTrash();
  
  return spell;
}

/**
 * Get paginated spells
 */
export function getSpellsPaginated(limit = 20, offset = 0) {
  const spells = loadSpells();
  
  // Sort by creation date (newest first) to ensure consistent ordering
  const sortedSpells = [...spells].sort((a, b) => {
    const dateA = new Date(a.createdAt || 0);
    const dateB = new Date(b.createdAt || 0);
    return dateB - dateA; // Newest first
  });
  
  const total = sortedSpells.length;
  const items = sortedSpells.slice(offset, offset + limit);
  
  return { items, total };
}

import express from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  loadSpells,
  getSpellById,
  addSpell,
  updateSpell,
  deleteSpell,
  getSpellsPaginated,
  getTrash,
  restoreSpell
} from './storage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOG_FILE = path.join(__dirname, 'request.log');

// Logging helper
function logToFile(message, data = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    message,
    ...data
  };
  const logLine = JSON.stringify(logEntry) + '\n';
  fs.appendFileSync(LOG_FILE, logLine, 'utf8');
  console.log(`[${logEntry.timestamp}] ${message}`, data);
}

const app = express();
const PORT = 5174;

// Middleware
app.use(cors({
  origin: 'http://localhost:5173'
}));
app.use(express.json());

// Validation helpers
const ELEMENTS = ['Arcane', 'Fire', 'Frost', 'Storm', 'Nature'];
const RARITIES = ['Common', 'Uncommon', 'Rare', 'Mythic'];

function validateSpell(spell, isUpdate = false) {
  const errors = [];

  if (!isUpdate || spell.name !== undefined) {
    if (!spell.name || typeof spell.name !== 'string' || spell.name.trim() === '') {
      errors.push('name is required and must be a non-empty string');
    }
  }

  if (spell.element !== undefined && !ELEMENTS.includes(spell.element)) {
    errors.push(`element must be one of: ${ELEMENTS.join(', ')}`);
  }

  if (spell.rarity !== undefined && !RARITIES.includes(spell.rarity)) {
    errors.push(`rarity must be one of: ${RARITIES.join(', ')}`);
  }

  if (spell.manaCost !== undefined && (typeof spell.manaCost !== 'number' || spell.manaCost < 0)) {
    errors.push('manaCost must be a non-negative number');
  }

  if (spell.cooldownSec !== undefined && (typeof spell.cooldownSec !== 'number' || spell.cooldownSec < 0)) {
    errors.push('cooldownSec must be a non-negative number');
  }

  if (spell.description !== undefined && typeof spell.description !== 'string') {
    errors.push('description must be a string');
  }

  if (spell.ingredients !== undefined) {
    if (!Array.isArray(spell.ingredients)) {
      errors.push('ingredients must be an array');
    } else if (!spell.ingredients.every(ing => typeof ing === 'string')) {
      errors.push('ingredients must be an array of strings');
    }
  }

  return errors;
}

// Routes

// GET /spells - Paginated list
app.get('/spells', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;

    if (limit < 1 || limit > 100) {
      return res.status(400).json({ error: 'limit must be between 1 and 100' });
    }

    if (offset < 0) {
      return res.status(400).json({ error: 'offset must be non-negative' });
    }

    const { items, total } = getSpellsPaginated(limit, offset);
    res.json({ items, total });
  } catch (error) {
    console.error('Error fetching spells:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /spells/:id - Single spell
app.get('/spells/:id', (req, res) => {
  try {
    const spell = getSpellById(req.params.id);
    
    if (!spell) {
      return res.status(404).json({ error: 'Spell not found' });
    }

    res.json(spell);
  } catch (error) {
    console.error('Error fetching spell:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /spells - Create spell
app.post('/spells', (req, res) => {
  try {
    const errors = validateSpell(req.body, false);
    
    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join('; ') });
    }

    const now = new Date().toISOString();
    const spell = {
      id: randomUUID(),
      name: req.body.name.trim(),
      element: req.body.element || 'Arcane',
      rarity: req.body.rarity || 'Common',
      manaCost: req.body.manaCost || 0,
      cooldownSec: req.body.cooldownSec || 0,
      description: req.body.description || '',
      ingredients: req.body.ingredients || [],
      createdAt: now,
      updatedAt: now
    };

    const savedSpell = addSpell(spell);
    res.status(201).json(savedSpell);
  } catch (error) {
    console.error('Error creating spell:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /spells/:id - Update spell
app.put('/spells/:id', (req, res) => {
  logToFile(`PUT /spells/${req.params.id}`, {
    spellId: req.params.id,
    updates: req.body
  });
  
  try {
    const existingSpell = getSpellById(req.params.id);
    
    if (!existingSpell) {
      return res.status(404).json({ error: 'Spell not found' });
    }

    const errors = validateSpell(req.body, true);
    
    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join('; ') });
    }

    const updates = {
      ...req.body,
      updatedAt: new Date().toISOString()
    };

    // Preserve id and createdAt
    if (req.body.name !== undefined) {
      updates.name = req.body.name.trim();
    }

    const updatedSpell = updateSpell(req.params.id, updates);
    
    if (!updatedSpell) {
      return res.status(404).json({ error: 'Spell not found' });
    }

    logToFile(`PUT Success - Updated spell ${req.params.id}`, {
      spellId: req.params.id,
      name: updatedSpell.name,
      element: updatedSpell.element,
      rarity: updatedSpell.rarity,
      updatedAt: updatedSpell.updatedAt
    });

    res.json(updatedSpell);
  } catch (error) {
    console.error('Error updating spell:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /spells/:id - Delete spell
app.delete('/spells/:id', (req, res) => {
  try {
    const spellToDelete = getSpellById(req.params.id);
    
    if (!spellToDelete) {
      return res.status(404).json({ error: 'Spell not found' });
    }

    const deletedSpell = deleteSpell(req.params.id);
    
    if (!deletedSpell) {
      return res.status(404).json({ error: 'Spell not found' });
    }

    logToFile(`DELETE /spells/${req.params.id}`, {
      spellId: req.params.id,
      deletedSpell: deletedSpell
    });

    res.json({ ok: true, deleted: deletedSpell });
  } catch (error) {
    console.error('Error deleting spell:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /trash - Get deleted spells
app.get('/trash', (req, res) => {
  try {
    const trash = getTrash();
    res.json(trash);
  } catch (error) {
    console.error('Error fetching trash:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /trash/:id/restore - Restore a deleted spell
app.post('/trash/:id/restore', (req, res) => {
  try {
    const restoredSpell = restoreSpell(req.params.id);
    
    if (!restoredSpell) {
      return res.status(404).json({ error: 'Spell not found in trash' });
    }

    logToFile(`RESTORE /trash/${req.params.id}`, {
      spellId: req.params.id,
      restoredSpell: restoredSpell
    });

    res.json(restoredSpell);
  } catch (error) {
    console.error('Error restoring spell:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Spellbook API server running on http://localhost:${PORT}`);
});

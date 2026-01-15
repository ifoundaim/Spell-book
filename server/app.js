import express from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
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

function createError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

const app = express();

const LOCAL_ORIGIN = 'http://localhost:5173';
const corsOrigin = process.env.CORS_ORIGIN;
const isProduction = process.env.NODE_ENV === 'production';
const allowAllOrigins = isProduction && !corsOrigin;
const allowedOrigins = new Set([LOCAL_ORIGIN, corsOrigin].filter(Boolean));

if (allowAllOrigins) {
  console.warn('CORS_ORIGIN not set; allowing all origins for demo only.');
}

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }

    if (allowAllOrigins) {
      return callback(null, true);
    }

    if (allowedOrigins.has(origin)) {
      return callback(null, true);
    }

    return callback(createError(403, 'CORS origin not allowed'));
  }
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
app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// GET /spells - Paginated list
app.get('/spells', (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;

    if (limit < 1 || limit > 100) {
      return next(createError(400, 'limit must be between 1 and 100'));
    }

    if (offset < 0) {
      return next(createError(400, 'offset must be non-negative'));
    }

    const { items, total } = getSpellsPaginated(limit, offset);
    res.json({ items, total });
  } catch (error) {
    console.error('Error fetching spells:', error);
    next(createError(500, 'Internal server error'));
  }
});

// GET /spells/:id - Single spell
app.get('/spells/:id', (req, res, next) => {
  try {
    const spell = getSpellById(req.params.id);

    if (!spell) {
      return next(createError(404, 'Spell not found'));
    }

    res.json(spell);
  } catch (error) {
    console.error('Error fetching spell:', error);
    next(createError(500, 'Internal server error'));
  }
});

// POST /spells - Create spell
app.post('/spells', (req, res, next) => {
  try {
    const errors = validateSpell(req.body, false);

    if (errors.length > 0) {
      return next(createError(400, errors.join('; ')));
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
    next(createError(500, 'Internal server error'));
  }
});

// PUT /spells/:id - Update spell
app.put('/spells/:id', (req, res, next) => {
  logToFile(`PUT /spells/${req.params.id}`, {
    spellId: req.params.id,
    updates: req.body
  });

  try {
    const existingSpell = getSpellById(req.params.id);

    if (!existingSpell) {
      return next(createError(404, 'Spell not found'));
    }

    const errors = validateSpell(req.body, true);

    if (errors.length > 0) {
      return next(createError(400, errors.join('; ')));
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
      return next(createError(404, 'Spell not found'));
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
    next(createError(500, 'Internal server error'));
  }
});

// DELETE /spells/:id - Delete spell
app.delete('/spells/:id', (req, res, next) => {
  try {
    const spellToDelete = getSpellById(req.params.id);

    if (!spellToDelete) {
      return next(createError(404, 'Spell not found'));
    }

    const deletedSpell = deleteSpell(req.params.id);

    if (!deletedSpell) {
      return next(createError(404, 'Spell not found'));
    }

    logToFile(`DELETE /spells/${req.params.id}`, {
      spellId: req.params.id,
      deletedSpell: deletedSpell
    });

    res.json({ ok: true, deleted: deletedSpell });
  } catch (error) {
    console.error('Error deleting spell:', error);
    next(createError(500, 'Internal server error'));
  }
});

// GET /trash - Get deleted spells
app.get('/trash', (req, res, next) => {
  try {
    const trash = getTrash();
    res.json(trash);
  } catch (error) {
    console.error('Error fetching trash:', error);
    next(createError(500, 'Internal server error'));
  }
});

// POST /trash/:id/restore - Restore a deleted spell
app.post('/trash/:id/restore', (req, res, next) => {
  try {
    const restoredSpell = restoreSpell(req.params.id);

    if (!restoredSpell) {
      return next(createError(404, 'Spell not found in trash'));
    }

    logToFile(`RESTORE /trash/${req.params.id}`, {
      spellId: req.params.id,
      restoredSpell: restoredSpell
    });

    res.json(restoredSpell);
  } catch (error) {
    console.error('Error restoring spell:', error);
    next(createError(500, 'Internal server error'));
  }
});

app.use((req, res) => {
  res.status(404).json({ message: 'Not found' });
});

app.use((err, req, res, next) => {
  const status = err.status || 500;
  const message = err.message || 'Internal server error';

  if (status >= 500) {
    console.error('Unhandled error:', err);
  }

  res.status(status).json({ message });
});

export { app, createError };

import express from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getSupabaseClientFromEnv } from './supabaseClient.js';
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
// Allow tests to override via `app.set('supabase', mockClient)`
app.set('supabase', getSupabaseClientFromEnv());

const LOCAL_ORIGIN = 'http://localhost:5173';
const PROD_FRONTEND_ORIGIN = 'https://spell-book.pages.dev';
const RENDER_FRONTEND_ORIGIN = 'https://spell-book-ccv1.onrender.com';
const ALLOWED_ORIGINS = new Set([
  LOCAL_ORIGIN,
  PROD_FRONTEND_ORIGIN,
  RENDER_FRONTEND_ORIGIN
]);

const corsBaseOptions = {
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 204
};

function corsOptionsDelegate(req, callback) {
  const origin = req.header('Origin');

  // Non-browser or same-origin requests: allow, but don't emit CORS headers.
  if (!origin) {
    return callback(null, { ...corsBaseOptions, origin: false });
  }

  if (ALLOWED_ORIGINS.has(origin)) {
    return callback(null, { ...corsBaseOptions, origin });
  }

  // Disallowed origin: do not emit CORS headers. Do NOT 403; let browser enforce.
  logToFile('CORS: origin not allowed', {
    origin,
    method: req.method,
    url: req.originalUrl
  });
  return callback(null, { ...corsBaseOptions, origin: false });
}

// Middleware
app.use(cors(corsOptionsDelegate));
app.options('*', cors(corsOptionsDelegate));
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
app.get('/debug', (req, res) => {
  const safeHeaders = {
    origin: req.headers.origin,
    host: req.headers.host,
    referer: req.headers.referer,
    'user-agent': req.headers['user-agent'],
    'access-control-request-method': req.headers['access-control-request-method'],
    'access-control-request-headers': req.headers['access-control-request-headers']
  };

  res.json({
    ok: true,
    origin: req.headers.origin || null,
    method: req.method,
    url: req.originalUrl,
    headers: safeHeaders,
    env: {
      NODE_ENV: process.env.NODE_ENV ?? null,
      ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS ?? null
    }
  });
});

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// GET /spells - Paginated list
app.get('/spells', async (req, res, next) => {
  try {
    const limitParsed = parseInt(String(req.query.limit ?? '20'), 10);
    const offsetParsed = parseInt(String(req.query.offset ?? '0'), 10);

    if (Number.isNaN(limitParsed)) {
      return next(createError(400, 'limit must be a number'));
    }

    if (Number.isNaN(offsetParsed)) {
      return next(createError(400, 'offset must be a number'));
    }

    const limit = Math.min(limitParsed, 50);
    const offset = Math.max(offsetParsed, 0);

    if (limit < 1) {
      return next(createError(400, 'limit must be at least 1'));
    }

    const from = offset;
    const to = offset + limit - 1;

    const supabase = req.app.get('supabase');

    // Back-compat for local dev when Supabase env vars aren't configured.
    if (!supabase) {
      const { items, total } = getSpellsPaginated(limit, offset);
      return res.json({ items, limit, offset, total });
    }

    const { data, error, count } = await supabase
      .from('spells')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) return res.status(500).json({ error: error.message });

    res.json({
      items: data,
      limit,
      offset,
      total: count ?? 0
    });
  } catch (error) {
    console.error('Error fetching spells:', error);
    next(createError(500, 'Internal server error'));
  }
});

// GET /spells/:id - Single spell
app.get('/spells/:id', async (req, res, next) => {
  try {
    const supabase = req.app.get('supabase');

    if (!supabase) {
      return next(createError(500, 'Supabase client not configured'));
    }

    const { data, error } = await supabase
      .from('spells')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();

    if (error) {
      return next(createError(500, error.message));
    }

    if (!data) {
      return next(createError(404, 'Spell not found'));
    }

    res.json(data);
  } catch (error) {
    console.error('Error fetching spell:', error);
    next(createError(500, 'Internal server error'));
  }
});

// POST /spells - Create spell
app.post('/spells', async (req, res, next) => {
  try {
    const errors = validateSpell(req.body, false);

    if (errors.length > 0) {
      return next(createError(400, errors.join('; ')));
    }

    const supabase = req.app.get('supabase');

    if (!supabase) {
      return next(createError(500, 'Supabase client not configured'));
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
      created_at: now,
      updated_at: now
    };

    const { data, error } = await supabase
      .from('spells')
      .insert(spell)
      .select()
      .maybeSingle();

    if (error) {
      return next(createError(500, error.message));
    }

    if (!data) {
      return next(createError(500, 'Failed to create spell'));
    }

    res.status(201).json(data);
  } catch (error) {
    console.error('Error creating spell:', error);
    next(createError(500, 'Internal server error'));
  }
});

// PUT /spells/:id - Update spell
app.put('/spells/:id', async (req, res, next) => {
  logToFile(`PUT /spells/${req.params.id}`, {
    spellId: req.params.id,
    updates: req.body
  });

  try {
    const supabase = req.app.get('supabase');

    if (!supabase) {
      return next(createError(500, 'Supabase client not configured'));
    }

    const errors = validateSpell(req.body, true);

    if (errors.length > 0) {
      return next(createError(400, errors.join('; ')));
    }

    const updates = {
      ...req.body,
      updated_at: new Date().toISOString()
    };

    // Preserve id and createdAt
    if (req.body.name !== undefined) {
      updates.name = req.body.name.trim();
    }

    const { data, error } = await supabase
      .from('spells')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .maybeSingle();

    if (error) {
      return next(createError(500, error.message));
    }

    if (!data) {
      return next(createError(404, 'Spell not found'));
    }

    logToFile(`PUT Success - Updated spell ${req.params.id}`, {
      spellId: req.params.id,
      name: data.name,
      element: data.element,
      rarity: data.rarity,
      updatedAt: data.updated_at ?? null
    });

    res.json(data);
  } catch (error) {
    console.error('Error updating spell:', error);
    next(createError(500, 'Internal server error'));
  }
});

// DELETE /spells/:id - Delete spell
app.delete('/spells/:id', async (req, res, next) => {
  try {
    const supabase = req.app.get('supabase');

    if (!supabase) {
      return next(createError(500, 'Supabase client not configured'));
    }

    const { data, error } = await supabase
      .from('spells')
      .delete()
      .eq('id', req.params.id)
      .select()
      .maybeSingle();

    if (error) {
      return next(createError(500, error.message));
    }

    if (!data) {
      return next(createError(404, 'Spell not found'));
    }

    logToFile(`DELETE /spells/${req.params.id}`, {
      spellId: req.params.id,
      deletedSpell: data
    });

    res.status(204).send();
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

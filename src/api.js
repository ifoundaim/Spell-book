const API_BASE = '/api';

/**
 * Fetch paginated spells
 */
export async function fetchSpells(limit = 20, offset = 0) {
  try {
    const response = await fetch(`${API_BASE}/spells?limit=${limit}&offset=${offset}`);
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to fetch spells' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    throw new Error(error.message || 'Failed to fetch spells');
  }
}

/**
 * Fetch a single spell by ID
 */
export async function fetchSpell(id) {
  try {
    const response = await fetch(`${API_BASE}/spells/${id}`);
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Spell not found' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    throw new Error(error.message || 'Failed to fetch spell');
  }
}

/**
 * Create a new spell
 */
export async function createSpell(spell) {
  try {
    const response = await fetch(`${API_BASE}/spells`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(spell)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to create spell' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    throw new Error(error.message || 'Failed to create spell');
  }
}

/**
 * Update an existing spell
 */
export async function updateSpell(id, spell) {
  try {
    const response = await fetch(`${API_BASE}/spells/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(spell)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to update spell' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    throw new Error(error.message || 'Failed to update spell');
  }
}

/**
 * Delete a spell
 */
export async function deleteSpell(id) {
  try {
    const response = await fetch(`${API_BASE}/spells/${id}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to delete spell' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    throw new Error(error.message || 'Failed to delete spell');
  }
}

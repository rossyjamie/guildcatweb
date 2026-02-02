// server.js
const express = require('express');
const path = require('path');

// Import fetch - use native fetch if Node 18+, otherwise use node-fetch
let fetch;
if (typeof global.fetch === 'function') {
  fetch = global.fetch;
} else {
  fetch = require('node-fetch');
}

const app = express();

// Map place IDs to universe IDs
const GAME_MAPPINGS = {
  '115461364475281': '8947950112',  // Ice Boat Racing
  '132547252102193': '8798246146'   // 1 Kill = 1 Armor! (replace with actual universe ID)
};

// Cache to store server data for each game
let cache = {};
const CACHE_DURATION = 10000; // 10 seconds
let isRefreshing = {};

// serve static files (HTML, JS, CSS) from current folder
app.use(express.static(__dirname));

// endpoint to get live players for a specific game
app.get('/live-players/:placeId', async (req, res) => {
  try {
    const { placeId } = req.params;
    const universeId = GAME_MAPPINGS[placeId];
    
    if (!universeId) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    const now = Date.now();
    
    // Initialize cache for this game if it doesn't exist
    if (!cache[universeId]) {
      cache[universeId] = { data: null, lastFetch: 0 };
    }
    
    // Always return cached data immediately if available (even if stale)
    if (cache[universeId].data) {
      console.log(`DEBUG: Returning cached data for universe ${universeId}`);
      const gameInfo = cache[universeId].data.data?.[0];
      const totalPlayers = gameInfo?.playing || 0;
      
      res.json({
        game: gameInfo,
        totalPlayers: totalPlayers
      });
      
      // If cache is stale, refresh in background (don't wait for it)
      if (now - cache[universeId].lastFetch >= CACHE_DURATION) {
        console.log(`DEBUG: Cache stale for universe ${universeId}, refreshing in background`);
        refreshCache(universeId);
      }
      return;
    }
    
    // No cache yet, fetch immediately
    console.log(`DEBUG: No cache for universe ${universeId}, fetching immediately`);
    await fetchAndCacheGameData(universeId);
    
    const gameInfo = cache[universeId].data?.data?.[0];
    const totalPlayers = gameInfo?.playing || 0;
    
    res.json({
      game: gameInfo,
      totalPlayers: totalPlayers
    });
  } catch (err) {
    console.error("DEBUG: Failed to fetch live players", err);
    res.status(500).json({ error: `Failed to fetch live players: ${err.message}` });
  }
});

// Helper function to fetch and cache game data
async function fetchAndCacheGameData(universeId) {
  try {
    const gameUrl = `https://games.roblox.com/v1/games?universeIds=${universeId}`;
    
    const gameRes = await fetch(gameUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    console.log(`DEBUG: Games API status for ${universeId}:`, gameRes.status);
    const responseText = await gameRes.text();
    
    if (!gameRes.ok) {
      throw new Error(`Games API returned ${gameRes.status}: ${responseText}`);
    }
    
    const data = JSON.parse(responseText);
    console.log(`DEBUG: Games API response updated for ${universeId}`);
    
    if (!cache[universeId]) {
      cache[universeId] = {};
    }
    cache[universeId].data = data;
    cache[universeId].lastFetch = Date.now();
  } catch (err) {
    console.error(`DEBUG: Failed to refresh cache for ${universeId}`, err);
  }
}

// Refresh cache in background
function refreshCache(universeId) {
  if (isRefreshing[universeId]) return;
  isRefreshing[universeId] = true;
  fetchAndCacheGameData(universeId).finally(() => {
    isRefreshing[universeId] = false;
  });
}

// serve your HTML page at root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'guild-cat.html'));
});

// start server
const PORT = 3000;
app.listen(PORT, async () => {
  console.log(`Server running at http://localhost:${PORT}`);
  
  // Warm the cache for all games
  for (const universeId of Object.values(GAME_MAPPINGS)) {
    await fetchAndCacheGameData(universeId);
  }
});
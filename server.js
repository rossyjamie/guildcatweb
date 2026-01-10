// server.js
const express = require('express');
const path = require('path');

// Import fetch - use native fetch if Node 18+, otherwise use node-fetch
let fetch;
try {
  fetch = global.fetch;
} catch {
  fetch = require('node-fetch');
}

const app = express();
const UNIVERSE_ID = '8947950112'; // your Roblox universe ID

// Cache to store server data
let cache = {
  servers: null,
  lastFetch: 0
};

const CACHE_DURATION = 10000; // 10 seconds

// serve static files (HTML, JS, CSS) from current folder
app.use(express.static(__dirname));

// endpoint to get live players
app.get('/live-players', async (req, res) => {
  try {
    const now = Date.now();
    
    // Always return cached data immediately if available (even if stale)
    if (cache.servers) {
      console.log("DEBUG: Returning cached data");
      const gameInfo = cache.servers.data?.[0];
      const totalPlayers = gameInfo?.playing || 0;
      
      res.json({
        game: gameInfo,
        totalPlayers: totalPlayers
      });
      
      // If cache is stale, refresh in background (don't wait for it)
      if (now - cache.lastFetch >= CACHE_DURATION) {
        console.log("DEBUG: Cache stale, refreshing in background");
        refreshCache();
      }
      return;
    }
    
    // No cache yet, fetch immediately
    console.log("DEBUG: No cache, fetching immediately");
    await fetchAndCacheGameData();
    
    const gameInfo = cache.servers.data?.[0];
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
async function fetchAndCacheGameData() {
  try {
    const gameUrl = `https://games.roblox.com/v1/games?universeIds=${UNIVERSE_ID}`;
    
    const gameRes = await fetch(gameUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    console.log("DEBUG: Games API status:", gameRes.status);
    const responseText = await gameRes.text();
    
    if (!gameRes.ok) {
      throw new Error(`Games API returned ${gameRes.status}: ${responseText}`);
    }
    
    const data = JSON.parse(responseText);
    console.log("DEBUG: Games API response updated");
    
    cache.servers = data;
    cache.lastFetch = Date.now();
  } catch (err) {
    console.error("DEBUG: Failed to refresh cache", err);
  }
}

// Refresh cache in background
function refreshCache() {
  fetchAndCacheGameData();
}

// serve your HTML page at root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'guild-cat.html'));
});

// start server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
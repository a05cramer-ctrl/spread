SPREAD site

Vercel
Env var: HELIUS_API_KEY  (your Helius key)

config.js
VAULT = the address the engine prints on its first run
CA, X after launch
LEV / FEE_BPS / MIN_BET / MAX_BET must match the engine's .env

The site reads positions from the snapshot the engine publishes every 5 minutes
(memo SPREAD-STATE on the vault, JSON on Filebase IPFS), so the engine needs
FILEBASE_IPFS_TOKEN in its .env.

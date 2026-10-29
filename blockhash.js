// GET /api/blockhash — fresh blockhash for the bet transaction (env HELIUS_API_KEY)
module.exports = async (req, res) => {
  try {
    const r = await fetch(`https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getLatestBlockhash', params: [{ commitment: 'confirmed' }] })
    });
    const d = await r.json();
    if (!d.result) throw new Error(d.error?.message || 'rpc');
    res.setHeader('Cache-Control', 'no-store');
    res.json(d.result.value);
  } catch (e) {
    res.status(502).json({ error: String(e.message || e) });
  }
};

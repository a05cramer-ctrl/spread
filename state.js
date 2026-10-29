// GET /api/state?v=<vault>
// Latest public snapshot the engine published: memo "SPREAD-STATE|<t>|<cid>" paid by the vault, JSON on IPFS.
// env HELIUS_API_KEY
const B58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const MEMO = /SPREAD-STATE\|(\d+)\|([a-z0-9]{20,})/i;
const rpcUrl = () => `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`;
async function rpc(method, params) {
  const r = await fetch(rpcUrl(), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  const d = await r.json(); if (d.error) throw new Error(d.error.message); return d.result;
}

module.exports = async (req, res) => {
  const vault = String(req.query.v || '');
  if (!B58.test(vault)) return res.status(400).json({ error: 'bad vault' });
  try {
    const sigs = await rpc('getSignaturesForAddress', [vault, { limit: 300, commitment: 'confirmed' }]);
    let found = null;
    for (const s of sigs) {
      if (s.err || !s.memo) continue;
      const m = s.memo.match(MEMO); if (!m) continue;
      const tx = await rpc('getTransaction', [s.signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'confirmed' }]);
      const k = tx?.transaction?.message?.accountKeys?.[0];
      const payer = typeof k === 'string' ? k : k?.pubkey;
      if (payer !== vault) continue; // only the vault's own receipts count
      found = { t: +m[1], cid: m[2], sig: s.signature }; break;
    }
    if (!found) { res.setHeader('Cache-Control', 's-maxage=20'); return res.json({ state: null }); }
    const r = await fetch(`https://ipfs.filebase.io/ipfs/${found.cid}`);
    if (!r.ok) throw new Error('ipfs ' + r.status);
    const state = await r.json();
    // names + images for every mint in the snapshot
    const mints = [...new Set((state.markets || []).flatMap(m => [m.x, m.y]).concat((state.positions || []).flatMap(p => [p.long, p.short])))].filter(x => B58.test(x));
    const names = {};
    for (let i = 0; i < mints.length; i += 30) {
      try {
        const x = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${mints.slice(i, i + 30).join(',')}`);
        for (const p of await x.json()) for (const t of [p.baseToken, p.quoteToken]) if (mints.includes(t.address) && !names[t.address]) names[t.address] = { symbol: t.symbol, name: t.name, image: p.info?.imageUrl || '' };
      } catch (e) {}
    }
    res.setHeader('Cache-Control', 's-maxage=20, stale-while-revalidate=60');
    res.json({ state, names, receipt: found });
  } catch (e) {
    res.status(502).json({ error: String(e.message || e) });
  }
};

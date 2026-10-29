// GET /api/pair?a=<longMint>&b=<shortMint>
// Both coins' deepest pools (DexScreener) + 5-minute candles (GeckoTerminal, USD) -> ratio series a/b over ~6h.
const B58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

async function j(url) {
  const r = await fetch(url, { headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(url.split('/').slice(2, 3)[0] + ' ' + r.status);
  return r.json();
}
async function coin(mint) {
  const pairs = await j(`https://api.dexscreener.com/token-pairs/v1/solana/${mint}`);
  if (!Array.isArray(pairs) || !pairs.length) throw new Error('no pool for ' + mint.slice(0, 4));
  pairs.sort((x, y) => (y.liquidity?.usd || 0) - (x.liquidity?.usd || 0));
  const p = pairs[0], t = p.baseToken?.address === mint ? p.baseToken : p.quoteToken;
  const g = await j(`https://api.geckoterminal.com/api/v2/networks/solana/pools/${p.pairAddress}/ohlcv/minute?aggregate=5&limit=80&currency=usd&token=${mint}`);
  const m = new Map();
  for (const c of g?.data?.attributes?.ohlcv_list || []) m.set(c[0], c[4]);
  return {
    mint, name: t?.name || '', symbol: t?.symbol || '', image: p.info?.imageUrl || '',
    pair: p.pairAddress, dex: p.dexId, liquidity: p.liquidity?.usd || 0,
    price: Number(p.priceUsd) || null, candles: [...m.entries()].sort((x, y) => x[0] - y[0])
  };
}

module.exports = async (req, res) => {
  const a = String(req.query.a || ''), b = String(req.query.b || '');
  if (!B58.test(a) || !B58.test(b) || a === b) return res.status(400).json({ error: 'pick two different coins' });
  try {
    const [A, B] = await Promise.all([coin(a), coin(b)]);
    // align on 5-minute buckets, forward-fill the quieter coin
    const ts = [...new Set([...A.candles.map(c => c[0]), ...B.candles.map(c => c[0])])].sort((x, y) => x - y);
    const ma = new Map(A.candles), mb = new Map(B.candles);
    let pa = null, pb = null; const series = [];
    for (const t of ts) {
      if (ma.has(t)) pa = ma.get(t); if (mb.has(t)) pb = mb.get(t);
      if (pa && pb) series.push([t, pa / pb]);
    }
    delete A.candles; delete B.candles;
    res.setHeader('Cache-Control', 's-maxage=20, stale-while-revalidate=40');
    res.json({ a: A, b: B, series: series.slice(-72) });
  } catch (e) {
    res.status(502).json({ error: String(e.message || e) });
  }
};

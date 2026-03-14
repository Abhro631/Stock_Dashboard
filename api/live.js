const https = require("https");

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json",
        "Accept-Language": "en-US,en;q=0.9",
      },
    };
    const req = https.get(url, options, (res) => {
      if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve({ body: Buffer.concat(chunks).toString("utf-8"), status: res.statusCode }));
    });
    req.on("error", reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error("Timeout")); });
  });
}

function calculateRSI(closes, period = 14) {
  if (!closes || closes.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff; else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (diff >= 0 ? diff : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period;
  }
  if (avgLoss === 0) return 100;
  return parseFloat((100 - 100 / (1 + avgGain / avgLoss)).toFixed(2));
}

async function fetchQuoteChunk(symbols) {
  const syms = symbols.map(s => `${s}.NS`).join(",");
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(syms)}&fields=regularMarketPrice,regularMarketOpen,regularMarketDayHigh,regularMarketDayLow,regularMarketVolume,previousClose,regularMarketChangePercent`;
  try {
    const { body, status } = await fetchUrl(url);
    if (status !== 200) return [];
    const data = JSON.parse(body);
    return data?.quoteResponse?.result || [];
  } catch { return []; }
}

async function fetchRSI(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}.NS?interval=1d&range=1mo`;
  try {
    const { body, status } = await fetchUrl(url);
    if (status !== 200) return null;
    const data = JSON.parse(body);
    const closes = data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close?.filter(Boolean) || [];
    return calculateRSI(closes);
  } catch { return null; }
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") { res.status(200).end(); return; }

  const symbolsParam = req.query.symbols;
  if (!symbolsParam) {
    return res.status(400).json({ success: false, error: "symbols param required" });
  }

  const symbols = symbolsParam.split(",").map(s => s.trim()).filter(Boolean);

  try {
    // Step 1: Fetch all quotes in chunks of 20
    const allQuotes = {};
    const chunkSize = 20;
    for (let i = 0; i < symbols.length; i += chunkSize) {
      const chunk = symbols.slice(i, i + chunkSize);
      const quotes = await fetchQuoteChunk(chunk);
      quotes.forEach(q => {
        const sym = q.symbol.replace(".NS", "");
        const h = q.regularMarketDayHigh;
        const l = q.regularMarketDayLow;
        const c = q.regularMarketPrice;
        if (c) {
          allQuotes[sym] = {
            ltp:       c,
            changePct: q.regularMarketChangePercent?.toFixed(2),
            open:      q.regularMarketOpen,
            high:      h,
            low:       l,
            prevClose: q.previousClose,
            volume:    q.regularMarketVolume,
            vwap:      h && l && c ? +((h + l + c) / 3).toFixed(2) : null,
            rsi:       null,
          };
        }
      });
    }

    // Step 2: Fetch RSI only for found stocks, in parallel batches
    const foundSymbols = Object.keys(allQuotes);
    const rsiBatch = 10;
    for (let i = 0; i < foundSymbols.length; i += rsiBatch) {
      const chunk = foundSymbols.slice(i, i + rsiBatch);
      const rsiResults = await Promise.all(chunk.map(sym => fetchRSI(sym)));
      chunk.forEach((sym, idx) => {
        if (allQuotes[sym]) allQuotes[sym].rsi = rsiResults[idx];
      });
    }

    return res.status(200).json({
      success: true,
      data: allQuotes,
      found: foundSymbols.length,
      total: symbols.length,
      timestamp: new Date().toISOString(),
    });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

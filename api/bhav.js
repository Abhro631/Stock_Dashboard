const https = require("https");

function getNseUrl() {
  const now = new Date();
  now.setDate(now.getDate() - 1);
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = now.getFullYear();
  return `https://archives.nseindia.com/products/content/sec_bhavdata_full_${dd}${mm}${yyyy}.csv`;
}

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "identity",
        "Connection": "keep-alive",
        "Referer": "https://www.nseindia.com/market-data/securities-available-for-trading",
      },
    };

    const req = https.get(url, options, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve({ data: Buffer.concat(chunks).toString("utf-8"), status: res.statusCode }));
    });

    req.on("error", reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error("Timed out")); });
  });
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") { res.status(200).end(); return; }

  const nseUrl = getNseUrl();

  try {
    const { data: csv, status } = await fetchUrl(nseUrl);

    if (status === 403) return res.status(200).json({ success: false, error: "NSE blocked request (403). Upload CSV manually.", url: nseUrl });
    if (status === 404) return res.status(200).json({ success: false, error: "File not found on NSE (404). May not be published yet.", url: nseUrl });
    if (status !== 200) return res.status(200).json({ success: false, error: `NSE returned status ${status}`, url: nseUrl });
    if (!csv.includes("SYMBOL")) return res.status(200).json({ success: false, error: "Invalid CSV from NSE.", url: nseUrl, preview: csv.substring(0, 300) });

    res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate");
    return res.status(200).json({ success: true, url: nseUrl, csv });

  } catch (err) {
    return res.status(200).json({ success: false, error: err.message, url: nseUrl });
  }
};

# EarningsEdge Pro — 3-Day Rolling Earnings Trading Analyzer

A comprehensive, browser-based earnings trading analysis platform that identifies optimal options plays around corporate earnings announcements. Runs entirely client-side and deploys to GitHub Pages for live, always-accessible use. Market data is provided by Public.com API; news and historical price data come from Yahoo Finance via a lightweight local proxy.

## Live Demo

Visit the deployed site: **[your-username.github.io/your-repo](https://your-username.github.io/your-repo)**

The platform works in **demo mode** without any API keys, displaying the full UI with simulated data. Connect your Public.com API token for live market data.

## Features

### Core Analysis Pipeline (14 Functions)

| # | Function | Description |
|---|----------|-------------|
| 1 | Earnings Calendar | Scrapes WhisperNumber.com or uses built-in data; validates optionability |
| 2 | Implied Earnings Move | ATM straddle method (85%) + 1-std-dev comparison |
| 3 | IV Richness | Historical IV percentile & rank with classification thresholds |
| 4 | IV Crush Forecast | SpiderRock methodology for post-earnings vol collapse |
| 5 | Straddle Backtest | 8-quarter portfolio analysis with Sharpe ratio and confidence bands |
| 6 | Historical Moves | Analyzes past 8 quarters of earnings-day price reactions |
| 7 | Term Structure | Forward variance subtraction to isolate event volatility |
| 8 | Greeks Analysis | Full Greeks with gamma scalping potential |
| 9 | Price Targets | 5-model weighted ensemble (straddle, stddev, historical, whisper, news) |
| 10 | Liquidity Screen | Bid-ask spread, OI, volume validation with pass/warn/reject |
| 11 | News Timeline | 7-day headline analysis with sentiment scoring |
| 12 | News Pricing-In | Determines if news is already reflected in current price |
| 13 | Peer Contagion | Cross-correlation analysis for sector-wide earnings impact |
| 14 | Vol Adjustment | News-driven volatility adjustment factor |

### Tier-Based Analysis

| Tier | Criteria | Analysis Depth |
|------|----------|----------------|
| 1 | Mega cap (>$200B) | Full pipeline (all 14 functions) |
| 2 | Large cap (>$10B) + Whisper | Standard (10 functions + news) |
| 3 | Mid cap + Whisper | Basic (5 functions + news summary) |
| 4 | All others | Excluded (insufficient liquidity) |

### 3D Network Visualization

Interactive Three.js force-directed graph showing:
- **Nodes**: Companies sized by option OI, colored by zone classification
- **Edges**: Earnings contagion, supply chain, competitive, and news-flow relationships
- **Zones**: Red (negative expectation), Green (positive), Yellow (high IV), Blue (news-driven), Purple (inter-market)
- **Controls**: Orbit camera, time slider, PNG export, hover tooltips

### Trade Card Output

Each analyzed stock generates a detailed card containing:
- Catalyst info with whisper vs. estimate comparison
- Implied move from multiple models
- IV richness classification with term structure
- IV crush forecast and normalization timeline
- Multi-model price targets with confidence intervals
- Primary and secondary trade recommendations
- Full Greeks with gamma scalping metrics
- Position management rules (take-profit, stop-loss, max hold)
- Liquidity assessment with recommended max position

## Setup

### Quick Start (Demo Mode)

1. Clone this repository
2. Open `index.html` in a browser, or deploy to GitHub Pages
3. The platform loads with simulated demo data immediately

### Live Data Setup

#### 1. Public.com API (quotes, options expirations, options chains)

> **Important:** Public.com uses a **two-step authentication flow**. You cannot use your Secret Key directly as a Bearer token — you must first exchange it for an Access Token.

**Step 1 — Generate a Secret Key**

Go to [public.com/settings/security/api](https://public.com/settings/security/api) and generate a **Secret Key**. Copy and save it somewhere safe.

**Step 2 — Exchange the Secret Key for an Access Token**

This POST request returns a short-lived Access Token. The `secret` field must contain the Secret Key from Step 1 (not your password or any other credential).

macOS / Linux:
```bash
curl -X POST https://api.public.com/userapiauthservice/personal/access-tokens \
  -H "Content-Type: application/json" \
  -d '{"secret": "YOUR_SECRET_KEY", "validityInMinutes": 60}'
```

Windows (cmd.exe):
```cmd
curl -X POST https://api.public.com/userapiauthservice/personal/access-tokens -H "Content-Type: application/json" -d "{\"secret\": \"YOUR_SECRET_KEY\", \"validityInMinutes\": 60}"
```

Windows (PowerShell):
```powershell
$body = @{ secret = "YOUR_SECRET_KEY"; validityInMinutes = 60 } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "https://api.public.com/userapiauthservice/personal/access-tokens" `
  -ContentType "application/json" -Body $body
```

The response will contain an `accessToken` field — copy that value for the next step.

**Step 3 — Retrieve your Account ID**

Use the **Access Token** from Step 2 (not your Secret Key) as the Bearer token:

macOS / Linux:
```bash
curl https://api.public.com/userapigateway/trading/account \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

Windows (cmd.exe):
```cmd
curl https://api.public.com/userapigateway/trading/account -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

Windows (PowerShell):
```powershell
Invoke-RestMethod -Uri "https://api.public.com/userapigateway/trading/account" `
  -Headers @{ Authorization = "Bearer YOUR_ACCESS_TOKEN" }
```

**Step 4 — Configure the platform**

1. Open the platform, click the **Settings** gear icon
2. Paste your Access Token and Account ID
3. Click **Save & Reload**

> **Note:** Access tokens expire after the configured validity period (default 60 minutes). You will need to repeat Step 2 to generate a new token when it expires.

#### Troubleshooting Public.com API

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| `401 Unauthorized` or `403 Forbidden` | Using the Secret Key directly as a Bearer token instead of exchanging it for an Access Token first | Complete Step 2 above to get an Access Token, then use that token in Step 3 |
| `401 Unauthorized` (was working before) | Access Token expired | Repeat Step 2 to generate a fresh token |
| `curl: (60) SSL certificate problem` | Windows curl using outdated CA bundle | Add `--ssl-no-revoke` flag, or use PowerShell `Invoke-RestMethod` instead |
| Empty or malformed response | Quoting issue on Windows cmd.exe | Make sure to escape inner double-quotes with `\"` in cmd.exe, or switch to PowerShell |
| `Could not resolve host` | DNS or network issue | Verify internet connectivity; try `ping api.public.com` |

#### 2. Yahoo Finance Proxy (news + historical prices)

Public.com does not provide historical OHLC data or news. A lightweight Python proxy using `yfinance` fills this gap.

```bash
cd proxy
pip install -r requirements.txt
python server.py
# Serves on http://localhost:8901
```

The proxy provides two endpoints:
- `GET /api/news/{ticker}?count=50` — recent headlines
- `GET /api/history/{ticker}?start=YYYY-MM-DD&end=YYYY-MM-DD&interval=1d` — historical OHLC bars

The proxy URL defaults to `http://localhost:8901` and is configurable in Settings.

### GitHub Pages Deployment

1. Push this repository to GitHub
2. Go to **Settings > Pages**
3. Set source to `main` branch, root directory
4. Your site will be live at `https://<username>.github.io/<repo>/`

> When deployed to GitHub Pages, the Yahoo Finance proxy must be running locally or on a reachable server for news and historical data features to work.

## Architecture

```
index.html              Main entry point
proxy/
  server.py             Yahoo Finance proxy (FastAPI + yfinance)
  requirements.txt      Python dependencies
css/
  main.css              Core layout and theming
  trade-cards.css       Trade card component styles
  network.css           3D network visualization styles
  charts.css            Chart component styles
js/
  utils/
    config.js           Configuration manager (localStorage)
    dates.js            Trading calendar utilities
    math.js             Financial math (stats, correlations, IV calc)
    logger.js           Pipeline logging to UI and console
  api/
    public.js           Public.com REST API client with rate limiting
    earnings-calendar.js  WhisperNumber scraper + built-in fallback
    news.js             Yahoo Finance news via local proxy
  analysis/
    implied-move.js     Function 2: ATM straddle implied move
    iv-richness.js      Function 3: IV percentile and classification
    iv-crush.js         Function 4: Post-earnings IV crush forecast
    historical-moves.js Function 6: Historical earnings reactions
    term-structure.js   Function 7: Vol term structure analysis
    greeks.js           Function 8: Greeks with derived metrics
    price-targets.js    Function 9: Multi-model price targets
    liquidity.js        Function 10: Liquidity screening
    news-analysis.js    Functions 11-14: News integration protocol
    backtest.js         Function 5: Straddle portfolio backtest
    pipeline.js         Orchestrator: tier-based analysis pipeline
  ui/
    dashboard.js        Dashboard view rendering
    trade-cards-ui.js   Trade card component rendering
    settings.js         Settings panel management
    charts.js           Chart.js visualizations
  network/
    network-graph.js    Three.js 3D force-directed network
  app.js                Application entry point and orchestration
```

## API Rate Limits & Constraints

- **Public.com**: 10 requests/second; single production environment (no sandbox)
- **Yahoo Finance (via yfinance)**: No hard rate limit; proxy caches news for 5 min and history for 1 hour per ticker
- **Rate limiting**: Automatic exponential backoff (1s/2s/4s) with 3 retries on 429 or network errors
- **Batch optimization**: Quotes fetched in batches of 20 symbols
- **Token expiry**: Public.com access tokens expire after the configured validity period (default 60 min)

## Customization

All thresholds are configurable in `js/utils/config.js`:
- IV classification percentiles (10/30/70/90)
- Liquidity limits (spread %, min OI, min volume)
- Model weights for price target ensemble
- Tier cutoffs (mega/large/mid cap thresholds)

## Browser Compatibility

- Chrome 90+, Firefox 88+, Safari 15+, Edge 90+
- WebGL required for 3D network visualization
- Requires a running Yahoo Finance proxy for full functionality (news + historical data)

## Disclaimer

This tool is for educational and research purposes only. Options trading involves significant risk. Past performance does not guarantee future results. Always conduct your own due diligence before making trading decisions.

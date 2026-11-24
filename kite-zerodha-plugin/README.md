# kite-zerodha (Claude Code plugin)

Gives Claude access to Zerodha's [Kite Connect](https://kite.trade) API through an MCP server.

## Setup
1. Create an app at https://developers.kite.trade to get an API key/secret (set the redirect URL to anything you control).
2. `cd server && npm install`
3. Export env vars before launching Claude Code:
   ```
   export KITE_API_KEY=...
   export KITE_API_SECRET=...
   # optional: reuse a token from an earlier login (expires daily ~6am IST)
   export KITE_ACCESS_TOKEN=...
   # optional, off by default: allow order placement/cancellation
   export KITE_ALLOW_TRADING=true
   ```
4. Run Claude Code with the plugin: `claude --plugin-dir ./kite-zerodha-plugin`

## Tools
`kite_login_url`, `kite_generate_session`, `kite_profile`, `kite_margins`, `kite_holdings`, `kite_positions`, `kite_orders`, `kite_quote`, `kite_ltp`, `kite_historical`, `kite_place_order`*, `kite_cancel_order`*  (*require `KITE_ALLOW_TRADING=true`)

## Safety
Trading is disabled by default and the skill requires explicit confirmation of every order. Never commit your API secret or access token. Not financial advice.

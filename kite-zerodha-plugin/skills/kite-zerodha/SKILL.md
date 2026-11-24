---
name: kite-zerodha
description: Use when the user asks about their Zerodha account, portfolio, holdings, positions, margins, stock quotes, or wants to place/cancel an order via Kite.
---

# Zerodha Kite

Use the `kite` MCP tools.

1. If a call fails with "Not logged in", call `kite_login_url`, ask the user to log in and paste the `request_token` from the redirect URL, then call `kite_generate_session`. Tokens expire daily (~6am IST).
2. For analysis use `kite_holdings`, `kite_positions`, `kite_margins`, `kite_ltp`, `kite_quote`, `kite_historical`. Summarise P&L and allocation clearly; amounts are in INR.
3. Orders: never call `kite_place_order` or `kite_cancel_order` without explicit user confirmation of symbol, side, quantity, order type, product and price in that same conversation. They fail unless `KITE_ALLOW_TRADING=true`.
4. This is not financial advice; don't present predictions as certain.

import crypto from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE = "https://api.kite.trade";
const API_KEY = process.env.KITE_API_KEY || "";
const API_SECRET = process.env.KITE_API_SECRET || "";
const TRADING = process.env.KITE_ALLOW_TRADING === "true";
// Mutable: generate_session can set it for the current process.
let accessToken = process.env.KITE_ACCESS_TOKEN || "";

async function kite(method, path, { query, form } = {}) {
  if (!API_KEY) throw new Error("KITE_API_KEY is not set");
  if (!accessToken && !path.startsWith("/session/token"))
    throw new Error("Not logged in. Run kite_login_url, log in, then kite_generate_session with the request_token.");
  const url = new URL(BASE + path);
  if (query) for (const [k, v] of Object.entries(query)) {
    if (Array.isArray(v)) v.forEach((x) => url.searchParams.append(k, x));
    else if (v !== undefined) url.searchParams.set(k, v);
  }
  const res = await fetch(url, {
    method,
    headers: {
      "X-Kite-Version": "3",
      ...(accessToken ? { Authorization: `token ${API_KEY}:${accessToken}` } : {}),
      ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: form ? new URLSearchParams(form).toString() : undefined,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.status === "error")
    throw new Error(`Kite API ${res.status}: ${body.error_type || ""} ${body.message || res.statusText}`);
  return body.data;
}

const ok = (data) => ({ content: [{ type: "text", text: JSON.stringify(data, null, 2) }] });
const wrap = (fn) => async (args) => {
  try { return ok(await fn(args)); }
  catch (e) { return { isError: true, content: [{ type: "text", text: String(e.message || e) }] }; }
};

const server = new McpServer({ name: "kite", version: "0.1.0" });
const instruments = z.array(z.string()).min(1).describe('e.g. ["NSE:INFY","NSE:RELIANCE"]');

server.tool("kite_login_url", "Get the Kite login URL. After logging in, the redirect URL contains request_token.", {},
  wrap(async () => {
    if (!API_KEY) throw new Error("KITE_API_KEY is not set");
    return { login_url: `https://kite.zerodha.com/connect/login?v=3&api_key=${API_KEY}` };
  }));

server.tool("kite_generate_session", "Exchange request_token for an access_token (valid until ~6am IST next day). Requires KITE_API_SECRET.",
  { request_token: z.string() },
  wrap(async ({ request_token }) => {
    if (!API_SECRET) throw new Error("KITE_API_SECRET is not set");
    const checksum = crypto.createHash("sha256").update(API_KEY + request_token + API_SECRET).digest("hex");
    const d = await kite("POST", "/session/token", { form: { api_key: API_KEY, request_token, checksum } });
    accessToken = d.access_token;
    return { user_id: d.user_id, user_name: d.user_name, note: "Session active for this process. Set KITE_ACCESS_TOKEN to reuse it." };
  }));

server.tool("kite_profile", "User profile.", {}, wrap(() => kite("GET", "/user/profile")));
server.tool("kite_margins", "Account margins / available funds.", {}, wrap(() => kite("GET", "/user/margins")));
server.tool("kite_holdings", "Long-term equity holdings.", {}, wrap(() => kite("GET", "/portfolio/holdings")));
server.tool("kite_positions", "Open day/net positions.", {}, wrap(() => kite("GET", "/portfolio/positions")));
server.tool("kite_orders", "All orders for the day.", {}, wrap(() => kite("GET", "/orders")));
server.tool("kite_quote", "Full market quotes.", { instruments }, wrap(({ instruments }) => kite("GET", "/quote", { query: { i: instruments } })));
server.tool("kite_ltp", "Last traded price.", { instruments }, wrap(({ instruments }) => kite("GET", "/quote/ltp", { query: { i: instruments } })));

server.tool("kite_historical", "Historical candles (needs the Kite historical-data add-on).",
  {
    instrument_token: z.string(),
    interval: z.enum(["minute", "3minute", "5minute", "10minute", "15minute", "30minute", "60minute", "day"]),
    from: z.string().describe("yyyy-mm-dd hh:mm:ss"),
    to: z.string().describe("yyyy-mm-dd hh:mm:ss"),
  },
  wrap(({ instrument_token, interval, from, to }) =>
    kite("GET", `/instruments/historical/${instrument_token}/${interval}`, { query: { from, to } })));

server.tool("kite_place_order",
  "Place an order. DISABLED unless KITE_ALLOW_TRADING=true. Always confirm details with the user first.",
  {
    exchange: z.enum(["NSE", "BSE", "NFO", "BFO", "MCX", "CDS"]),
    tradingsymbol: z.string(),
    transaction_type: z.enum(["BUY", "SELL"]),
    quantity: z.number().int().positive(),
    order_type: z.enum(["MARKET", "LIMIT", "SL", "SL-M"]),
    product: z.enum(["CNC", "MIS", "NRML"]),
    price: z.number().optional(),
    trigger_price: z.number().optional(),
    variety: z.enum(["regular", "amo", "co", "iceberg"]).default("regular"),
  },
  wrap(async ({ variety, ...o }) => {
    if (!TRADING) throw new Error("Trading is disabled. Set KITE_ALLOW_TRADING=true to enable order placement.");
    const form = Object.fromEntries(Object.entries(o).map(([k, v]) => [k, String(v)]));
    form.validity = "DAY";
    return kite("POST", `/orders/${variety}`, { form });
  }));

server.tool("kite_cancel_order", "Cancel an order. DISABLED unless KITE_ALLOW_TRADING=true.",
  { order_id: z.string(), variety: z.enum(["regular", "amo", "co", "iceberg"]).default("regular") },
  wrap(async ({ order_id, variety }) => {
    if (!TRADING) throw new Error("Trading is disabled. Set KITE_ALLOW_TRADING=true to enable.");
    return kite("DELETE", `/orders/${variety}/${order_id}`);
  }));

await server.connect(new StdioServerTransport());

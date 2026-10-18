// Publishes Guardian's config to the ElevenLabs voice agent. Idempotent: safe
// to re-run after changing tool definitions or prompts/elevenlabs-agent.md.
//
//   pnpm elevenlabs:publish            # apply
//   pnpm elevenlabs:publish --dry-run  # print what would change, write nothing
//
// Steps:
//  1. Store ELEVENLABS_WEBHOOK_SECRET as an ElevenLabs workspace secret
//  2. Create/update the get_usual_items, check_scam, search_products server tools
//  3. Create the post-call webhook → /api/elevenlabs/call-ended. Its signing
//     secret goes to Vercel + .env.local.
//  4. Add the tools to the agent (keeping its other tools), set its prompt, and
//     attach the webhook as a Guardian-only override (not the workspace default)
//  5. Make sure ELEVENLABS_FALLBACK_MEMBER_ID (demo senior) is set in Vercel
//  6. Redeploy production if any Vercel env var changed
//
// Needs in .env.local: ELEVENLABS_API_KEY, ELEVENLABS_AGENT_ID,
// ELEVENLABS_WEBHOOK_SECRET, DATABASE_URL. Needs the Vercel CLI linked (.vercel/).

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const DRY = process.argv.includes("--dry-run");
const API = "https://api.elevenlabs.io";
const BASE_URL = (process.env.PUBLIC_BASE_URL || "https://guardian-three-tau.vercel.app").replace(/\/$/, "");
const ENV_FILE = path.resolve(".env.local");
const PROMPT_FILE = path.resolve("prompts/elevenlabs-agent.md");

const SECRET_NAME = "guardian_webhook_secret";
const WEBHOOK_NAME = "guardian-call-ended";
// Seeded by scripts/seed.ts; used as the fallback senior for dashboard test calls.
const DEMO_MEMBER_PHONE = "+15551234567";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing ${name} in .env.local`);
    process.exit(1);
  }
  return v;
}

const API_KEY = requireEnv("ELEVENLABS_API_KEY");
const AGENT_ID = requireEnv("ELEVENLABS_AGENT_ID");
const WEBHOOK_SECRET = requireEnv("ELEVENLABS_WEBHOOK_SECRET");

class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
    label: string,
  ) {
    super(`${label} → ${status}: ${body}`);
  }
}

async function call<T>(method: string, p: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${p}`, {
    method,
    headers: { "xi-api-key": API_KEY, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new ApiError(res.status, text, `${method} ${p}`);
  return (text ? JSON.parse(text) : {}) as T;
}

// Reads are always real; writes are skipped (and logged) in --dry-run.
async function write<T>(label: string, method: string, p: string, body?: unknown): Promise<T | undefined> {
  if (DRY) {
    console.log(`[dry-run] ${label}: ${method} ${p}`);
    return undefined;
  }
  const out = await call<T>(method, p, body);
  console.log(`✓ ${label}`);
  return out;
}

// ---------- 1. workspace secret ----------

async function upsertSecret(): Promise<string | undefined> {
  const { secrets } = await call<{ secrets: { secret_id: string; name: string }[] }>("GET", "/v1/convai/secrets");
  const existing = secrets.find((s) => s.name === SECRET_NAME);
  if (existing) {
    await write("update workspace secret", "PATCH", `/v1/convai/secrets/${existing.secret_id}`, {
      type: "update",
      name: SECRET_NAME,
      value: WEBHOOK_SECRET,
    });
    return existing.secret_id;
  }
  const created = await write<{ secret_id: string }>("create workspace secret", "POST", "/v1/convai/secrets", {
    type: "new",
    name: SECRET_NAME,
    value: WEBHOOK_SECRET,
  });
  return created?.secret_id;
}

// ---------- 2. server tools ----------

// The LLM never sees memberId; tools identify the senior by caller phone
// (system__caller_id), and the server falls back to the demo senior.
const callerPhone = { type: "string", dynamic_variable: "system__caller_id" };

const TOOLS = [
  {
    name: "get_usual_items",
    description: "Get the caller's usual grocery order (their regular items and quantities). Use when they say 'the usual' or 'my regular order'.",
    path: "/api/creao/tools/get_usual_items",
    properties: { callerPhone },
    required: [] as string[],
  },
  {
    name: "check_scam",
    description:
      "Check whether something the caller describes looks like a scam (gift card or wire requests, fake IRS/Medicare/bank/grandchild calls, pressure to pay or keep secrets). Returns flagged=true with reasons if risky.",
    path: "/api/creao/tools/check_scam",
    properties: {
      callerPhone,
      message: { type: "string", description: "What the caller said happened or was asked of them, in their own words." },
      channel: { type: "string", constant_value: "voice" },
    },
    required: ["message"],
  },
  {
    name: "search_products",
    description: "Search Guardian's product catalog for an item the caller asked for. Use one or two simple words, e.g. 'milk' or 'pasta sauce'.",
    path: "/api/creao/tools/search_products",
    properties: {
      query: { type: "string", description: "Simple product search words, e.g. 'bananas'." },
      limit: { type: "integer", description: "How many results to return, 1-5. Use 3 unless asked for more." },
    },
    required: ["query"],
  },
];

function toolConfig(t: (typeof TOOLS)[number], secretHeader: unknown) {
  return {
    type: "webhook",
    name: t.name,
    description: t.description,
    response_timeout_secs: 20,
    api_schema: {
      url: `${BASE_URL}${t.path}`,
      method: "POST",
      request_headers: { "x-elevenlabs-secret": secretHeader },
      request_body_schema: {
        type: "object",
        description: `Arguments for ${t.name}.`,
        properties: t.properties,
        required: t.required,
      },
    },
  };
}

async function listTools(): Promise<{ id: string; tool_config: { name?: string } }[]> {
  const all: { id: string; tool_config: { name?: string } }[] = [];
  let cursor: string | null = null;
  do {
    const q: string = `?page_size=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
    const page = await call<{ tools: typeof all; has_more: boolean; next_cursor: string | null }>("GET", `/v1/convai/tools${q}`);
    all.push(...page.tools);
    cursor = page.has_more ? page.next_cursor : null;
  } while (cursor);
  return all;
}

async function upsertTools(secretId: string | undefined): Promise<string[]> {
  const existing = new Map((await listTools()).map((t) => [t.tool_config.name, t.id]));
  const ids: string[] = [];
  // Prefer a secret-store reference so the value isn't visible in the dashboard.
  // If ElevenLabs rejects that header shape, fall back to the plain value.
  let useSecretRef = Boolean(secretId);

  for (const t of TOOLS) {
    const id = existing.get(t.name);
    const send = (header: unknown) =>
      id
        ? write("update tool " + t.name, "PATCH", `/v1/convai/tools/${id}`, { tool_config: toolConfig(t, header) })
        : write<{ id: string }>("create tool " + t.name, "POST", "/v1/convai/tools", { tool_config: toolConfig(t, header) });

    let out: { id?: string } | undefined;
    try {
      out = (await send(useSecretRef ? { secret_id: secretId } : WEBHOOK_SECRET)) as { id?: string } | undefined;
    } catch (err) {
      if (!(useSecretRef && err instanceof ApiError && err.status === 422)) throw err;
      console.warn(`! secret reference header rejected (${err.body}); using plain header value instead`);
      useSecretRef = false;
      out = (await send(WEBHOOK_SECRET)) as { id?: string } | undefined;
    }
    const toolId = id ?? out?.id;
    if (toolId) ids.push(toolId);
  }
  return ids;
}

// ---------- 3. agent ----------

type AgentResponse = {
  name?: string;
  conversation_config: { agent: { prompt: { prompt?: string; tool_ids?: string[]; tools?: unknown } & Record<string, unknown> } };
  platform_settings?: { workspace_overrides?: { webhooks?: { post_call_webhook_id?: string | null } & Record<string, unknown> } & Record<string, unknown> };
};

// The post-call webhook is set as a per-agent override, never the workspace
// default, so other agents in the workspace keep their own webhooks.
async function updateAgent(toolIds: string[], webhookId: string | undefined) {
  const agent = await call<AgentResponse>("GET", `/v1/convai/agents/${AGENT_ID}`);
  const current = agent.conversation_config.agent.prompt;
  const promptText = fs.readFileSync(PROMPT_FILE, "utf8").trim();
  const mergedIds = [...new Set([...(current.tool_ids ?? []), ...toolIds])];

  console.log(`agent "${agent.name ?? AGENT_ID}": ${current.tool_ids?.length ?? 0} tools now, ${mergedIds.length} after`);
  if ((current.prompt ?? "").trim() !== promptText) console.log("agent prompt will be replaced from prompts/elevenlabs-agent.md");

  // Send the whole prompt object back so a non-merging PATCH can't drop the
  // agent's LLM/temperature settings. `tools` is the legacy inline list and
  // conflicts with tool_ids, so leave it out.
  const { tools: _legacy, ...rest } = current;
  const overrides = agent.platform_settings?.workspace_overrides ?? {};
  await write("update agent prompt + tools + post-call webhook", "PATCH", `/v1/convai/agents/${AGENT_ID}`, {
    conversation_config: { agent: { prompt: { ...rest, prompt: promptText, tool_ids: mergedIds } } },
    platform_settings: {
      workspace_overrides: {
        ...overrides,
        webhooks: { ...overrides.webhooks, post_call_webhook_id: webhookId ?? "<new webhook>", events: ["transcript"] },
      },
    },
  });
  if (DRY) return;

  // The override field isn't fully documented, so read it back to confirm.
  const after = await call<AgentResponse>("GET", `/v1/convai/agents/${AGENT_ID}`);
  const got = after.platform_settings?.workspace_overrides?.webhooks?.post_call_webhook_id;
  if (got !== webhookId) throw new Error(`agent post-call webhook override not applied (got ${got ?? "nothing"}, wanted ${webhookId})`);
  if (after.conversation_config.agent.prompt.prompt?.trim() !== promptText) throw new Error("agent prompt not applied");
  console.log("✓ verified agent prompt + webhook override");
}

// ---------- 4. post-call webhook ----------

async function upsertPostCallWebhook(): Promise<{ webhookId?: string; newSigningSecret?: string }> {
  const url = `${BASE_URL}/api/elevenlabs/call-ended`;
  const { webhooks } = await call<{ webhooks: { webhook_id: string; name: string; webhook_url: string }[] }>("GET", "/v1/workspace/webhooks");
  const existing = webhooks.find((w) => w.name === WEBHOOK_NAME);

  let webhookId = existing?.webhook_id;
  let newSigningSecret: string | undefined;

  // ElevenLabs only reveals the signing secret at creation, so reuse an
  // existing webhook only if we still have its secret locally.
  const reusable = existing && existing.webhook_url === url && process.env.ELEVENLABS_POSTCALL_SIGNING_SECRET;
  if (!reusable) {
    if (existing) await write("delete stale post-call webhook", "DELETE", `/v1/workspace/webhooks/${existing.webhook_id}`);
    const created = await write<{ webhook_id: string; webhook_secret?: string | null }>("create post-call webhook", "POST", "/v1/workspace/webhooks", {
      settings: { auth_type: "hmac", name: WEBHOOK_NAME, webhook_url: url },
    });
    webhookId = created?.webhook_id;
    newSigningSecret = created?.webhook_secret ?? undefined;
    if (created && !newSigningSecret) {
      console.warn("! ElevenLabs returned no webhook_secret; copy it from the dashboard into ELEVENLABS_POSTCALL_SIGNING_SECRET");
    }
  }

  return { webhookId, newSigningSecret };
}

// ---------- 5/6. env vars: .env.local + Vercel ----------

function setLocalEnv(name: string, value: string) {
  const lines = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, "utf8").split(/\r?\n/) : [];
  const i = lines.findIndex((l) => l.startsWith(`${name}=`));
  if (i >= 0) lines[i] = `${name}=${value}`;
  else lines.splice(lines.at(-1) === "" ? lines.length - 1 : lines.length, 0, `${name}=${value}`);
  fs.writeFileSync(ENV_FILE, lines.join("\n"));
}

function vercel(args: string[], input?: string) {
  // shell: true so Windows resolves vercel.cmd. Values only ever go via stdin.
  return spawnSync("vercel", args, { input, encoding: "utf8", shell: true });
}

function setVercelEnv(name: string, value: string): boolean {
  if (DRY) {
    console.log(`[dry-run] set ${name} in Vercel production + .env.local`);
    return false;
  }
  vercel(["env", "rm", name, "production", "--yes"]);
  const r = vercel(["env", "add", name, "production"], value);
  if (r.status !== 0) throw new Error(`vercel env add ${name} failed: ${r.stderr || r.stdout}`);
  setLocalEnv(name, value);
  console.log(`✓ set ${name} in Vercel production + .env.local`);
  return true;
}

async function ensureFallbackMember(): Promise<boolean> {
  if (process.env.ELEVENLABS_FALLBACK_MEMBER_ID) return false;
  const { db, schema } = await import("@/lib/db");
  const { eq } = await import("drizzle-orm");
  const [m] = await db.select({ id: schema.member.id }).from(schema.member).where(eq(schema.member.phoneE164, DEMO_MEMBER_PHONE)).limit(1);
  if (!m) {
    console.warn(`! no member with phone ${DEMO_MEMBER_PHONE}; run pnpm seed, or set ELEVENLABS_FALLBACK_MEMBER_ID yourself`);
    return false;
  }
  return setVercelEnv("ELEVENLABS_FALLBACK_MEMBER_ID", m.id);
}

function redeploy() {
  const dirty = spawnSync("git", ["status", "--porcelain", "--untracked-files=no"], { encoding: "utf8" }).stdout.trim();
  if (dirty) {
    console.warn("! working tree has uncommitted changes; not deploying. Commit, then run: vercel --prod --yes");
    return;
  }
  console.log("redeploying production so the new env vars take effect...");
  const r = spawnSync("vercel", ["--prod", "--yes"], { stdio: "inherit", shell: true });
  if (r.status !== 0) throw new Error("vercel --prod failed");
}

async function main() {
  console.log(`${DRY ? "[dry-run] " : ""}publishing to agent ${AGENT_ID}, tools at ${BASE_URL}`);

  const secretId = await upsertSecret();
  const toolIds = await upsertTools(secretId);
  const { webhookId, newSigningSecret: signingSecret } = await upsertPostCallWebhook();

  // Save the signing secret before anything else can fail: ElevenLabs never shows it again.
  let envChanged = false;
  if (signingSecret) envChanged = setVercelEnv("ELEVENLABS_POSTCALL_SIGNING_SECRET", signingSecret) || envChanged;

  await updateAgent(toolIds, webhookId);
  envChanged = (await ensureFallbackMember()) || envChanged;
  if (envChanged) redeploy();

  console.log(DRY ? "dry run done, nothing written" : "done");
  process.exit(0);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

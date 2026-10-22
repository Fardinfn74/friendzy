// In-memory stand-in for the Supabase admin client, just big enough for the Friendzy engines.
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

type Row = Record<string, any>;
const LATENCY_MS = Number(process.env.MOCK_LATENCY_MS ?? 0);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const __stats = { calls: 0, writes: 0, broadcasts: [] as string[] };
const tables: Record<string, Row[]> = {
  profiles: [], games: [], game_players: [], hints: [], votes: [], word_bank: [],
  player_accounts: [], owned_items: [],
};

// Seed word_bank from the real SQL so the simulation uses the real words.
const sql = readFileSync(new URL("../drizzle/complete_database_setup.sql", import.meta.url), "utf8");
for (const m of sql.matchAll(/\('([^']*)','([^']*)','(easy|medium|hard)'\)/g)) {
  tables.word_bank!.push({ id: randomUUID(), category: m[1], word: m[2], difficulty: m[3] });
}

const now = () => new Date().toISOString();
const defaults: Record<string, () => Row> = {
  profiles: () => ({ avatar_id: "fox", created_at: now(), last_seen_at: now() }),
  games: () => ({
    status: "lobby", game_type: "imposter", game_mode: "classic", game_settings: {},
    difficulty: "medium", imposter_count: 1, max_players: 12, category: null, secret_word: null,
    decoy_word: null, ai_theme: null, ai_word: null, ai_category: null, round_number: 0,
    current_turn_profile_id: null, turn_deadline: null, vote_deadline: null, replay_streak: 0,
    last_eliminated_id: null, last_eliminated_was_imposter: null, last_resolution_note: null,
    resolve_until: null, pending_status: null, winner: null, created_at: now(), updated_at: now(),
  }),
  game_players: () => ({
    is_host: false, is_imposter: false, is_ready: false, is_eliminated: false, left_game: false,
    card_seen: false, turn_order: null, joined_at: now(), last_seen_at: now(),
  }),
  hints: () => ({ skipped: false, created_at: now() }),
  votes: () => ({ target_id: null, is_replay_vote: false, created_at: now() }),
};
const unique: Record<string, string[][]> = {
  profiles: [["session_token"]], games: [["code"]], game_players: [["game_id", "profile_id"]],
  hints: [["game_id", "round_number", "profile_id"]], player_accounts: [["username"]],
};
const cascade: Record<string, [string, string][]> = {
  games: [["game_players", "game_id"], ["hints", "game_id"], ["votes", "game_id"]],
};

function clone<T>(v: T): T { return v === undefined ? v : JSON.parse(JSON.stringify(v)); }

class Builder implements PromiseLike<any> {
  private op: "select" | "insert" | "update" | "delete" = "select";
  private filters: [string, any][] = [];
  private cols = "*";
  private payload: any = null;
  private orderBy: { col: string; asc: boolean } | null = null;
  private mode: "many" | "single" | "maybe" = "many";
  private returning = false;
  constructor(private table: string) {}

  select(cols = "*") { if (this.op === "select") this.cols = cols; else { this.returning = true; this.cols = cols; } return this; }
  insert(p: any) { this.op = "insert"; this.payload = p; return this; }
  update(p: any) { this.op = "update"; this.payload = p; return this; }
  delete() { this.op = "delete"; return this; }
  eq(col: string, val: any) { this.filters.push([col, val]); return this; }
  order(col: string, o?: { ascending?: boolean }) { this.orderBy = { col, asc: o?.ascending !== false }; return this; }
  single() { this.mode = "single"; return this; }
  maybeSingle() { this.mode = "maybe"; return this; }
  then<A, B>(res?: (v: any) => A, rej?: (e: any) => B) { return (async () => { __stats.calls++; if (this.op !== 'select') __stats.writes++; if (LATENCY_MS) await sleep(LATENCY_MS); return this.run(); })().then(res, rej); }

  private match(r: Row) { return this.filters.every(([c, v]) => r[c] === v); }
  private project(r: Row): Row {
    let out: Row;
    const parts = this.cols.split(/,(?![^()]*\))/).map((s) => s.trim()).filter(Boolean);
    if (parts.includes("*")) out = clone(r);
    else { out = {}; for (const p of parts) if (!p.includes("(")) out[p] = clone(r[p]); }
    for (const p of parts) {
      const em = p.match(/^(\w+)\(([^)]*)\)$/);
      if (em && em[1] === "profiles") {
        const prof = tables.profiles!.find((x) => x.id === r["profile_id"]);
        out["profiles"] = prof ? Object.fromEntries(em[2]!.split(",").map((c) => [c.trim(), prof[c.trim()]])) : null;
      }
    }
    return out;
  }
  private finish(rows: Row[]) {
    if (this.mode === "many") return { data: rows, error: null };
    if (rows.length === 1) return { data: rows[0], error: null };
    if (this.mode === "maybe" && rows.length === 0) return { data: null, error: null };
    return { data: null, error: { message: "JSON object requested, multiple (or no) rows returned" } };
  }
  private run() {
    const t = tables[this.table];
    if (!t) return { data: null, error: { message: `unknown table ${this.table}` } };
    if (this.op === "select") {
      let rows = t.filter((r) => this.match(r));
      if (this.orderBy) { const { col, asc } = this.orderBy; rows = [...rows].sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0) * (asc ? 1 : -1)); }
      return this.finish(rows.map((r) => this.project(r)));
    }
    if (this.op === "insert") {
      const items: Row[] = Array.isArray(this.payload) ? this.payload : [this.payload];
      const made: Row[] = [];
      for (const item of items) {
        const row: Row = { id: randomUUID(), ...(defaults[this.table]?.() ?? {}), ...clone(item) };
        for (const cols of unique[this.table] ?? []) {
          if (t.some((x) => cols.every((c) => x[c] === row[c])))
            return { data: null, error: { message: `duplicate key value violates unique constraint "${this.table}_${cols.join("_")}_key"` } };
        }
        t.push(row); made.push(row);
      }
      return this.returning ? this.finish(made.map((r) => this.project(r))) : { data: null, error: null };
    }
    if (this.op === "update") {
      const hit = t.filter((r) => this.match(r));
      for (const r of hit) Object.assign(r, clone(this.payload));
      return this.returning ? this.finish(hit.map((r) => this.project(r))) : { data: null, error: null };
    }
    // delete
    const hit = t.filter((r) => this.match(r));
    for (const r of hit) {
      t.splice(t.indexOf(r), 1);
      for (const [ct, col] of cascade[this.table] ?? []) {
        const ctab = tables[ct]!; for (let i = ctab.length - 1; i >= 0; i--) if (ctab[i]![col] === r["id"]) ctab.splice(i, 1);
      }
    }
    return { data: null, error: null };
  }
}

export const supabaseAdmin = {
  from: (table: string) => new Builder(table),
  rpc: async (fn: string, args: any) => {
    __stats.calls++; if (LATENCY_MS) await sleep(LATENCY_MS);
    if (fn === "rpc_upsert_profile") {
      let p = tables.profiles!.find((x) => x.session_token === args.p_session_token);
      if (p) Object.assign(p, { display_name: args.p_display_name, avatar_id: args.p_avatar_id });
      else { p = { id: randomUUID(), session_token: args.p_session_token, display_name: args.p_display_name, avatar_id: args.p_avatar_id, ...defaults.profiles!() }; tables.profiles!.push(p); }
      return { data: [{ id: p.id, display_name: p.display_name, avatar_id: p.avatar_id }], error: null };
    }
    if (fn === "rpc_get_profile") {
      const p = tables.profiles!.find((x) => x.session_token === args.p_session_token);
      return { data: p ? [{ id: p.id, display_name: p.display_name, avatar_id: p.avatar_id }] : [], error: null };
    }
    return { data: null, error: { message: `rpc ${fn} not mocked` } };
  },
  channel: (topic: string) => ({ httpSend: async () => { __stats.broadcasts.push(topic); return { ok: true }; }, send: async () => 'ok' }),
  removeChannel: async () => 'ok',
  auth: { admin: {} },
};
export const __tables = tables;

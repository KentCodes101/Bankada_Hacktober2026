// Supabase Edge Function (Deno): POST /functions/v1/chat
// Plans group trips against a fund budget loaded only from Supabase.
import { createClient } from "npm:@supabase/supabase-js@2";

type ChatMessage = { role: "user" | "assistant"; content: string };
type Cost = { amountMinor: number; notes: string };
type Itinerary = {
  title: string;
  destination: string;
  durationDays: number;
  summary: string;
  transportation: Cost;
  accommodation: Cost;
  food: Cost;
  activities: Cost;
  totalMinor: number;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(payload: unknown, init: { status?: number; headers?: Record<string, string> } = {}): Response {
  return new Response(JSON.stringify(payload), {
    status: init.status ?? 200,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...init.headers },
  });
}

const outputSchema = {
  type: "object",
  additionalProperties: false,
  required: ["assistantMessage", "options"],
  properties: {
    assistantMessage: { type: "string" },
    options: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "title", "destination", "durationDays", "summary", "transportation",
          "accommodation", "food", "activities", "totalMinor",
        ],
        properties: {
          title: { type: "string" },
          destination: { type: "string" },
          durationDays: { type: "integer" },
          summary: { type: "string" },
          transportation: { $ref: "#/$defs/cost" },
          accommodation: { $ref: "#/$defs/cost" },
          food: { $ref: "#/$defs/cost" },
          activities: { $ref: "#/$defs/cost" },
          totalMinor: { type: "integer" },
        },
      },
    },
  },
  $defs: {
    cost: {
      type: "object",
      additionalProperties: false,
      required: ["amountMinor", "notes"],
      properties: {
        amountMinor: { type: "integer" },
        notes: { type: "string" },
      },
    },
  },
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isChatHistory(value: unknown): value is ChatMessage[] {
  return Array.isArray(value) && value.length > 0 && value.length <= 20 &&
    value[0]?.role === "user" && value[value.length - 1]?.role === "user" &&
    value.every((message, index) => isRecord(message) &&
      message.role === (index % 2 === 0 ? "user" : "assistant") &&
      typeof message.content === "string" &&
      message.content.trim().length > 0 && message.content.length <= 4_000);
}

function isAuthorizationError(error: { code?: string }): boolean {
  return error.code === "42501" || error.code === "PGRST301";
}

function validatePlan(value: unknown, budgetMinor: number) {
  if (!isRecord(value) || typeof value.assistantMessage !== "string" ||
      !Array.isArray(value.options) || value.options.length !== 3) return null;

  const options: Itinerary[] = [];
  for (const item of value.options) {
    if (!isRecord(item) || typeof item.title !== "string" ||
        typeof item.destination !== "string" || typeof item.summary !== "string" ||
        !Number.isInteger(item.durationDays) || Number(item.durationDays) < 1) return null;

    const amounts: number[] = [];
    for (const key of ["transportation", "accommodation", "food", "activities"] as const) {
      const cost = item[key];
      if (!isRecord(cost) || !Number.isSafeInteger(cost.amountMinor) ||
          Number(cost.amountMinor) < 0 || typeof cost.notes !== "string") return null;
      amounts.push(Number(cost.amountMinor));
    }

    // Recalculate the total on the server; never trust a model-supplied total.
    const totalMinor = amounts.reduce((sum, amount) => sum + amount, 0);
    if (!Number.isSafeInteger(totalMinor) || totalMinor >= budgetMinor) return null;
    options.push({
      title: item.title,
      destination: item.destination,
      durationDays: Number(item.durationDays),
      summary: item.summary,
      transportation: item.transportation as Cost,
      accommodation: item.accommodation as Cost,
      food: item.food as Cost,
      activities: item.activities as Cost,
      totalMinor,
    });
  }
  return { assistantMessage: value.assistantMessage, options };
}

/**
 * The request deliberately allows only messages and fundId; budget values sent
 * by a client are rejected and can never influence the system instructions.
 */
Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, { status: 405 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  try {
    if (!isRecord(body) || Object.keys(body).some((key) => !["messages", "fundId"].includes(key)) ||
        !isChatHistory(body.messages) ||
        (body.fundId !== undefined && (typeof body.fundId !== "string" || !body.fundId.trim()))) {
      return json({ error: "Request must contain alternating chat messages ending in a user prompt, and an optional fundId only." }, { status: 400 });
    }

    const fundId = typeof body.fundId === "string"
      ? body.fundId
      : Deno.env.get("TRIP_FUND_ID");
    if (!fundId) {
      return json({ error: "A fundId is required to plan this trip." }, { status: 400 });
    }

    // SUPABASE_URL and SUPABASE_ANON_KEY are injected automatically by Supabase.
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !supabaseAnonKey) {
      return json({ error: "Supabase server configuration is missing." }, { status: 503 });
    }

    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Authentication required." }, { status: 401 });
    }

    // Act as the caller: forward their JWT so Supabase RLS limits funds to
    // groups the user belongs to. No service-role client is used here.
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.slice("Bearer ".length));
    if (authError || !user) {
      return json({ error: "Authentication required." }, { status: 401 });
    }

    // RLS-hidden funds produce no row, so missing and unauthorized fund IDs
    // both stop here, before any request is sent to OpenAI.
    const { data: fund, error: fundError } = await supabase
      .from("funds")
      .select("id, group_id, goal_name, target_amount, currency")
      .eq("id", fundId)
      .maybeSingle();

    if (fundError) {
      console.error("Fund lookup failed:", fundError.message);
      return json(
        { error: isAuthorizationError(fundError) ? "You are not authorized to access this fund." : "Could not load the fund right now." },
        { status: isAuthorizationError(fundError) ? 403 : 503 },
      );
    }
    if (!fund) {
      return json({ error: "Fund not found or you are not a group member." }, { status: 404 });
    }

    // Check membership explicitly as defense in depth. The schema uses
    // group_members.profile_id to associate an auth user with a group.
    const { data: membership, error: membershipError } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("group_id", fund.group_id)
      .eq("profile_id", user.id)
      .maybeSingle();
    if (membershipError) {
      console.error("Group membership lookup failed:", membershipError.message);
      return json(
        { error: isAuthorizationError(membershipError) ? "You are not authorized to access this fund." : "Could not verify group membership right now." },
        { status: isAuthorizationError(membershipError) ? 403 : 503 },
      );
    }
    if (!membership) {
      return json({ error: "You are not a member of this fund's group." }, { status: 403 });
    }


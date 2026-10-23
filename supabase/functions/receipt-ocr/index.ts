// Receipt-only savings ingestion. The browser uploads a screenshot to the
// private group-receipts bucket, then this function verifies membership,
// submits the image to OCR.space, stores the transcription as a private .txt
// file, and appends the receipt-backed savings transaction.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") ?? "",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};
const json = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

function amountFromText(text: string) {
  const match = text.match(/(?:₱|PHP\.?|Php\.?|P)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.\d{1,2})?|[0-9]+(?:\.\d{1,2})?)/);
  if (!match) return null;
  const amount = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) : null;
}

function referenceFromText(text: string) {
  const match = text.match(/(?:reference|ref(?:erence)?\s*(?:no\.?|number)?|transaction\s*(?:id|no\.?|number)?)\s*[:#-]?\s*([A-Za-z0-9-]{6,160})/i);
  return match?.[1] ?? "";
}

async function sha256(value: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", value);
  return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const supabaseUrl = Deno.env.get("SUPABASE_URL"), anonKey = Deno.env.get("SUPABASE_ANON_KEY"), serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), ocrKey = Deno.env.get("OCR_SPACE_API_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !ocrKey) return json({ error: "Receipt OCR is not configured." }, 503);
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json({ error: "Authentication required." }, 401);
  let body: unknown; try { body = await request.json(); } catch { return json({ error: "Request body must be valid JSON." }, 400); }
  if (!isRecord(body) || typeof body.groupId !== "string" || typeof body.receiptPath !== "string" || (body.direction !== "cash_in" && body.direction !== "withdrawal") || typeof body.paymentMethod !== "string") return json({ error: "Receipt transaction details are invalid." }, 400);
  if (body.paymentMethod.trim().length < 2 || body.paymentMethod.trim().length > 100) return json({ error: "Enter the payment method used." }, 400);

  const caller = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: userError } = await caller.auth.getUser(authorization.slice(7));
  if (userError || !user?.email_confirmed_at || typeof user.user_metadata.full_name !== "string" || !user.user_metadata.full_name.trim()) return json({ error: "A verified Bankada account is required." }, 403);
  const expectedPrefix = `${body.groupId}/${user.id}/`;
  if (!body.receiptPath.startsWith(expectedPrefix) || !/\.(png|jpe?g|webp)$/i.test(body.receiptPath)) return json({ error: "Receipt image path is invalid." }, 400);

  // Verify membership as the caller. This keeps the authorization decision tied
  // to the same JWT and RLS rules that allowed the browser to upload the image.
  const { data: membership, error: membershipError } = await caller.from("group_members").select("group_id").eq("group_id", body.groupId).eq("profile_id", user.id).maybeSingle();
  if (membershipError) {
    console.error("Unable to verify receipt submitter membership", membershipError);
    return json({ error: "We could not verify your group membership. Refresh the page, sign in again, and retry." }, 500);
  }
  if (!membership) return json({ error: "Only current group members can record a receipt. Rejoin the group with today’s group code, then retry." }, 403);
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: receiptBlob, error: downloadError } = await admin.storage.from("group-receipts").download(body.receiptPath);
  if (downloadError || !receiptBlob) return json({ error: "Receipt screenshot was not found." }, 422);
  if (!/^image\/(png|jpeg|webp)$/i.test(receiptBlob.type) || receiptBlob.size === 0 || receiptBlob.size > 8 * 1024 * 1024) return json({ error: "Upload a clear PNG, JPG, or WebP screenshot under 8 MB." }, 422);

  const bytes = new Uint8Array(await receiptBlob.arrayBuffer());
  // A SHA-256 fingerprint is identical for the same receipt file, regardless
  // of who submits it. Check it before calling OCR so owners and members get
  // the same immediate, unambiguous duplicate-receipt response.
  const receiptHash = await sha256(bytes);
  const { data: existingReceipt, error: duplicateCheckError } = await admin
    .from("group_receipt_transactions")
    .select("id")
    .eq("group_id", body.groupId)
    .eq("receipt_sha256", receiptHash)
    .maybeSingle();
  if (duplicateCheckError) {
    console.error("Unable to check for a duplicate receipt", duplicateCheckError);
    return json({ error: "Could not check whether this receipt was already recorded. Please try again." }, 500);
  }
  if (existingReceipt) return json({ error: "This is the same receipt already recorded for this group. A receipt can only be submitted once." }, 409);

  const form = new FormData();
  form.set("file", new File([bytes], body.receiptPath.split("/").pop() ?? "receipt.png", { type: receiptBlob.type }));
  form.set("language", "eng"); form.set("OCREngine", "2"); form.set("isOverlayRequired", "false"); form.set("isTable", "true");
  let ocrResponse: Response; try { ocrResponse = await fetch("https://api.ocr.space/parse/image", { method: "POST", headers: { apikey: ocrKey }, body: form }); } catch { return json({ error: "Could not reach the receipt OCR service. Please try again." }, 502); }
  let ocrPayload: unknown; try { ocrPayload = await ocrResponse.json(); } catch { return json({ error: "Receipt OCR returned an invalid response." }, 502); }
  if (!ocrResponse.ok || !isRecord(ocrPayload) || ocrPayload.IsErroredOnProcessing === true || !Array.isArray(ocrPayload.ParsedResults)) return json({ error: "Receipt could not be read. Upload a clear full transaction screenshot." }, 422);
  const ocrText = ocrPayload.ParsedResults.map(result => isRecord(result) && typeof result.ParsedText === "string" ? result.ParsedText.trim() : "").filter(Boolean).join("\n\n").slice(0, 50000);
  const amountMinor = amountFromText(ocrText);
  if (!ocrText || amountMinor === null) return json({ error: "We could not identify a transaction amount. Upload a clearer, complete receipt." }, 422);

  const transactionId = crypto.randomUUID(), textPath = `${body.groupId}/${user.id}/${transactionId}.txt`;
  const { error: textUploadError } = await admin.storage.from("group-receipts").upload(textPath, new Blob([ocrText], { type: "text/plain;charset=utf-8" }), { contentType: "text/plain;charset=utf-8", upsert: false });
  if (textUploadError) return json({ error: "Could not save the receipt transcription." }, 500);
  const { data: recordedId, error: recordError } = await admin.rpc("record_group_receipt_transaction", {
    p_group_id: body.groupId, p_submitted_by: user.id, p_direction: body.direction, p_amount_minor: amountMinor, p_payment_method: body.paymentMethod.trim(), p_transaction_reference: referenceFromText(ocrText), p_occurred_at: new Date().toISOString(), p_receipt_image_path: body.receiptPath, p_receipt_text_path: textPath, p_receipt_sha256: receiptHash, p_ocr_text: ocrText,
  });
  if (recordError) {
    console.error("Unable to record receipt transaction", recordError);
    await admin.storage.from("group-receipts").remove([textPath]);
    if (recordError.code === "23505" || /duplicate/i.test(recordError.message)) return json({ error: "This is the same receipt already recorded for this group. A receipt can only be submitted once." }, 409);
    if (recordError.code === "42883" || recordError.code === "PGRST202") return json({ error: "Receipt recording has not been set up in this Supabase project. Apply the database migrations, then retry." }, 503);
    return json({ error: "Could not record this receipt. Check the Edge Function logs for the database error." }, 422);
  }
  return json({ transactionId: recordedId, amountMinor, transactionReference: referenceFromText(ocrText), textPath, ocrText });
});

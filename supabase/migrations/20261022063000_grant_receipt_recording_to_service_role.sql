-- `receipt-ocr` calls this RPC with the service-role key after it has verified
-- the signed-in member and their group membership. The function is deliberately
-- not callable by browser roles, but the service role must be granted execute.
grant execute on function public.record_group_receipt_transaction(
  uuid, uuid, text, bigint, text, text, timestamptz, text, text, text, text
) to service_role;

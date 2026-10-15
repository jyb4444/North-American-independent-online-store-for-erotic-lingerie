/** Server-owned flags shared by the primary and legacy-column INSERT paths. */
export const pendingReviewFields = () => ({ approved: false, verified_purchase: false });
export const validReviewBody = (body: string) => body.trim().length >= 10 && body.trim().length <= 300;

/** Service-role reads must not expose contact details or account IDs through the API. */
export function publicReviewRow(row: Record<string, unknown>) {
  const columns = ['id','product_id','rating','body','nickname','verified_purchase','approved','photo_urls','video_urls','is_anonymous','created_at'];
  return { ...Object.fromEntries(columns.filter((key) => key in row).map((key) => [key,row[key]])), pending: row.approved !== true };
}

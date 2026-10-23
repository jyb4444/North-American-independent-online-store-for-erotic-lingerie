-- Newsletter and abandoned-cart marketing are retired. Remove historical raw
-- tokens from queued payloads while retaining delivery/audit metadata.
UPDATE public.notification_jobs
SET payload = payload - 'confirmationToken' - 'unsubscribeToken',
    status = CASE WHEN status = 'sent' THEN status ELSE 'manual_review' END,
    lease_token = NULL,
    lease_until = NULL,
    last_error = CASE WHEN status = 'sent' THEN last_error ELSE 'Newsletter delivery retired; message not sent' END
WHERE kind IN ('newsletter_confirmation', 'newsletter_welcome')
  AND (payload ? 'confirmationToken' OR payload ? 'unsubscribeToken' OR status <> 'sent');

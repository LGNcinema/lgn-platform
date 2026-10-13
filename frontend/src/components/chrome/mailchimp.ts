/**
 * Subscribe an email to the LGN Mailchimp audience without leaving the page.
 *
 * Mailchimp's hosted signup endpoint has a JSONP twin: the same URL with
 * `/post-json?` instead of `/post?`, plus a `c=<callback>` parameter. A normal
 * fetch can't read its answer (it sends no CORS headers), but a <script> tag
 * can, so this loads the response as a script that calls our callback with
 * `{ result: 'success' | 'error', msg }`. It needs no API key or backend; the
 * IDs in the URL are public (they appear in any Mailchimp embed).
 *
 * It is the long-standing way custom-styled Mailchimp forms work, but it is
 * not a documented, versioned API. If Mailchimp ever retires it, the fallback
 * is a backend route that calls their Marketing API with a key.
 */

/** The LGN audience's subscribe endpoint (from the Mailchimp embed). */
const SUBSCRIBE_URL =
  'https://lgncinema.us11.list-manage.com/subscribe/post-json?u=caa4412ef098b3a5c19d07418&id=e6be69f399&f_id=005feae1f0';

/** The audience's honeypot field: must be sent, and empty. */
export const MAILCHIMP_BOT_FIELD = 'b_caa4412ef098b3a5c19d07418_e6be69f399';

const TIMEOUT_MS = 10000;

export type SubscribeResult = { ok: true; alreadySubscribed?: boolean } | { ok: false; message: string };

/** Mailchimp's messages carry HTML (links) and a numeric field prefix
 *  ("0 - Please enter a value"); keep plain words only. */
function cleanMessage(msg: unknown): string {
  const text = String(msg ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/^\d+\s*-\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (/too many/i.test(text)) return 'Too many signup attempts. Please try again in a few minutes.';
  return text || 'That didn’t work. Please check the address and try again.';
}

export function subscribeEmail(email: string): Promise<SubscribeResult> {
  return new Promise((resolve) => {
    const callback = `lgnMailchimp_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const script = document.createElement('script');
    const w = window as unknown as Record<string, unknown>;

    const finish = (result: SubscribeResult) => {
      window.clearTimeout(timer);
      delete w[callback];
      script.remove();
      resolve(result);
    };

    w[callback] = (data: { result?: string; msg?: unknown }) => {
      const msg = String(data?.msg ?? '');
      // Mailchimp reports a repeat signup either as an error ("... is already
      // subscribed to list ...") or as a success ("You're already subscribed,
      // your profile has been updated"); both are a happy outcome.
      const already = /already (a list member|subscribed)/i.test(msg);
      if (already) finish({ ok: true, alreadySubscribed: true });
      else if (data?.result === 'success') finish({ ok: true });
      else finish({ ok: false, message: cleanMessage(msg) });
    };

    const timer = window.setTimeout(
      () => finish({ ok: false, message: 'Mailchimp didn’t respond. Please try again.' }),
      TIMEOUT_MS,
    );

    const params = new URLSearchParams({ EMAIL: email, [MAILCHIMP_BOT_FIELD]: '', c: callback });
    script.src = `${SUBSCRIBE_URL}&${params.toString()}`;
    script.onerror = () => finish({ ok: false, message: 'Couldn’t reach Mailchimp. Please try again.' });
    document.body.appendChild(script);
  });
}

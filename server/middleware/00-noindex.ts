/**
 * Host adapter: this Vercel preview is not lawyer-cleared production.
 * Every response gets X-Robots-Tag: noindex, nofollow.
 */
function withNoindex(result: unknown): unknown {
  if (!(result instanceof Response)) return result;
  const headers = new Headers(result.headers);
  headers.set("x-robots-tag", "noindex, nofollow");
  return new Response(result.body, {
    status: result.status,
    statusText: result.statusText,
    headers,
  });
}

export default async function noindex(
  _event: unknown,
  next: () => unknown | Promise<unknown>,
): Promise<unknown> {
  return withNoindex(await next());
}

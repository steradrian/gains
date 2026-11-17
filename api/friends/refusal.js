/* How a Friends route refuses: a thrown Refusal becomes `{ error, code }` with its status, anywhere
 * inside a handler or a store.mutate (which rolls back when its fn throws). Shared by routes.js,
 * cheers.js and challenges.js. */
export class Refusal extends Error {
  constructor(status, body) { super(body.error); this.status = status; this.body = body; }
}
export const refuse = (status, code, error, extra) => { throw new Refusal(status, { error, ...(code ? { code } : {}), ...(extra || {}) }); };
export const NOT_FOUND = () => refuse(404, 'not-found', 'not found');

export const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);

/** Refuses a body with any field outside `keys`. */
export function onlyKeys(body, keys) {
  for (const k of Object.keys(body)) if (!keys.includes(k)) refuse(400, 'bad-body', `unexpected field ${String(k).slice(0, 40)}`);
}

/** Wraps a handler so a Refusal answers instead of throwing. */
export const routeWith = json => fn => async (req, res) => {
  try { await fn(req, res); }
  catch (e) {
    if (e instanceof Refusal) { if (!res.headersSent) json(res, e.status, e.body, e.headers); return; }
    throw e;
  }
};

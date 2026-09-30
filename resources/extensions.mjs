/**
 * App Collection extensions follow the Quiz convention: { app, type }, dispatched in order.
 * store restores personal state on restore, saves on finish (Done) and emits stored after success.
 * Configure layouts: { key: stableCourseKey, store: ["ccm.store", { name, url }] }.
 * The resolved datastore uses the shared User instance for authentication.
 *
 * @param {Object} event Collection event passed through config.extensions.
 * @param {Object} event.app App Collection instance with layouts and user configured.
 * @param {string} event.type ready validates config; restore loads; finish saves.
 * @param {Object} [event.user] Account captured by the caller (realm and key).
 * @param {Object} [event.state] Snapshot captured on Done; falls back to app.state.
 * @returns {Promise<void>} Rejects on validation, account changes or datastore failures.
 * A rejected restore shows retry; a rejected finish keeps the editor open.
 */
export async function store({ app, type, user, state }) {
  if (!['ready', 'restore', 'finish'].includes(type)) return;
  const settings = app.layouts;
  if (!settings) return;
  if (!app.ccm.helper.isStore(settings.store)) throw new TypeError('layouts.store must be a ccm datastore.');
  const course = settings.key ?? app.key;
  if (!app.ccm.helper.isKey(course, false)) throw new TypeError('Personal layouts require a stable layouts.key or app.key.');
  if (!app.user) throw new TypeError('Personal layouts require a user component.');
  if (type === 'ready') return;

  const identity = user ?? app.user.getState();
  if (!identity || !app.ccm.helper.isKey(identity.realm, false) || !app.ccm.helper.isKey(identity.key, false))
    throw new TypeError('Personal layouts require a valid realm and user key.');
  const current = () => {
    const now = app.user.getState();
    if (!app.user.isLoggedIn() || now?.realm !== identity.realm || now?.key !== identity.key)
      throw new Error('The signed-in account changed while accessing the layout.');
  };
  current();
  const key = [course, identity.realm, identity.key];
  const snapshot = type === 'finish' ? structuredClone(state ?? app.state) : null;
  if (type === 'finish') validateState(snapshot);
  // Read before writing to preserve existing permissions, not reset them on each save.
  const previous = await settings.store.get(key);
  current();
  if (previous && (previous.app !== course || previous.realm !== identity.realm || previous.user !== identity.key))
    throw new Error('The saved layout does not match this course and user.');

  if (type === 'restore') {
    if (!previous) return;
    validateState(previous.state);
    app.state = structuredClone(previous.state);
    return;
  }

  const data = { key, app: course, realm: identity.realm, user: identity.key, state: snapshot };
  // As in Quiz: assign owner-only defaults on creation, retain server-managed permissions on updates.
  const permissions = previous ? previous._ : { access: { get: 'owner', set: 'owner', del: 'owner' } };
  if (permissions !== undefined) data._ = structuredClone(permissions);
  await settings.store.set(data);
  current();
  await app.emit('stored', { state: snapshot, user: identity });
}

/** Persist only names and references, never executable app configuration or authentication data. */
function validateState(state) {
  if (!state || !Array.isArray(state.sections) || Object.keys(state).some(key => key !== 'sections'))
    throw new TypeError('Invalid personal layout state.');
  const ids = new Set();
  const visit = (entries, depth = 0) => {
    if (!Array.isArray(entries) || depth > 21) throw new TypeError('Invalid personal layout nesting.');
    for (const entry of entries) {
      if (!entry || typeof entry.id !== 'string' || !entry.id || ids.has(entry.id) ||
          typeof entry.title !== 'string' || Object.keys(entry).some(key => !['id', 'title', 'items'].includes(key)))
        throw new TypeError('Invalid personal layout entry.');
      ids.add(entry.id);
      if (depth === 0 && !Array.isArray(entry.items)) throw new TypeError('Invalid layout section.');
      if (entry.items !== undefined) visit(entry.items, depth + 1);
    }
  };
  visit(state.sections);
}

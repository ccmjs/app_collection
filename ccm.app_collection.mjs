/**
 * A home screen for ccmjs apps, folders and widgets.
 *
 * Data flow: ignore (teacher template) -> normalize -> identify -> resolve(state)
 * -> sections (editable runtime model) -> capture -> state (names and IDs only).
 * The teacher template is never edited. Confirmed layouts are cached per account;
 * persistence is supplied through config callbacks or extensions.
 *
 * Code order: configuration, instance lifecycle/rendering, private state helpers,
 * then the private LayoutEditor class. All runtime logic lives in Instance.
 *
 * @author André Kless <andre.kless@web.de>
 * @copyright 2026 André Kless
 * @license MIT
 * @version 1.0.0
 */

export const component = {
  name: "app_collection",
  ccm: "././libs/framework/ccm-28.0.0.min.js",
  /** CCM resolves these dependencies before the instance lifecycle; ignore stays lazy. */
  config: {
    css: ["ccm.load", "././resources/styles.css"],
    title: "My Apps",
    description: "Everything in one place.",
    /** Maximum grid columns (1–12); CSS reduces this on narrow containers. */
    columns: 4,
    /** Teacher template: an item/dependency array or { sections: [{ id, title, items }] }. */
    ignore: [],
    // Descendant user instances share this session through their parent chain.
    // user: ["ccm.instance", "././libs/user/ccm.user-1.0.0.min.mjs"],
    /** Allow signed-in users to edit the layout. */
    editable: false,
    /** Optional async ({ app, state, user }) persistence callback, called on Done. */
    onlayoutchange: null,
    /** Optional async ({ app, user }) => personal state or null, called once per user per instance. */
    onlayoutload: null,
    /** Functions or ccm.load dependencies, called sequentially with { app, type }. */
    extensions: [],
    labels: { back: "Back", home: "Overview", loading: "Loading …", retry: "Try again",
      error: "The app could not be loaded.", empty: "No apps have been added yet.", folder: "Folder",
      edit: "Edit layout", done: "Done", cancelEdit: "Cancel", move: "Move", moveTo: "Move to section",
      sectionName: "Section name", itemName: "Item name", loadError: "Your layout could not be loaded.", moved: "Moved:", saving: "Saving layout …", saved: "Layout updated.",
      saveError: "The layout could not be saved. Try Done again or cancel your changes.",
      editHelp: "Drag a handle to move an item, or use its arrow keys. Use the menu to move between sections.",
    },
  },
  Instance: function () {
    /** Runtime layout for the active account; restored by extensions and updated by the editor. */
    this.state = null;

    // Runtime views and child apps survive navigation, but are released on start/destroy.
    // sections is a fresh model derived from ignore; sessions holds cloned, confirmed states.
    let views = new Map(), children = new Set(), pending = new Set(), history = [], current, ui;
    // Incrementing generation makes pending child loads from an old render obsolete.
    let generation = 0, editor, sections = [];
    const sessions = new Map();
    /**
     * Await extensions in config order; a rejection stops the remaining handlers.
     * Lifecycle: init -> ready -> restore (uncached signed-in account) -> start.
     * Done emits finish before committing. Persistence extensions may emit stored.
     * @param {string} type Event name.
     * @param {Object} [details] Additional event fields; app and type are supplied here.
     * @returns {Promise<void>}
     */
    this.emit = async (type, details = {}) => {
      const event = { ...details, app: this, type };
      for (const extension of [].concat(this.extensions || [])) if (extension) await extension(event);
    };
    this.init = async () => this.emit('init');
    this.ready = async () => this.emit('ready');
    // owner identifies the rendered account. queue serializes starts, including login changes.
    let owner, userListener, queue = Promise.resolve(), rendering = false, destroyed = false;
    const identity = () => {
      const user = this.user?.isLoggedIn?.() ? this.user.getState() : null;
      return user ? JSON.stringify([this.user.url || '', user.realm, user.key]) : 'guest';
    };
    /** @returns {Object|null} Independent snapshot of state, including unconfirmed edits. */
    this.getLayout = () => this.ccm.helper.clone(this.state);
    /** Internal editor bridge: publish names/order from sections without saving them. */
    this.updateLayoutState = () => { this.state = capture(sections); };
    /** Internal editor bridge: cache state only after all save handlers have succeeded. */
    this.commitLayoutState = () => { this.updateLayoutState(); sessions.set(owner, this.getLayout()); };
    /** Subscribe once; an account change cancels editing and rebuilds the collection. */
    const bindUser = () => {
      if (!this.user || userListener) return;
      userListener = async () => {
        if (destroyed || owner === identity()) return;
        editor?.abort();
        // Hide outgoing content immediately, even if a child is still loading.
        if (ui?.content) { ui.content.hidden = true; ui.content.inert = true; }
        if (!rendering) await this.start();
      };
      this.user.extensions = [].concat(this.user.extensions || [], userListener);
    };
    // DOM helpers use textContent for user-provided labels, never HTML interpolation.
    const node = (tag, className, text) => {
      const el = document.createElement(tag);
      if (className) el.className = className;
      if (text !== undefined) el.textContent = text;
      return el;
    };
    const button = (text, action, className) => {
      const el = node("button", className, text);
      el.type = "button";
      el.addEventListener("click", action);
      return el;
    };
    /** Release both the child host and CCM's parent/child registry entry. */
    const release = async child => {
      try { await child.destroy?.(); }
      finally { child.host?.remove(); if (this.children) delete this.children[child.index]; }
    };
    /** Invalidate pending mounts, await cleanup, and keep personal layout caches intact. */
    const clearUI = async () => {
      generation++;
      editor?.destroy(); editor = null;
      await Promise.allSettled([...pending]);
      const results = await Promise.allSettled([...children].map(release));
      children.clear(); views.clear(); history = []; current = null;
      this.element.replaceChildren();
      const failure = results.find(result => result.status === "rejected");
      if (failure) throw failure.reason;
    };
    /**
     * Remove account listeners and release child apps, including pending starts.
     * Await before reusing the instance; a child start that never settles delays cleanup.
     * @returns {Promise<void>}
     */
    this.destroy = async () => {
      destroyed = true;
      if (this.user && userListener)
        this.user.extensions = [].concat(this.user.extensions || []).filter(fn => fn !== userListener);
      userListener = null;
      await clearUI();
    };
    /** Start one lazy dependency; failures get a local retry without breaking other tiles. */
    const mount = (item, target) => {
      const token = generation;
      const startChild = async () => {
        target.replaceChildren(node("p", "ac-status", this.labels.loading));
        target.setAttribute("aria-busy", "true");
        const host = node("div", "ac-child");
        target.append(host);
        try {
          // Clone the dependency with ccm's helper: configurations may contain callbacks/components.
          const [op, source, config = {}] = this.ccm.helper.clone(item.app);
          const child = await this.ccm.helper.solveDependency([op, source, config, host], this);
          if (token !== generation) { await release(child); return; }
          children.add(child);
          target.querySelector(".ac-status")?.remove();
        } catch (error) {
          // ccm can register a child before its start() rejects. Release that partial instance too.
          const partial = Object.values(this.children || {}).filter(child => child.host && host.contains(child.host));
          await Promise.allSettled(partial.map(release));
          if (token !== generation) return;
          target.replaceChildren(node("p", "ac-status", this.labels.error));
          target.append(button(this.labels.retry, () => track(startChild()), "ac-retry"));
          console.error("App Collection:", error);
        } finally { target.removeAttribute("aria-busy"); }
      };
      const track = promise => {
        pending.add(promise);
        promise.finally(() => pending.delete(promise));
      };
      track(startChild());
    };
    const icon = item => {
      const el = node("span", "ac-icon");
      el.setAttribute("aria-hidden", "true");
      if (item.icon?.startsWith("https://") || item.icon?.startsWith("http://") || item.icon?.startsWith("./") || item.icon?.startsWith("/")) {
        const img = node("img"); img.src = item.icon; img.alt = ""; el.append(img);
      } else el.textContent = item.icon || (item.type === "folder" ? "▦" : "◈");
      return el;
    };
    /** Cache each view by item identity; hiding it preserves live child instances. */
    const show = (key, title, create, opener) => {
      if (current) { current.view.hidden = true; history.push({ ...current, opener }); }
      let view = views.get(key);
      if (!view) {
        view = node("div", "ac-view"); views.set(key, view); ui.content.append(view);
        create(view);
      }
      view.hidden = false;
      current = { view, title, key };
      ui.heading.textContent = title;
      ui.back.hidden = history.length === 0;
      ui.home.hidden = history.length === 0;
      if (history.length) ui.heading.focus();
    };
    /** Restore the previous view and focus the tile that originally opened this one. */
    const back = () => {
      if (!history.length) return;
      current.view.hidden = true;
      const previous = history.pop(); current = previous; previous.view.hidden = false;
      ui.heading.textContent = typeof previous.key === "object" ? previous.key.title : previous.title;
      ui.back.hidden = ui.home.hidden = history.length === 0;
      previous.opener?.focus();
    };
    /** Register editable wrappers; widgets start now, tile apps only when opened. */
    const grid = (items, target) => {
      const el = node("div", "ac-grid"); target.append(el);
      const empty = node("p", "ac-empty", this.labels.empty); empty.hidden = items.length > 0; el.append(empty);
      editor.grid(items, el, target.closest(".ac-view"));
      for (const item of items) {
        const wrapper = node("div", "ac-item");
        if (item.type === "widget") {
          wrapper.style.setProperty("--span", Math.min(item.width, this.columns));
          wrapper.style.setProperty("--rows", item.height);
        }
        el.append(wrapper);
        editor.entry(item, wrapper);
        if (item.type === "widget") {
          const card = node("section", "ac-widget");
          card.style.setProperty("--span", Math.min(item.width, this.columns));
          card.style.setProperty("--rows", item.height);
          card.setAttribute("aria-label", item.title);
          card.append(node("h3", "ac-widget-title", item.title));
          const content = node("div", "ac-widget-content"); card.append(content); wrapper.append(card);
          mount(item, content);
        } else {
          const tile = button("", () => show(item, item.title, view => {
            if (item.type === "folder") grid(item.items, view);
            else mount(item, view);
          }, tile), "ac-tile");
          tile.append(icon(item), node("span", "ac-tile-title", item.title));
          if (item.type === "folder") tile.append(node("span", "ac-caption", `${this.labels.folder} · ${item.items.length}`));
          else if (item.description) tile.append(node("span", "ac-caption", item.description));
          wrapper.append(tile);
        }
      }
    };
    /** Rebuild in order: cleanup -> user host -> account state -> grids -> start event. */
    const render = async () => {
      await clearUI();
      if (destroyed) return;
      // ccm replaces nested configuration objects; retain defaults for partial label overrides.
      this.labels = { ...component.config.labels, ...this.labels };
      if (!Number.isInteger(this.columns) || this.columns < 1 || this.columns > 12)
        throw new TypeError("columns must be an integer from 1 to 12.");
      sections = [];
      const root = node("section", "app-collection");
      root.style.setProperty("--columns", this.columns);
      const nav = node("nav", "ac-nav"); nav.setAttribute("aria-label", this.labels.home);
      const backButton = button(this.labels.back, back);
      const homeButton = button(this.labels.home, () => { while (history.length) back(); });
      nav.append(backButton, homeButton);
      const heading = node("h1", "ac-heading"); heading.tabIndex = -1;
      const content = node("div", "ac-content");
      const header = node("header", "ac-header");
      header.append(nav);
      if (this.user) {
        const account = node("div", "ac-user");
        account.append(this.user.host);
        header.append(account);
      }
      root.append(header, heading, content); this.element.append(root);
      // Attach the host before start(): autoLogin may open a modal and await sign-in.
      if (this.user) await this.user.start();
      const nextOwner = identity();
      // Preserve state restored before first start; subsequent accounts use their own cache.
      if (owner !== nextOwner) {
        this.state = owner === undefined ? this.state : null;
        owner = nextOwner;
        if (sessions.has(owner)) this.state = this.ccm.helper.clone(sessions.get(owner));
      }
      // Recheck identity after async restoration so late results cannot render for another user.
      if (owner !== 'guest' && !sessions.has(owner)) {
        content.textContent = this.labels.loading;
        try {
          const user = this.ccm.helper.clone(this.user.getState());
          if (this.onlayoutload) {
            const loaded = await this.onlayoutload({ app: this, user });
            if (destroyed || identity() !== owner) return;
            this.state = loaded;
          }
          await this.emit('restore', { user });
          if (destroyed || identity() !== owner) return;
        } catch (error) {
          if (destroyed || identity() !== owner) return;
          content.replaceChildren(node('p', '', this.labels.loadError), button(this.labels.retry, () => this.start().catch(console.error)));
          throw error;
        }
        content.replaceChildren();
      }
      if (destroyed || identity() !== owner) return;
      sections = resolve(identify(normalize(this.ignore)), this.state);
      this.updateLayoutState();
      sessions.set(owner, this.getLayout());
      const toolbar = node("div", "ac-editor-toolbar"); header.insertBefore(toolbar, header.lastChild === nav ? null : header.lastChild);
      editor = new LayoutEditor(this, sections, root, toolbar);
      ui = { heading, content, back: backButton, home: homeButton };
      show("home", this.title, view => {
        if (this.description) view.append(node("p", "ac-description", this.description));
        for (const section of sections) {
          const area = node("section", "ac-section");
          editor.section(section, area, sections.indexOf(section));
          if (section.description) area.append(node("p", "ac-description", section.description));
          view.append(area); grid(section.items, area);
        }
      });
      await this.emit('start');
    };
    /**
     * Queue a complete rebuild. Re-render if the account changes during async work.
     * A failed start rejects its caller but does not block later retries in the queue.
     * @returns {Promise<void>}
     */
    this.start = () => {
      destroyed = false;
      bindUser();
      const task = async () => {
        if (destroyed) return;
        rendering = true;
        try {
          do { await render(); } while (!destroyed && owner !== identity());
        } finally { rendering = false; }
      };
      const result = queue.then(task, task);
      queue = result.catch(() => {});
      return result;
    };

    // Private template/state helpers. Their input is data, not mounted child instances.

    /**
     * Create fresh section/item objects and validate dependencies before starting children.
     * App dependencies retain their callback references and remain unresolved.
     * @param {Array|Object} ignore Teacher template; never mutated.
     * @returns {Array<Object>} Normalized sections with app, folder or widget items.
     * @throws {TypeError} Invalid structure, dependency, widget size or folder depth.
     */
    function normalize(ignore) {
      let count = 0;
      const items = (values, depth = 0) => {
        if (!Array.isArray(values)) throw new TypeError("items must be an array.");
        if (depth > 20) throw new TypeError("Folders may be nested at most 20 levels deep.");
        return values.map(value => {
          const item = Array.isArray(value) ? { app: value } : value;
          if (!item || typeof item !== "object") throw new TypeError("Invalid collection item.");
          const type = item.type || (item.items ? "folder" : "app");
          if (!["app", "folder", "widget"].includes(type)) throw new TypeError(`Unknown item type: ${type}`);
          const title = item.title || `${type === "folder" ? "Folder" : "App"} ${++count}`;
          if (type === "folder") return { ...item, type, title, items: items(item.items, depth + 1) };
          if (!Array.isArray(item.app) || item.app[0] !== "ccm.start" || !item.app[1])
            throw new TypeError(`${title}: app must be a ccm.start dependency.`);
          const width = item.width ?? 2, height = item.height ?? 2;
          if (type === "widget" && (![width, height].every(v => Number.isInteger(v) && v >= 1 && v <= 12)))
            throw new TypeError(`${title}: widget width and height must be integers from 1 to 12.`);
          return { ...item, type, title, width, height };
        });
      };
      if (Array.isArray(ignore)) return [{ items: items(ignore) }];
      if (!ignore || !Array.isArray(ignore.sections)) throw new TypeError("ignore must be an array or contain sections.");
      if (!ignore.sections.length) return [{ items: [] }];
      return ignore.sections.map(section => {
        if (!section || typeof section !== "object") throw new TypeError("Invalid section.");
        return { ...section, title: section.title, description: section.description, items: items(section.items) };
      });
    }

    /**
     * Assign missing IDs in place on the normalized model; reject duplicates across all entries.
     * Explicit IDs survive course updates. Position-based fallbacks only survive stable structure.
     * @param {Array<Object>} sections Normalized sections, not the original ignore config.
     * @returns {Array<Object>} The same sections, now with unique IDs.
     */
    function identify(sections) {
      const ids = new Set();
      const assign = (entry, fallback) => {
        entry.id ??= fallback;
        if (typeof entry.id !== 'string' || !entry.id || ids.has(entry.id))
          throw new TypeError('Section and item IDs must be unique non-empty strings.');
        ids.add(entry.id);
      };
      const visit = (items, prefix) => items.forEach((item, i) => {
        assign(item, `${prefix}/item-${i + 1}`);
        if (item.items) visit(item.items, item.id);
      });
      sections.forEach((section, i) => { assign(section, `section-${i + 1}`); visit(section.items, section.id); });
      return sections;
    }
    /**
     * Project the runtime model into persistable names and references; omit app configuration.
     * @param {Array<Object>} sections Normalized sections with IDs.
     * @returns {{sections: Array<{id: string, title: string, items: Array}>}} New state tree.
     */
    function capture(sections) {
      const entry = item => ({ id: item.id, title: item.title || '', ...(item.items ? { items: item.items.map(entry) } : {}) });
      return { sections: sections.map(entry) };
    }

    /**
     * Apply saved names/order to a fresh template model, mutating its entries in place.
     * Resolve dependencies exclusively from the template: saved state cannot inject apps.
     * Removed IDs disappear; omitted/new materials return to their original containers.
     * @param {Array<Object>} template Normalized, identified sections.
     * @param {Object|null} state Personal snapshot; null returns the template unchanged.
     * @returns {Array<Object>} Sections arranged for this account.
     * @throws {TypeError} Malformed state, duplicate references or excessive nesting.
     */
    function resolve(template, state) {
      if (state == null) return template;
      if (!Array.isArray(state.sections)) throw new TypeError('state.sections must be an array.');
      // Keep original membership separately because applying saved order mutates item arrays.
      const catalog = new Map(), originals = new Map();
      const visit = items => items.forEach(item => {
        catalog.set(item.id, item);
        if (item.items) { originals.set(item.id, [...item.items]); visit(item.items); }
      });
      template.forEach(section => { originals.set(section.id, [...section.items]); visit(section.items); });
      const used = new Set(), sectionIds = new Set();
      const title = (saved, original) => typeof saved.title === 'string' ? saved.title.slice(0, 200) : original;
      const list = (saved, depth = 0) => {
        if (!Array.isArray(saved) || depth > 20) throw new TypeError('Invalid personal layout.');
        return saved.flatMap(value => {
          if (!value || typeof value.id !== 'string') throw new TypeError('Invalid layout entry.');
          const item = catalog.get(value.id);
          if (!item) return [];
          if (used.has(item.id)) throw new TypeError('A layout item may occur only once.');
          used.add(item.id);
          item.title = title(value, item.title);
          if (item.type === 'folder') item.items = list(value.items || [], depth + 1);
          return [item];
        });
      };
      const result = state.sections.flatMap(saved => {
        if (!saved || typeof saved.id !== 'string') throw new TypeError('Invalid section reference.');
        const section = template.find(s => s.id === saved.id);
        if (!section) return [];
        if (sectionIds.has(section.id)) throw new TypeError('Duplicate section reference.');
        sectionIds.add(section.id);
        section.title = title(saved, section.title);
        section.items = list(saved.items || []);
        return [section];
      });
      for (const section of template) if (!sectionIds.has(section.id)) { section.items = []; result.push(section); }
      // Append all omitted/new items to their original container, without duplicating moved items.
      for (const section of result) {
        const append = container => {
          for (const item of originals.get(container.id) || []) if (!used.has(item.id)) {
            used.add(item.id); container.items.push(item);
            if (item.type === 'folder') item.items = [];
          }
        };
        append(section);
      }
      // A folder can have moved to another section, so visit the final tree rather than its original location.
      const complete = (items, depth = 0) => {
        if (depth > 20) throw new TypeError('Invalid folder nesting.');
        for (const item of items) if (item.type === 'folder') {
          for (const child of originals.get(item.id) || []) if (!used.has(child.id)) {
            used.add(child.id); item.items.push(child);
            if (child.type === 'folder') child.items = [];
          }
          complete(item.items, depth + 1);
        }
      };
      result.forEach(section => complete(section.items));
      return result;
    }

    /**
     * Private editor for the live sections model and its existing DOM wrappers.
     * begin snapshots names/order; edits update app.state; save awaits persistence;
     * abort restores the snapshot. Moving wrappers avoids restarting child apps.
     * All entry points enforce login/editable/busy state, including pointer and keyboard input.
     */
    class LayoutEditor {
      /**
       * @param {Object} app Owning App Collection instance.
       * @param {Array<Object>} sections Live model shared with rendering and capture().
       * @param {HTMLElement} root Collection root for status and editing styles.
       * @param {HTMLElement} toolbar Container for Done/Edit and Cancel controls.
       */
      constructor(app, sections, root, toolbar) {
        Object.assign(this, { app, sections, root });
        // grids links model arrays to visible containers; entries links item objects to controls.
        this.grids = [];
        this.entries = new Map();
        this.names = [];
        this.active = false;
        this.busy = false;
        // A version change invalidates pending save completion after abort or account change.
        this.version = 0;
        this.button = this.make('button', '', app.labels.edit);
        this.button.type = 'button';
        this.button.addEventListener('click', () => this.active ? this.save() : this.begin());
        this.cancel = this.make('button', '', app.labels.cancelEdit);
        this.cancel.type = 'button';
        this.cancel.addEventListener('click', () => this.abort());
        toolbar.append(this.button, this.cancel);
        this.status = this.make('p', 'ac-edit-status');
        this.status.setAttribute('role', 'status');
        root.append(this.status);
        // Extensions are removable; User.subscribe() currently has no unsubscribe API.
        this.listener = () => this.refresh();
        if (app.user) {
          app.user.extensions = [].concat(app.user.extensions || [], this.listener);
        }
        this.refresh();
      }
      make(tag, css, text) {
        const el = document.createElement(tag);
        el.className = css;
        if (text !== undefined) el.textContent = text;
        return el;
      }
      allowed() { return this.app.editable === true && !!this.app.user?.isLoggedIn?.(); }
      identity() { const user = this.app.user?.getState?.(); return JSON.stringify(user ? [this.app.user.url || '', user.realm, user.key] : null); }
      /** Reflect permissions and editor state in controls; cancel edits owned by another account. */
      refresh() {
        if (this.active && (!this.allowed() || this.owner !== this.identity())) this.abort();
        this.button.hidden = !this.allowed();
        this.button.disabled = this.busy;
        this.button.textContent = this.active ? this.app.labels.done : this.app.labels.edit;
        this.button.setAttribute('aria-pressed', String(this.active));
        this.cancel.hidden = !this.active;
        this.cancel.disabled = this.busy;
        this.root.classList.toggle('ac-editing', this.active);
        for (const { handle, select, name } of this.entries.values()) {
          handle.hidden = select.hidden = name.hidden = !this.active;
          name.disabled = this.busy;
          handle.disabled = this.busy;
          select.disabled = this.busy || select.options.length < 2;
        }
        for (const { input, heading } of this.names) {
          input.hidden = !this.active;
          input.disabled = this.busy;
          heading.hidden = this.active || !heading.textContent;
        }
      }
      /** Snapshot array membership and titles by reference, so Cancel preserves child instances. */
      begin() {
        if (!this.allowed() || this.busy) return;
        this.owner = this.identity();
        this.snapshot = this.allLists().map(items => [items, [...items]]);
        this.titles = this.sections.map(s => s.title);
        this.itemTitles = this.allLists().flat().map(item => [item, item.title]);
        this.active = true;
        this.status.textContent = this.app.labels.editHelp;
        this.refresh();
      }
      /** Collect every section/folder array, including folders whose views have not been opened. */
      allLists() {
        const lists = [];
        const visit = items => { lists.push(items); for (const item of items) if (item.type === 'folder') visit(item.items); };
        this.sections.forEach(s => visit(s.items));
        return lists;
      }
      /** Invalidate pending saves and restore the snapshot in place; never persist cancelled edits. */
      abort() {
        this.version++;
        this.endDrag();
        if (this.active) {
          this.snapshot.forEach(([items, original]) => items.splice(0, items.length, ...original));
          this.sections.forEach((s, i) => { s.title = this.titles[i]; });
          this.itemTitles.forEach(([item, title]) => { item.title = title; });
          this.sync();
        }
        this.active = this.busy = false;
        this.status.textContent = '';
        this.refresh();
      }
      /** Freeze a snapshot, await callbacks and finish extensions, then commit for the same account. */
      async save() {
        if (!this.allowed() || this.busy) return;
        this.endDrag();
        this.busy = true;
        const version = ++this.version;
        const layout = this.app.getLayout();
        const user = this.app.user.getState();
        this.refresh();
        this.status.textContent = this.app.labels.saving;
        try {
          await this.app.onlayoutchange?.({ app: this.app, state: layout, layout, user });
          if (version !== this.version || !this.allowed() || this.owner !== this.identity()) return;
          await this.app.emit('finish', { state: layout, user });
          if (version !== this.version) return;
          if (!this.allowed() || this.owner !== this.identity()) { this.abort(); return; }
          this.app.commitLayoutState();
          this.active = false;
          this.status.textContent = this.app.labels.saved;
        } catch (error) {
          if (version === this.version) {
            this.status.textContent = this.app.labels.saveError;
            console.error('App Collection layout:', error);
          }
        } finally {
          if (version === this.version) { this.busy = false; this.refresh(); }
        }
      }
      /** Pair a section heading with its edit field; changes update only the runtime model. */
      section(section, area, index) {
        const heading = this.make('h2', 'ac-section-title', section.title || '');
        const input = this.make('input', 'ac-section-name');
        input.type = 'text'; input.value = section.title || ''; input.maxLength = 200;
        input.setAttribute('aria-label', `${this.app.labels.sectionName} ${index + 1}`);
        input.addEventListener('change', () => {
          if (!this.active || !this.allowed() || this.busy) { input.value = section.title || ''; return; }
          section.title = input.value.trim(); heading.textContent = section.title;
          this.updateChoices();
          this.app.updateLayoutState();
        });
        area.append(heading, input);
        this.names.push({ input, heading, section });
        this.refresh();
      }
      /** Register a grid and its view boundary for legal move destinations. */
      grid(items, el, view) {
        this.grids.push({ items, el, view });
        this.updateChoices();
      }
      /** Attach rename, keyboard, menu and Pointer Events controls to one existing wrapper. */
      entry(item, el) {
        const controls = this.make('div', 'ac-item-tools');
        const handle = this.make('button', 'ac-drag-handle', '⠿'); handle.type = 'button';
        handle.setAttribute('aria-label', `${this.app.labels.move} ${item.title}`);
        handle.title = this.app.labels.editHelp;
        const select = this.make('select', 'ac-move-to');
        select.setAttribute('aria-label', `${this.app.labels.moveTo} ${item.title}`);
        controls.append(handle, select); el.prepend(controls);
        const name = this.make('input', 'ac-item-name');
        name.type = 'text'; name.value = item.title; name.maxLength = 200;
        name.setAttribute('aria-label', `${this.app.labels.itemName}: ${item.title}`);
        name.addEventListener('change', () => {
          if (!this.active || !this.allowed() || this.busy) { name.value = item.title; return; }
          item.title = name.value.trim() || item.title;
          this.sync();
        });
        controls.after(name);
        this.entries.set(item, { el, handle, select, name });
        select.addEventListener('change', () => {
          const destination = this.grids[Number(select.value)];
          if (destination) this.move(item, destination, null);
          select.value = '';
        });
        handle.addEventListener('keydown', event => {
          if (event.key === 'Escape') { this.endDrag(); return; }
          if (!['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'].includes(event.key)) return;
          event.preventDefault();
          const grid = this.grids.find(g => g.items.includes(item));
          const index = grid.items.indexOf(item);
          const delta = ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1;
          if (index + delta < 0 || index + delta >= grid.items.length) return;
          this.move(item, grid, delta < 0 ? grid.items[index - 1] : grid.items[index + 2] || null);
          handle.focus();
        });
        handle.addEventListener('pointerdown', event => {
          if (!this.active || !this.allowed() || this.busy || this.drag || !event.isPrimary || event.button !== 0) return;
          event.preventDefault();
          handle.setPointerCapture(event.pointerId);
          const ghost = this.make('div', 'ac-drag-ghost', item.title); ghost.setAttribute('aria-hidden', 'true');
          // A viewport-fixed preview must be outside container-query/shadow hosts.
          ghost.style.cssText = 'position:fixed;z-index:10000;pointer-events:none;background:#234e68;color:white;padding:12px 20px;border-radius:12px;max-width:220px;font:16px/1.5 system-ui';
          document.body.append(ghost);
          this.drag = { item, handle, ghost, id: event.pointerId, x: event.clientX, y: event.clientY };
          this.pointer(event);
          const scroll = () => {
            if (!this.drag) return;
            const { x, y } = this.drag;
            // Scroll the nearest scrollable ancestor, then the document at the viewport edge.
            for (let el = handle.parentElement; el; el = el.parentElement || el.getRootNode().host) {
              const rect = el.getBoundingClientRect();
              if (el.scrollHeight > el.clientHeight && /auto|scroll/.test(getComputedStyle(el).overflowY)) {
                const dy = y < rect.top + 40 ? -10 : y > rect.bottom - 40 ? 10 : 0;
                if (dy) { el.scrollTop += dy; break; }
              }
            }
            if (y < 48) window.scrollBy(0, -10);
            else if (y > innerHeight - 48) window.scrollBy(0, 10);
            this.pointer({ pointerId: this.drag.id, clientX: x, clientY: y });
            this.frame = requestAnimationFrame(scroll);
          };
          this.frame = requestAnimationFrame(scroll);
        });
        handle.addEventListener('pointermove', event => this.pointer(event));
        handle.addEventListener('pointerup', event => {
          if (event.pointerId !== this.drag?.id) return;
          const { destination, before } = this.drag;
          this.endDrag();
          if (destination) this.move(item, destination, before);
          handle.focus();
        });
        for (const type of ['pointercancel', 'lostpointercapture']) handle.addEventListener(type, () => this.endDrag());
        this.updateChoices(); this.refresh();
      }
      /** Hit-test visible grid rectangles; preview insertion without changing model order. */
      pointer(event) {
        const drag = this.drag;
        if (!drag || drag.id !== event.pointerId) return;
        drag.x = event.clientX; drag.y = event.clientY;
        drag.ghost.style.left = `${drag.x + 14}px`; drag.ghost.style.top = `${drag.y + 14}px`;
        this.clearTarget(); drag.destination = null; drag.before = null;
        for (const grid of this.grids) {
          if (grid.view.hidden || !grid.el.getClientRects().length) continue;
          const rect = grid.el.getBoundingClientRect();
          if (drag.x < rect.left || drag.x > rect.right || drag.y < rect.top || drag.y > rect.bottom) continue;
          drag.destination = grid;
          for (const item of grid.items) {
            const box = this.entries.get(item).el.getBoundingClientRect();
            if (drag.y < box.top || (drag.y <= box.bottom && drag.x < box.left + box.width / 2)) {
              drag.before = item; break;
            }
          }
          const target = drag.before ? this.entries.get(drag.before).el : grid.el;
          target.classList.add('ac-drop-target'); this.target = target;
          break;
        }
      }
      clearTarget() { this.target?.classList.remove('ac-drop-target'); this.target = null; }
      /** Release pointer capture, animation frame, preview and drop marker on every exit path. */
      endDrag() {
        const drag = this.drag; this.drag = null;
        cancelAnimationFrame(this.frame); this.clearTarget();
        drag?.ghost.remove();
        if (drag?.handle.hasPointerCapture(drag.id)) drag.handle.releasePointerCapture(drag.id);
      }
      /** Move within the current view; before=null appends. Folder boundaries cannot be crossed. */
      move(item, destination, before) {
        if (!this.active || !this.allowed() || this.busy || before === item) return;
        const source = this.grids.find(g => g.items.includes(item));
        // Only grids on the same view: prevents moving a folder into its descendants.
        if (!source || source.view !== destination.view) return;
        source.items.splice(source.items.indexOf(item), 1);
        const index = before ? destination.items.indexOf(before) : destination.items.length;
        destination.items.splice(index, 0, item);
        this.sync();
        this.status.textContent = `${this.app.labels.moved} ${item.title}`;
      }
      /** Reorder existing DOM wrappers, refresh labels, and publish the edited state. */
      sync() {
        for (const grid of this.grids) {
          for (const item of grid.items) {
            const el = this.entries.get(item).el;
            // moveBefore preserves live iframe/custom-element state where supported.
            if (grid.el.moveBefore && el.isConnected) grid.el.moveBefore(el, null);
            else grid.el.append(el);
          }
          grid.el.querySelector('.ac-empty').hidden = grid.items.length > 0;
        }
        for (const { input, heading, section } of this.names) {
          input.value = heading.textContent = section.title || '';
        }
        for (const [item, { el, handle, select, name }] of this.entries) {
          name.value = item.title;
          const title = el.querySelector('.ac-tile-title, .ac-widget-title');
          if (title) title.textContent = item.title;
          el.querySelector('.ac-widget')?.setAttribute('aria-label', item.title);
          handle.setAttribute('aria-label', `${this.app.labels.move} ${item.title}`);
          select.setAttribute('aria-label', `${this.app.labels.moveTo} ${item.title}`);
          name.setAttribute('aria-label', `${this.app.labels.itemName}: ${item.title}`);
        }
        this.updateChoices();
        this.app.updateLayoutState();
      }
      /** Offer only other grids on the same view; hidden folder views are not destinations. */
      updateChoices() {
        for (const [item, { select }] of this.entries) {
          const source = this.grids.find(g => g.items.includes(item));
          select.replaceChildren(new Option(this.app.labels.moveTo, ''));
          this.grids.forEach((grid, index) => {
            if (grid === source || grid.view !== source?.view) return;
            const section = this.sections.find(s => s.items === grid.items);
            select.add(new Option(section?.title || `${this.app.labels.sectionName} ${index + 1}`, String(index)));
          });
          select.disabled = this.busy || select.options.length < 2;
        }
      }
      /** Cancel edits and release the editor listener; child cleanup belongs to the collection. */
      destroy() {
        this.abort();
        if (this.app.user) this.app.user.extensions = [].concat(this.app.user.extensions || []).filter(fn => fn !== this.listener);
      }
    }
  },
};

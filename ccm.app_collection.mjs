/** A home screen for ccmjs apps, folders and widgets. @license MIT */
export const component = {
  name: "app_collection",
  ccm: "././libs/framework/ccm.js",
  config: {
    css: ["ccm.load", "././resources/styles.css"],
    title: "Meine Apps",
    description: "Alles an einem Ort.",
    columns: 4,
    ignore: [],
    labels: { back: "Zurück", home: "Übersicht", loading: "Wird geladen …", retry: "Erneut versuchen",
      error: "Die App konnte nicht geladen werden.", empty: "Hier sind noch keine Apps eingerichtet.", folder: "Ordner" },
  },
  Instance: function () {
    let views = new Map(), children = new Set(), pending = new Set(), history = [], current, ui;
    let generation = 0;
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
    const release = async child => {
      try { await child.destroy?.(); }
      finally { child.host?.remove(); if (this.children) delete this.children[child.index]; }
    };
    this.destroy = async () => {
      generation++;
      await Promise.allSettled([...pending]);
      const results = await Promise.allSettled([...children].map(release));
      children.clear(); views.clear(); history = []; current = null;
      this.element.replaceChildren();
      const failure = results.find(result => result.status === "rejected");
      if (failure) throw failure.reason;
    };
    const mount = (item, target) => {
      const token = generation;
      const load = async () => {
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
          target.append(button(this.labels.retry, () => track(load()), "ac-retry"));
          console.error("App Collection:", error);
        } finally { target.removeAttribute("aria-busy"); }
      };
      const track = promise => {
        pending.add(promise);
        promise.finally(() => pending.delete(promise));
      };
      track(load());
    };
    const icon = item => {
      const el = node("span", "ac-icon");
      el.setAttribute("aria-hidden", "true");
      if (item.icon?.startsWith("https://") || item.icon?.startsWith("http://") || item.icon?.startsWith("./") || item.icon?.startsWith("/")) {
        const img = node("img"); img.src = item.icon; img.alt = ""; el.append(img);
      } else el.textContent = item.icon || (item.type === "folder" ? "▦" : "◈");
      return el;
    };
    const show = (key, title, create, opener) => {
      if (current) { current.view.hidden = true; history.push({ ...current, opener }); }
      let view = views.get(key);
      if (!view) {
        view = node("div", "ac-view"); views.set(key, view); ui.content.append(view);
        create(view);
      }
      view.hidden = false;
      current = { view, title };
      ui.heading.textContent = title;
      ui.back.hidden = history.length === 0;
      ui.home.hidden = history.length === 0;
      if (history.length) ui.heading.focus();
    };
    const back = () => {
      if (!history.length) return;
      current.view.hidden = true;
      const previous = history.pop(); current = previous; previous.view.hidden = false;
      ui.heading.textContent = previous.title;
      ui.back.hidden = ui.home.hidden = history.length === 0;
      previous.opener?.focus();
    };
    const grid = (items, target) => {
      const el = node("div", "ac-grid"); target.append(el);
      if (!items.length) el.append(node("p", "ac-empty", this.labels.empty));
      for (const item of items) {
        if (item.type === "widget") {
          const card = node("section", "ac-widget");
          card.style.setProperty("--span", Math.min(item.width, this.columns));
          card.style.setProperty("--rows", item.height);
          card.setAttribute("aria-label", item.title);
          card.append(node("h3", "ac-widget-title", item.title));
          const content = node("div", "ac-widget-content"); card.append(content); el.append(card);
          mount(item, content);
        } else {
          const tile = button("", () => show(item, item.title, view => {
            if (item.type === "folder") grid(item.items, view);
            else mount(item, view);
          }, tile), "ac-tile");
          tile.append(icon(item), node("span", "ac-tile-title", item.title));
          if (item.type === "folder") tile.append(node("span", "ac-caption", `${this.labels.folder} · ${item.items.length}`));
          else if (item.description) tile.append(node("span", "ac-caption", item.description));
          el.append(tile);
        }
      }
    };
    this.start = async () => {
      await this.destroy();
      if (!Number.isInteger(this.columns) || this.columns < 1 || this.columns > 12)
        throw new TypeError("columns must be an integer from 1 to 12.");
      const sections = normalize(this.ignore);
      const root = node("section", "app-collection");
      root.style.setProperty("--columns", this.columns);
      const nav = node("nav", "ac-nav"); nav.setAttribute("aria-label", this.labels.home);
      const backButton = button(this.labels.back, back);
      const homeButton = button(this.labels.home, () => { while (history.length) back(); });
      nav.append(backButton, homeButton);
      const heading = node("h1", "ac-heading"); heading.tabIndex = -1;
      const content = node("div", "ac-content");
      root.append(nav, heading, content); this.element.append(root);
      ui = { heading, content, back: backButton, home: homeButton };
      show("home", this.title, view => {
        if (this.description) view.append(node("p", "ac-description", this.description));
        for (const section of sections) {
          const area = node("section", "ac-section");
          if (section.title) area.append(node("h2", "ac-section-title", section.title));
          if (section.description) area.append(node("p", "ac-description", section.description));
          view.append(area); grid(section.items, area);
        }
      });
    };
  },
};

/** Normalize and validate before starting any child apps. */
export function normalize(ignore) {
  let count = 0;
  const items = (values, depth = 0) => {
    if (!Array.isArray(values)) throw new TypeError("items must be an array.");
    if (depth > 20) throw new TypeError("Folders may be nested at most 20 levels deep.");
    return values.map(value => {
      const item = Array.isArray(value) ? { app: value } : value;
      if (!item || typeof item !== "object") throw new TypeError("Invalid collection item.");
      const type = item.type || (item.items ? "folder" : "app");
      if (!["app", "folder", "widget"].includes(type)) throw new TypeError(`Unknown item type: ${type}`);
      const title = item.title || `${type === "folder" ? "Ordner" : "App"} ${++count}`;
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
    return { title: section.title, description: section.description, items: items(section.items) };
  });
}

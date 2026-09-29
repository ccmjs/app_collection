/** Personal state contains only names and item references, never executable app configuration. */
export function identify(sections) {
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
export function capture(sections) {
  const entry = item => ({ id: item.id, title: item.title || '', ...(item.items ? { items: item.items.map(entry) } : {}) });
  return { sections: sections.map(entry) };
}

/** Resolve state against the teacher's current template; ignore removed IDs and append new materials. */
export function resolve(template, state) {
  if (state == null) return template;
  if (!Array.isArray(state.sections)) throw new TypeError('state.sections must be an array.');
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

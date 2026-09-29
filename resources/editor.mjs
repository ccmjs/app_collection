/** Pointer and keyboard layout editing without rebuilding child apps. */
export class LayoutEditor {
  constructor(app, sections, root, toolbar) {
    Object.assign(this, { app, sections, root });
    this.grids = [];
    this.entries = new Map();
    this.names = [];
    this.active = false;
    this.busy = false;
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
  allLists() {
    const lists = [];
    const visit = items => { lists.push(items); for (const item of items) if (item.type === 'folder') visit(item.items); };
    this.sections.forEach(s => visit(s.items));
    return lists;
  }
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
  grid(items, el, view) {
    this.grids.push({ items, el, view });
    this.updateChoices();
  }
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
  endDrag() {
    const drag = this.drag; this.drag = null;
    cancelAnimationFrame(this.frame); this.clearTarget();
    drag?.ghost.remove();
    if (drag?.handle.hasPointerCapture(drag.id)) drag.handle.releasePointerCapture(drag.id);
  }
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
  destroy() {
    this.abort();
    if (this.app.user) this.app.user.extensions = [].concat(this.app.user.extensions || []).filter(fn => fn !== this.listener);
  }
}

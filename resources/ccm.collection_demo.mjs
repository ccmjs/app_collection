/** Small local demo apps. Replace these dependencies with your own components. */
export const component = {
  name: "collection_demo",
  ccm: "././libs/framework/ccm.js",
  config: { title: "Willkommen", text: "Diese App kannst du durch eine beliebige ccmjs-App ersetzen.", calendar: false },
  Instance: function () {
    this.start = async () => {
      const root = document.createElement("div");
      root.style.cssText = "font:16px/1.6 system-ui;color:#234353;padding:12px";
      const title = document.createElement("h2"); title.textContent = this.title;
      const text = document.createElement("p"); text.textContent = this.text;
      root.append(title, text);
      if (this.calendar) {
        for (const event of ["09:00 · Vorlesung · Raum A 201", "11:00 · Übungsgruppe · Raum B 104", "14:00 · Offene Sprechstunde · Online"]) {
          const line = document.createElement("p"); line.textContent = event;
          line.style.cssText = "padding:12px;border-left:3px solid #559b9a;background:#f1f7f7";
          root.append(line);
        }
      } else {
        const label = document.createElement("label"); label.textContent = "Deine Notizen ";
        const input = document.createElement("textarea"); input.setAttribute("aria-label", "Deine Notizen");
        input.style.cssText = "display:block;width:100%;min-height:120px;font:inherit";
        label.append(input); root.append(label);
      }
      this.element.replaceChildren(root);
    };
  },
};

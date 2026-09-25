# App Collection

Eine ccmjs-Komponente, die Apps als Kacheln, in Sektionen und Ordnern oder als eingebettete Widgets zusammenfasst. Geeignet für Kursportale und Unterstützungsangebote.

## Ausprobieren

Im Repository `python3 -m http.server 8765` starten und `http://localhost:8765` öffnen. Die Demo funktioniert ohne externe Dienste. Ihre Beispiel-Apps und der Stundenplan sind Platzhalter; echte Slidecast-, Quiz- oder Kalender-Komponenten werden über dieselben Abhängigkeiten eingebunden.

Die Beispielkonfiguration liegt in `resources/configs.mjs`. Die separate `resources/ccm.collection_demo.mjs` enthält ausschließlich die Platzhalter-Komponente.

## Einfachste Konfiguration

```js
await ccm.start('./ccm.app_collection.mjs', {
  title: 'Meine Lehrveranstaltung',
  ignore: [
    ['ccm.start', './apps/ccm.slidecast.mjs', { /* Slidecast-Konfiguration */ }],
    ['ccm.start', './apps/ccm.quiz.mjs', { /* Quiz-Konfiguration */ }],
  ],
}, document.querySelector('main'));
```

Das ccm-Framework muss zuvor geladen sein, etwa mit `<script src="./libs/framework/ccm.js"></script>`. Das mitgelieferte Framework ist ein lokaler Snapshot aus dem benachbarten `framework`-Repository; seine MIT-Lizenz liegt daneben.

## Sektionen, Ordner und Widgets

```js
const config = {
  title: 'Mein Kurs',
  description: 'Materialien und Termine',
  columns: 4,
  ignore: {
    sections: [
      {
        title: 'Kapitel 1',
        description: 'Grundlagen',
        items: [
          {
            title: 'Vorlesung', icon: '🎬', description: 'Folien und Audio',
            app: ['ccm.start', './apps/ccm.slidecast.mjs', { /* … */ }],
          },
          {
            title: 'Übungen', icon: './icons/exercises.svg',
            items: [
              { title: 'Quiz 1', app: ['ccm.start', './apps/ccm.quiz.mjs', { /* … */ }] },
              { title: 'Zusatzmaterial', items: [ /* weitere Apps oder Ordner */ ] },
            ],
          },
          {
            type: 'widget', title: 'Stundenplan', width: 2, height: 2,
            app: ['ccm.start', './apps/ccm.calendar.mjs', { /* … */ }],
          },
        ],
      },
    ],
  },
};
```

App- und Ordnerobjekte können auch direkt im `ignore`-Array stehen. Die Existenz von `items` kennzeichnet einen Ordner; `type: 'folder'` ist optional. Ordner können bis zu 20 Ebenen tief verschachtelt sein. Ohne Titel erhalten Einträge einen generierten Namen. `icon` akzeptiert Text/Emoji oder eine Bild-URL mit `https://`, `http://`, `./` oder `/` am Anfang. Titel und Beschreibungen werden als Text ausgegeben.

| Option | Bedeutung | Standard |
| --- | --- | --- |
| `columns` | Maximale Spaltenzahl (1–12) | `4` |
| `type` | `app`, `folder` oder `widget` | automatisch |
| `width` | Widget-Breite in Grid-Zellen (1–12) | `2` |
| `height` | Widget-Höhe in Grid-Zellen (1–12) | `2` |
| `labels` | Überschreibbare UI-Texte, siehe Komponente | Deutsch |
| `css` | ccm.load-Abhängigkeit für das Stylesheet | `resources/styles.css` |

Die Reihenfolge im Array bestimmt die Platzierung. Das Grid reduziert sich bei schmalem Container auf zwei bzw. eine Spalte; Widgets passen ihre Breite entsprechend an. Zeilen sind mindestens 156 px hoch und wachsen mit ihrem Inhalt. Breite und Höhe bezeichnen Zellspannen, keine festen Pixelmaße. Freie Koordinaten, Drag-and-drop und ein visueller Konfigurationseditor sind noch nicht enthalten.

## Verhalten und Lebenszyklus

- `ignore` verhindert, dass ccm die Kind-Apps vorzeitig auflöst.
- Kachel-Apps starten beim ersten Öffnen. Widgets starten beim ersten Anzeigen ihres Grids, auch innerhalb eines Ordners.
- Zurück und Übersicht wechseln zwischen den Ansichten. Bereits geöffnete Instanzen und Eingaben bleiben während der Sitzung erhalten. Es gibt keine automatische Speicherung über einen Seiten-Reload hinweg.
- Verdeckte Ansichten bleiben im DOM; ihre Apps sind weiterhin aktiv. Audio, Timer und Hintergrundarbeit werden nicht automatisch pausiert. Dafür benötigt die jeweilige App eine eigene Steuerung.
- Ladefehler betreffen nur die jeweilige App. Ein Wiederholen-Button ermöglicht einen neuen Versuch.
- `await instance.destroy()` wartet auf laufende Ladevorgänge, ruft vorhandene `destroy()`-Methoden der Kinder auf und entfernt deren Hosts. Apps müssen eigene Listener/Timer in ihrem `destroy()` freigeben. Ein nie endender Kind-Start kann auch das Aufräumen verzögern.
- `await instance.start()` baut die Collection neu auf und verwirft dabei bisherige Kind-Instanzen. Lebenszyklusaufrufe nacheinander abwarten.
- Tastaturbedienung erfolgt über native Buttons; beim Zurückgehen kehrt der Fokus auf die auslösende Kachel zurück.

Wie in den benachbarten Komponenten sind Ressourcenpfade auf die einbettende HTML-Seite bezogen. Bei Einbettung in andere Verzeichnisse insbesondere `css`, Framework-URL und Pfade der Kind-Apps passend konfigurieren. Zusätzliche Mount-Argumente einer `ccm.start`-Abhängigkeit werden durch den Mount innerhalb der Collection ersetzt.

## Prüfungen

`node --test tests/config.test.mjs` prüft Konfigurationsformen, verschachtelte Einträge, ungültige Abhängigkeiten, Größen und zyklische Ordner. `http://localhost:8765/tests/browser.html` prüft mit dem echten Framework verzögertes Starten, Zustandserhalt, Wiederholen nach Ladefehlern, Aufräumen bei laufenden Starts und Neustart. Ein absichtlich ausgelöster Ladefehler gehört zu diesem Test.

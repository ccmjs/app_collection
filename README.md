# App Collection

Eine ccmjs-Komponente, die Apps als Kacheln, in Sektionen und Ordnern oder als eingebettete Widgets zusammenfasst. Geeignet für Kursportale und Unterstützungsangebote.

## Ausprobieren

Im Repository `python3 -m http.server 8765` starten und `http://localhost:8765` öffnen. Die englische Demo verwendet lokale Kopien von Slidecast, PDF-Viewer und Quiz. Sie zeigt ein Quiz als Widget, PDF-Dokumente, verschachtelte Ordner und einen Slidecast mit Audio und eingebettetem Quiz.

Die Beispielkonfiguration liegt in `resources/configs.mjs`. Unter `libs` liegen die Komponenten, ihre Ressourcen und Lizenzen, einschließlich User, Google-Login, ccm-ui und PDF.js. Es gibt keine zusätzliche Demo-Komponente mehr. Die Lerninhalte funktionieren ohne Server; für die tatsächliche Anmeldung wird ein ccm-Server benötigt.

## Gemeinsamer Login

Die optionale Eigenschaft `user` enthält eine `ccm.instance`-Abhängigkeit zur User-Komponente. App Collection hängt deren Host oben rechts ein und ruft danach `start()` auf. Der Bereich bleibt auch in Ordnern und geöffneten Apps sichtbar. `autoLogin: true` wartet vor dem Anzeigen der Inhalte auf die Anmeldung. Ohne `user` oder mit `user: null` entfällt der Bereich.

Die Demo konfiguriert die Server-URL und den Realm zentral in `authentication` in `resources/configs.mjs`. Standard ist `http://localhost:8080`, Realm `ccm`. Ihre Quiz-Apps besitzen jeweils eine eigene User-Instanz mit denselben Werten. Die User-Komponente findet über die Elternkette den gemeinsamen Sitzungsinhaber: Login, Logout, Status und Token werden an ihn delegiert; zusätzliche Login-Oberflächen bleiben leer. Das gilt auch für das Quiz innerhalb des Slidecasts. Apps können den Kontext außerdem über `this.ccm.helper.findInAncestors(this, "user")` lesen. Den Host der übergeordneten User-Instanz nicht in eine Unter-App verschieben.

Google-Login wird lokal aus `libs/google_login` geladen. Das Popup nutzt weiterhin die in der Komponente konfigurierte gehostete Callback-Seite. Für einen eigenen Einsatz müssen Google-Client-ID, erlaubte Callback-Origin und die Konfiguration des ccm-Servers zusammenpassen; eine lokale Callback-Kopie liegt unter `libs/google_login/auth.html`. Der gemeinsame Login allein speichert noch keine Quiz-Ergebnisse und ersetzt keine Berechtigungsprüfung auf dem Server.

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

`http://localhost:8765/tests/user.html` prüft den gemeinsamen Sitzungsinhaber, das Weiterreichen von Ereignissen, den dauerhaften Login-Bereich, Ordner-Apps und den lokalen Google-Provider ohne echte Anmeldung.

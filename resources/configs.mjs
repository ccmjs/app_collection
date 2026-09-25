/** Example configuration for the App Collection demo. */
export const config = {
  title: "Mein Campus",
  description: "Informatik · Wintersemester 2026/27",
  ignore: {
    sections: [
      {
        title: "Deine Woche",
        description: "Deine persönlichen Termine und Aufgaben",
        items: [
          {
            type: "widget", title: "Stundenplan", width: 2, height: 2,
            app: ["ccm.start", "./resources/ccm.collection_demo.mjs", {
              title: "Montag",
              text: "Deine nächsten Veranstaltungen",
              calendar: true
            }]
          },
          {
            title: "Kursinformationen", icon: "📌", description: "Gut vorbereitet starten",
            app: ["ccm.start", "./resources/ccm.collection_demo.mjs", {title: "Kursinformationen"}]
          },
          {
            title: "Unterstützung", icon: "🤝", items: [
              {
                title: "Studienberatung",
                icon: "💬",
                app: ["ccm.start", "./resources/ccm.collection_demo.mjs", {title: "Studienberatung"}]
              },
              {
                title: "Lernangebote", icon: "📚", items: [
                  {
                    title: "Lerngruppe",
                    app: ["ccm.start", "./resources/ccm.collection_demo.mjs", {title: "Lerngruppe"}]
                  },
                ]
              },
            ]
          },
        ]
      },
      {
        title: "Kapitel 1 · Grundlagen", description: "Vorlesung entdecken und das Gelernte vertiefen.", items: [
          {
            title: "Vorlesung", icon: "🎬", description: "Folien & Audio",
            app: ["ccm.start", "./resources/ccm.collection_demo.mjs", {
              title: "Vorlesung",
              text: "Hier kann deine Slidecast-App erscheinen."
            }]
          },
          {
            title: "Übungsaufgaben", icon: "✏️", description: "Wissen anwenden",
            app: ["ccm.start", "./resources/ccm.collection_demo.mjs", {
              title: "Übungsaufgaben",
              text: "Hier kann deine Quiz-App erscheinen."
            }]
          },
          {
            title: "Materialien", icon: "📁", items: [
              {
                title: "Literatur",
                icon: "📖",
                app: ["ccm.start", "./resources/ccm.collection_demo.mjs", {title: "Literatur"}]
              },
            ]
          },
        ]
      },
    ]
  },
};

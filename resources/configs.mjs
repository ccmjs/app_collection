export const demo = {
  editable: true,
  extensions: [['ccm.load', '././resources/extensions.mjs#store']],
  layouts: {
    key: 'web_technologies',
    store: ['ccm.store', { name: 'app_collection_layouts', url: 'http://localhost:8080' }],
  },
  ccm: '././libs/framework/ccm-28.0.0.min.js',
  css: ['ccm.load', '././resources/styles-hbrs.css'],
  title: 'My Campus',
  description: 'Web technologies · Course materials and lectures',
  labels: {
    back: 'Back', home: 'Overview', loading: 'Loading …', retry: 'Try again',
    error: 'The app could not be loaded.', empty: 'No apps have been added yet.', folder: 'Folder',
  },
  // Use ccm.instance: App Collection mounts the user host before starting it.
  // Remove user (or set it to null) for a collection without an account area.
  user: ['ccm.instance', '././libs/user/ccm.user-1.0.0.min.mjs', {
    ccm: '././libs/framework/ccm-28.0.0.min.js',
    url: 'http://localhost:8080',
    realm: 'ccm',
    ui: ['ccm.load', '././libs/ccm-ui/ccm-ui-1.0.0.min.mjs'],
    providers: [['ccm.instance', 'https://cdn.jsdelivr.net/gh/ccmjs/google_login@v1.0.1/ccm.google_login-1.0.1.min.mjs', {
      ccm: '././libs/framework/ccm-28.0.0.min.js',
      server: 'http://localhost:8080',
      realm: 'ccm',
      ui: ['ccm.load', '././libs/ccm-ui/ccm-ui-1.0.0.min.mjs'],
      views: ['ccm.load', 'https://cdn.jsdelivr.net/gh/ccmjs/google_login@v1.0.1/resources/views.mjs'],
      css: ['ccm.load', 'https://cdn.jsdelivr.net/gh/ccmjs/google_login@v1.0.1/resources/styles.css'],
      // Keep the hosted callback whose origin is registered for the provider's public client ID.
      url: 'https://ccmjs.github.io/google_login/auth.html',
    }]],
  }],
  ignore: { sections: [
    { id: 'start', title: 'Start here', description: 'Everything you need for your first session.', items: [
      { type: 'widget', id: 'preview', title: 'Document preview', width: 2, height: 2, app: ['ccm.start', 'https://cdn.jsdelivr.net/gh/ccmjs/pdf_viewer@v1.0.0/ccm.pdf_viewer-1.0.0.min.mjs', ['ccm.load', '././resources/configs.mjs#pdf']] },
      { id: 'handbook', title: 'Course handbook', icon: '📖', description: 'Read, search visually and download', app: ['ccm.start', 'https://cdn.jsdelivr.net/gh/ccmjs/pdf_viewer@v1.0.0/ccm.pdf_viewer-1.0.0.min.mjs', ['ccm.load', '././resources/configs.mjs#pdf']] },
      { id: 'resources', title: 'Study resources', icon: '📁', items: [
        { id: 'reference', title: 'Reference document', icon: '📄', app: ['ccm.start', 'https://cdn.jsdelivr.net/gh/ccmjs/pdf_viewer@v1.0.0/ccm.pdf_viewer-1.0.0.min.mjs', ['ccm.load', '././resources/configs.mjs#pdf']] },
        { id: 'reading', title: 'Further reading', icon: '📚', items: [
          { id: 'fundamentals', title: 'Web fundamentals', icon: '📄', app: ['ccm.start', 'https://cdn.jsdelivr.net/gh/ccmjs/pdf_viewer@v1.0.0/ccm.pdf_viewer-1.0.0.min.mjs', ['ccm.load', '././resources/configs.mjs#pdf']] },
        ] },
      ] },
    ] },
    { id: 'chapter-1', title: 'Chapter 1 · Web fundamentals', description: 'Follow the lecture and explore the accompanying documents.', items: [
      { id: 'lecture', title: 'Lecture', icon: '🎬', description: 'Slides and audio',
        app: ['ccm.start', 'https://cdn.jsdelivr.net/gh/ccmjs/slidecast@v1.0.0/ccm.slidecast-1.0.0.min.mjs', ['ccm.load', '././resources/configs.mjs#slidecast']] },
      { id: 'slides', title: 'Lecture slides', icon: '📑', description: 'Open the PDF directly', app: ['ccm.start', 'https://cdn.jsdelivr.net/gh/ccmjs/pdf_viewer@v1.0.0/ccm.pdf_viewer-1.0.0.min.mjs', ['ccm.load', '././resources/configs.mjs#pdf']] },
    ] },
  ] },
};

/** Shared PDF configuration, loaded when a document app starts. */
export const pdf = {
  ccm: '././libs/framework/ccm-28.0.0.min.js',
  config: ['ccm.load', 'https://cdn.jsdelivr.net/gh/ccmjs/pdf_viewer@v1.0.0/resources/configs.mjs#demo'],
  pdf: 'https://cdn.jsdelivr.net/gh/ccmjs/pdf_viewer@v1.0.0/resources/demo.pdf',
  pdfjs: ['ccm.load', 'https://cdn.jsdelivr.net/gh/ccmjs/pdf_viewer@v1.0.0/libs/pdfjs/pdf.min.mjs'],
  css: ['ccm.load', 'https://cdn.jsdelivr.net/gh/ccmjs/pdf_viewer@v1.0.0/libs/pdfjs/pdf_viewer.css', 'https://cdn.jsdelivr.net/gh/ccmjs/pdf_viewer@v1.0.0/resources/styles.css'],
  worker: 'https://cdn.jsdelivr.net/gh/ccmjs/pdf_viewer@v1.0.0/libs/pdfjs/pdf.worker.min.mjs',
  cMaps: 'https://cdn.jsdelivr.net/gh/ccmjs/pdf_viewer@v1.0.0/libs/pdfjs/cmaps/',
  fonts: 'https://cdn.jsdelivr.net/gh/ccmjs/pdf_viewer@v1.0.0/libs/pdfjs/standard_fonts/',
  wasm: 'https://cdn.jsdelivr.net/gh/ccmjs/pdf_viewer@v1.0.0/libs/pdfjs/wasm/',
};

/** Lecture configuration, loaded when the lecture app starts. */
export const slidecast = {
  ccm: '././libs/framework/ccm-28.0.0.min.js',
  css: ['ccm.load', 'https://cdn.jsdelivr.net/gh/ccmjs/slidecast@v1.0.0/resources/styles.css'],
  pdf: pdf.pdf,
  pdf_viewer: ['ccm.component', 'https://cdn.jsdelivr.net/gh/ccmjs/pdf_viewer@v1.0.0/ccm.pdf_viewer-1.0.0.min.mjs', pdf],
  viewer: { labels: ['ccm.load', 'https://cdn.jsdelivr.net/gh/ccmjs/pdf_viewer@v1.0.0/resources/configs.mjs#demo.labels'] },
  autoplay: false,
  labels: {
    navigation: 'Slidecast navigation', previous: 'Previous', next: 'Next', step: 'Step', of: 'of',
    slide: 'Slide', audio: 'Slide audio', comments: 'Slide comments',
    commentsPlaceholder: 'Commenting will be added later.',
    missingLinkTarget: 'The linked PDF page is not part of this slidecast.',
    error: 'The slidecast could not be displayed: ', pdfNotOpened: 'The PDF was not opened.',
  },
  ignore: { slides: [
    { page: 1, description: '<h2>Welcome to the course</h2><p>Explore the slides and accompanying materials.</p>',
      audio: 'https://cdn.jsdelivr.net/gh/ccmjs/slidecast@v1.0.0/resources/welcome.mp3' },
    { page: 2, description: '<p>Try selecting text or following a link in the document.</p>' },
    { page: 3, description: '<p>You have reached the end of this introduction.</p>' },
  ] },
};

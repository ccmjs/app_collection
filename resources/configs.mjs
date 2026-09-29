/** English demo using local core releases and external demo apps. Resource URLs are independent of the embedding page. */
import { demo as pdfDemo } from 'https://cdn.jsdelivr.net/gh/ccmjs/pdf_viewer@v1.0.0/resources/configs.mjs';
const url = path => new URL(path, import.meta.url).href;
const load = path => ['ccm.load', url(path)];
const ccm = url('../libs/framework/ccm-28.0.0.min.js');
const ui = load('../libs/ccm-ui/ccm-ui-1.0.0.min.mjs');

/** Change these together so descendant user instances join the collection's session. */
export const authentication = {
  ccm,
  url: 'http://localhost:8080',
  realm: 'ccm',
  ui,
};
const pdf = {
  ccm,
  ...pdfDemo,
  pdf: url('https://cdn.jsdelivr.net/gh/ccmjs/pdf_viewer@v1.0.0/resources/demo.pdf'),
  pdfjs: load('https://cdn.jsdelivr.net/gh/ccmjs/pdf_viewer@v1.0.0/libs/pdfjs/pdf.min.mjs'),
  css: ['ccm.load', url('https://cdn.jsdelivr.net/gh/ccmjs/pdf_viewer@v1.0.0/libs/pdfjs/pdf_viewer.css'), url('https://cdn.jsdelivr.net/gh/ccmjs/pdf_viewer@v1.0.0/resources/styles.css')],
  worker: url('https://cdn.jsdelivr.net/gh/ccmjs/pdf_viewer@v1.0.0/libs/pdfjs/pdf.worker.min.mjs'),
  cMaps: url('https://cdn.jsdelivr.net/gh/ccmjs/pdf_viewer@v1.0.0/libs/pdfjs/cmaps/'),
  fonts: url('https://cdn.jsdelivr.net/gh/ccmjs/pdf_viewer@v1.0.0/libs/pdfjs/standard_fonts/'),
  wasm: url('https://cdn.jsdelivr.net/gh/ccmjs/pdf_viewer@v1.0.0/libs/pdfjs/wasm/'),
};
const pdfApp = () => ['ccm.start', url('https://cdn.jsdelivr.net/gh/ccmjs/pdf_viewer@v1.0.0/ccm.pdf_viewer-1.0.0.min.mjs'), pdf];
const slidecast = {
  ccm,
  css: load('https://cdn.jsdelivr.net/gh/ccmjs/slidecast@v1.0.0/resources/styles.css'),
  pdf: pdf.pdf,
  pdf_viewer: ['ccm.component', url('https://cdn.jsdelivr.net/gh/ccmjs/pdf_viewer@v1.0.0/ccm.pdf_viewer-1.0.0.min.mjs'), pdf],
  viewer: { labels: pdfDemo.labels },
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
      audio: url('https://cdn.jsdelivr.net/gh/ccmjs/slidecast@v1.0.0/resources/welcome.mp3') },
    { page: 2, description: '<p>Try selecting text or following a link in the document.</p>' },
    { page: 3, description: '<p>You have reached the end of this introduction.</p>' },
  ] },
};

export const demo = {
  ccm,
  css: load('./styles.css'),
  title: 'My Campus',
  description: 'Web technologies · Course materials and lectures',
  labels: {
    back: 'Back', home: 'Overview', loading: 'Loading …', retry: 'Try again',
    error: 'The app could not be loaded.', empty: 'No apps have been added yet.', folder: 'Folder',
  },
  // Use ccm.instance: App Collection mounts the user host before starting it.
  // Remove user (or set it to null) for a collection without an account area.
  user: ['ccm.instance', url('../libs/user/ccm.user-1.0.0.min.mjs'), {
    ...authentication,
    providers: [['ccm.instance', url('https://cdn.jsdelivr.net/gh/ccmjs/google_login@v1.0.1/ccm.google_login-1.0.1.min.mjs'), {
      ccm,
      server: authentication.url,
      realm: authentication.realm,
      ui,
      views: load('https://cdn.jsdelivr.net/gh/ccmjs/google_login@v1.0.1/resources/views.mjs'),
      css: load('https://cdn.jsdelivr.net/gh/ccmjs/google_login@v1.0.1/resources/styles.css'),
      // Keep the hosted callback whose origin is registered for the provider's public client ID.
      url: 'https://ccmjs.github.io/google_login/auth.html',
    }]],
  }],
  ignore: { sections: [
    { title: 'Start here', description: 'Everything you need for your first session.', items: [
      { type: 'widget', title: 'Document preview', width: 2, height: 2, app: pdfApp() },
      { title: 'Course handbook', icon: '📖', description: 'Read, search visually and download', app: pdfApp() },
      { title: 'Study resources', icon: '📁', items: [
        { title: 'Reference document', icon: '📄', app: pdfApp() },
        { title: 'Further reading', icon: '📚', items: [
          { title: 'Web fundamentals', icon: '📄', app: pdfApp() },
        ] },
      ] },
    ] },
    { title: 'Chapter 1 · Web fundamentals', description: 'Follow the lecture and explore the accompanying documents.', items: [
      { title: 'Lecture', icon: '🎬', description: 'Slides and audio',
        app: ['ccm.start', url('https://cdn.jsdelivr.net/gh/ccmjs/slidecast@v1.0.0/ccm.slidecast-1.0.0.min.mjs'), slidecast] },
      { title: 'Lecture slides', icon: '📑', description: 'Open the PDF directly', app: pdfApp() },
    ] },
  ] },
};

/** English demo using local component snapshots. Resource URLs are independent of the embedding page. */
import { demo as pdfDemo } from '../libs/pdf_viewer/resources/configs.mjs';
const url = path => new URL(path, import.meta.url).href;
const load = path => ['ccm.load', url(path)];
const ccm = url('../libs/framework/ccm.js');
const ui = load('../libs/ccm-ui/ccm-ui.mjs');

/** Change these together so descendant user instances join the collection's session. */
export const authentication = {
  ccm,
  url: 'http://localhost:8080',
  realm: 'ccm',
  ui,
  views: load('../libs/user/resources/views.mjs'),
  css: load('../libs/user/resources/styles.css'),
};
const user = () => ['ccm.instance', url('../libs/user/ccm.user.mjs'), { ...authentication }];

const pdf = {
  ccm,
  ...pdfDemo,
  pdf: url('../libs/pdf_viewer/resources/demo.pdf'),
  pdfjs: load('../libs/pdf_viewer/libs/pdfjs/pdf.min.mjs'),
  css: ['ccm.load', url('../libs/pdf_viewer/libs/pdfjs/pdf_viewer.css'), url('../libs/pdf_viewer/resources/styles.css')],
  worker: url('../libs/pdf_viewer/libs/pdfjs/pdf.worker.min.mjs'),
  cMaps: url('../libs/pdf_viewer/libs/pdfjs/cmaps/'),
  fonts: url('../libs/pdf_viewer/libs/pdfjs/standard_fonts/'),
  wasm: url('../libs/pdf_viewer/libs/pdfjs/wasm/'),
};
const quiz = {
  ccm,
  ui,
  views: load('../libs/quiz/resources/views.mjs'),
  css: load('../libs/quiz/resources/styles.css'),
  user: user(),
  extensions: [
    ['ccm.load', url('../libs/quiz/resources/extensions.mjs') + '#analytics'],
    ['ccm.load', url('../libs/quiz/resources/extensions.mjs') + '#restart'],
  ],
  questions: [
    { key: 'html', text: 'What is HTML used for?', type: 'radio', answers: [
      { text: 'Structuring content on the web', correct: true },
      { text: 'Styling the appearance of a page' },
      { text: 'Storing passwords securely' },
    ] },
    { key: 'css', text: 'Which tasks can CSS help with?', type: 'checkbox', answers: [
      { text: 'Arranging content in a grid', correct: true },
      { text: 'Adapting layouts to smaller screens', correct: true },
      { text: 'Verifying a user’s password on the server' },
    ] },
  ],
};
const quizApp = () => ['ccm.start', url('../libs/quiz/ccm.quiz.mjs'), quiz];
const pdfApp = () => ['ccm.start', url('../libs/pdf_viewer/ccm.pdf_viewer.mjs'), pdf];
const slidecast = {
  ccm,
  css: load('../libs/slidecast/resources/styles.css'),
  pdf: pdf.pdf,
  pdf_viewer: ['ccm.component', url('../libs/pdf_viewer/ccm.pdf_viewer.mjs'), pdf],
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
    { page: 1, description: '<h2>Welcome to the course</h2><p>Explore the slides, then test your knowledge.</p>',
      audio: url('../libs/slidecast/resources/welcome.mp3') },
    { page: 2, description: '<p>Try selecting text or following a link in the document.</p>' },
    { app: quizApp() },
    { page: 3, description: '<p>You have reached the end of this introduction.</p>' },
  ] },
};

export const config = {
  ccm,
  css: load('./styles.css'),
  title: 'My Campus',
  description: 'Web technologies · Course materials and practice',
  labels: {
    back: 'Back', home: 'Overview', loading: 'Loading …', retry: 'Try again',
    error: 'The app could not be loaded.', empty: 'No apps have been added yet.', folder: 'Folder',
  },
  // Use ccm.instance: App Collection mounts the user host before starting it.
  // Remove user (or set it to null) for a collection without an account area.
  user: ['ccm.instance', url('../libs/user/ccm.user.mjs'), {
    ...authentication,
    providers: [['ccm.instance', url('../libs/google_login/ccm.google_login.mjs'), {
      ccm,
      server: authentication.url,
      realm: authentication.realm,
      ui,
      views: load('../libs/google_login/resources/views.mjs'),
      css: load('../libs/google_login/resources/styles.css'),
      // Keep the hosted callback whose origin is registered for the provider's public client ID.
      url: 'https://ccmjs.github.io/google_login/auth.html',
    }]],
  }],
  ignore: { sections: [
    { title: 'Start here', description: 'A quick exercise and everything you need for your first session.', items: [
      { type: 'widget', title: 'Knowledge check', width: 2, height: 2, app: quizApp() },
      { title: 'Course handbook', icon: '📖', description: 'Read, search visually and download', app: pdfApp() },
      { title: 'Study resources', icon: '📁', items: [
        { title: 'Reference document', icon: '📄', app: pdfApp() },
        { title: 'Practice', icon: '✏️', items: [
          { title: 'Web fundamentals', icon: '🧩', app: quizApp() },
        ] },
      ] },
    ] },
    { title: 'Chapter 1 · Web fundamentals', description: 'Follow the lecture and put your knowledge into practice.', items: [
      { title: 'Lecture', icon: '🎬', description: 'Slides, audio and an embedded quiz',
        app: ['ccm.start', url('../libs/slidecast/ccm.slidecast.mjs'), slidecast] },
      { title: 'Exercises', icon: '✏️', description: 'Practice with instant feedback', app: quizApp() },
      { title: 'Lecture slides', icon: '📑', description: 'Open the PDF directly', app: pdfApp() },
    ] },
  ] },
};

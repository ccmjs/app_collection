# App Collection

A ccmjs component that brings apps together as tiles, sections, folders and embedded widgets. Suitable for course portals and student support resources.

## Getting started

Run `python3 -m http.server 8765` in the repository and open `http://localhost:8765`. The English demo uses externally loaded Slidecast and PDF Viewer apps. It includes a PDF widget, documents, nested folders and a slidecast with audio.

The demo configuration is exported as `demo` from `resources/configs.mjs`. The `libs` directory contains only fixed, minified releases with source maps and licenses:

- ccm-ui **1.0.0**
- CCM Framework **28.0.0**
- User **1.0.0**

These files are unchanged copies of the releases bundled in the User and Quiz repositories. User loads its resources from CDN URLs pinned to **v1.0.0**. When updating a dependency, replace its versioned file, source map, license and references together.

The demo loads Slidecast **1.0.0**, PDF Viewer **1.0.0**, Google Login **1.0.1** and their resources externally. Quiz is not included in the demo until a published release is available. The demo, including the sign-in interface, requires an internet connection. Actual authentication also requires a ccm-server. There is no additional demo component.

## Shared authentication

The optional `user` property accepts a `ccm.instance` dependency for the User component. App Collection mounts its host in the top-right corner before calling `start()`. The account area remains visible inside folders and open apps. With `autoLogin: true`, the collection waits for sign-in before displaying its content. Omit `user` or set it to `null` to hide the account area.

The demo configures the server URL and realm centrally in `authentication` in `resources/configs.mjs`. Defaults are `http://localhost:8080` and realm `ccm`. Child apps can configure their own User instances with the same values. The User component follows the parent chain to find the shared session owner: sign-in, sign-out, status and token access are delegated to that owner, while child sign-in interfaces remain empty. This also works for deeply nested apps. Apps can access the context using `this.ccm.helper.findInAncestors(this, "user")`. Do not move the parent User instance's host into a child app.

Google Login is loaded from the fixed **1.0.1** CDN release. Its popup uses the hosted callback page configured in the component. For your own deployment, the Google client ID, allowed callback origin and ccm-server configuration must match. Shared authentication does not automatically save app results or replace server-side authorization.

## Minimal configuration

```js
await ccm.start('./ccm.app_collection.mjs', {
  title: 'My course',
  ignore: [
    ['ccm.start', './apps/ccm.slidecast.mjs', { /* Slidecast configuration */ }],
    ['ccm.start', './apps/ccm.pdf_viewer.mjs', { /* PDF Viewer configuration */ }],
  ],
}, document.querySelector('main'));
```

Load the framework first, for example with `<script src="./libs/framework/ccm-28.0.0.min.js"></script>`. The bundled framework is release **28.0.0**; its MIT license is included alongside it. The example app paths refer to components provided by your own deployment.

## Sections, folders and widgets

```js
const config = {
  title: 'My course',
  description: 'Materials and schedule',
  columns: 4,
  ignore: {
    sections: [
      {
        title: 'Chapter 1',
        description: 'Fundamentals',
        items: [
          {
            title: 'Lecture', icon: '🎬', description: 'Slides and audio',
            app: ['ccm.start', './apps/ccm.slidecast.mjs', { /* … */ }],
          },
          {
            title: 'Reading', icon: './icons/reading.svg',
            items: [
              { title: 'Handbook', app: ['ccm.start', './apps/ccm.pdf_viewer.mjs', { /* … */ }] },
              { title: 'Additional materials', items: [ /* more apps or folders */ ] },
            ],
          },
          {
            type: 'widget', title: 'Schedule', width: 2, height: 2,
            app: ['ccm.start', './apps/ccm.calendar.mjs', { /* … */ }],
          },
        ],
      },
    ],
  },
};
```

App and folder objects can also appear directly in the `ignore` array. An `items` property identifies a folder; `type: 'folder'` is optional. Folders can be nested up to 20 levels deep. Entries without titles receive generated names such as `App 1` or `Folder 1`. `icon` accepts text, emoji or an image URL starting with `https://`, `http://`, `./` or `/`. Titles and descriptions are rendered as plain text.

| Option | Description | Default |
| --- | --- | --- |
| `title` | Collection title | `My Apps` |
| `description` | Introductory text | `Everything in one place.` |
| `columns` | Maximum number of columns (1–12) | `4` |
| `type` | `app`, `folder` or `widget` | inferred |
| `width` | Widget width in grid cells (1–12) | `2` |
| `height` | Widget height in grid cells (1–12) | `2` |
| `labels` | Customizable interface text; see the component | English |
| `css` | ccm.load dependency for the stylesheet | `resources/styles.css` |

Array order determines placement. The grid switches to two or one column in narrow containers, and widgets adjust their width accordingly. Rows are at least 156 px tall and grow with their content. Width and height specify cell spans, not fixed pixel dimensions. Explicit coordinates and creating or deleting apps in the interface are not included.

## Editing the layout

Set `editable: true` and configure a `user` instance to enable editing for signed-in users. The demo enables this option. Signed-out users and collections without a User instance cannot edit.

Choose **Edit layout** to rename sections and rearrange app tiles, folders and widgets. Drag the dedicated handle with a mouse, pen or touch contact. Pointer Events and pointer capture provide a shared interaction model; touch scrolling remains available outside the handles. The page scrolls near its edges while dragging. Drop before an item or at the end of a grid. Items can move between sections on the current view. Inside a folder, items can be reordered; moving into or out of folders is not currently supported.

For keyboard use, focus a handle and press an arrow key to move one position backward or forward. The adjacent menu moves an item to another section. **Done** applies changes, while **Cancel** restores the layout from the start of editing. Signing out or switching accounts cancels unfinished edits. Child app instances are preserved when their tiles move.

### Teacher template and personal state

`ignore` is the teacher's shared template and is never modified by the editor. `instance.state` contains the active user's names and ordering, separate from app dependencies and configuration:

```js
{
  sections: [{
    id: 'chapter-1',
    title: 'My revision notes',
    items: [
      { id: 'slides', title: 'Read before class' },
      { id: 'lecture', title: 'Lecture recording' },
    ],
  }],
}
```

Add stable, unique `id` values to sections, folders and apps in `ignore`. Keep IDs unchanged when updating course materials. The demo includes explicit IDs. Without IDs, the component generates IDs from the original position; these are suitable only while the template structure stays unchanged. Personal state can reference known materials and override their titles, but cannot replace their dependencies. New materials are appended in their original section or folder; references to removed materials are ignored.

App, folder and widget names can be changed in edit mode, as well as section names. Changes update `state` immediately. Done confirms the state; Cancel restores the state from the beginning of editing. `getLayout()` returns an independent copy of the personal state. A same-user `start()` reuses it. Switching accounts loads that account's state and recreates child apps; logging out returns to the teacher template. Unconfirmed edits are discarded on an account switch.

Confirmed states are cached separately per server URL, realm and user key in the running collection. A fresh instance or page reload needs a persistence integration. Configure `onlayoutload` and `onlayoutchange` to load and save personal states in your application:

```js
{
  editable: true,
  user: ['ccm.instance', './libs/user/ccm.user-1.0.0.min.mjs', { /* authentication */ }],
  onlayoutload: async ({ app, user }) => {
    // Return the saved personal state for this course and user, or null for the template.
    return null;
  },
  onlayoutchange: async ({ app, state, user }) => {
    // Save state using a stable course key plus user.realm and user.key.
    // Throw on failure to keep the editor open for retry or cancellation.
  },
}
```

`onlayoutload` runs on the first visit by each signed-in account within an instance. A loading failure shows a retry action and does not silently replace the personal state with defaults. The optional initial `state` belongs to the account active on first start. Restore saved layouts through `state`, not `ignore`. For compatibility, the save callback also receives `layout` as an alias of the state snapshot.

The demo currently uses the per-instance cache, without permanent server storage. A server-backed integration must authorize writes and identify both the course and the account. If an account changes during an asynchronous load or save, the response cannot change the new account's active layout. A persistence request already sent still belongs to the user captured when saving. UI labels, including editor labels, are configurable through `labels`.

## Behavior and lifecycle

- `ignore` prevents ccm from resolving child apps prematurely.
- Tile apps start when first opened. Widgets start when their grid is first displayed, including inside folders.
- Back and Overview switch between views. Open instances and input values are preserved during the session. They are not automatically saved across page reloads.
- Hidden views remain in the DOM, and their apps remain active. Audio, timers and background work are not automatically paused; each app needs its own controls for this.
- Loading errors affect only the relevant app. A Try again button allows another attempt.
- `await instance.destroy()` waits for pending loads, calls available child `destroy()` methods and removes their hosts. Apps must release their own listeners and timers in `destroy()`. A child start that never settles can delay cleanup.
- `await instance.start()` rebuilds the collection from the current state and discards existing child instances. Await lifecycle calls sequentially.
- Native buttons provide keyboard navigation. Going back restores focus to the tile that opened the view.

Component resource paths are relative to the embedding HTML page. When embedding from another directory, adjust `css`, the framework URL and child app paths accordingly. Additional mount arguments in a `ccm.start` dependency are replaced by the mount point inside the collection.

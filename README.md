# BookWords

BookWords is a personal English vocabulary app for words collected from books.

It works as a static Progressive Web App:

- folders for books;
- word cards with generated visual associations;
- tests for translation, spelling, and listening;
- daily progress and streak stars;
- export and import backups.

## Run Locally

Open the project folder and start the local server:

```powershell
node server.cjs
```

Then open:

```text
http://127.0.0.1:5176/
```

## Publish

The app can be published with GitHub Pages from the repository root.

## BIM Academy (second app in this repository)

The `bim/` folder holds a separate mobile app (PWA) for learning BIM/ТИМ, Revit,
Navisworks, AutoCAD and Civil 3D: lessons with vector diagrams, quizzes with
mistake review, a glossary, video collections, hotkey cheat sheets and offline
support. See [bim/README.md](bim/README.md).

- Published: https://big-arch.github.io/bookwords-app/bim/
- Locally: `node server.cjs`, then http://127.0.0.1:5176/bim/index.html

Both apps are independent: they use separate files, caches and local storage keys.

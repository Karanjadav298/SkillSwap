# SkillSwap — Share Skills. Grow Together.

A student-to-student skill exchange project built with React and Vite. Students can offer skills, post learning goals, discover peers, and manage exchange requests.

## Run locally

1. Install [Node.js](https://nodejs.org/) if it is not already installed.
2. In this folder, install dependencies:

   ```sh
   npm install
   ```

3. Start the development server:

   ```sh
   npm run dev
   ```

4. Open the local URL printed by Vite (usually `http://localhost:5173`).

To create and preview a production build:

```sh
npm run build
npm run preview
```

## Explore the project

- Choose **Continue as demo student** on the login screen to inspect the sample workspace.
- Register a new profile to try the account flow.
- Sample profiles, skills, learning requests, and exchange history are included to demonstrate the app. Displayed counts are calculated from the records stored in the browser.
- The app saves profiles, listings, learning requests, and exchanges in browser `localStorage`; data is not shared between browsers or devices.

## Project structure

```text
src/
  components/
    Icon.jsx       Reusable SVG icon component
  App.jsx          Pages, forms, navigation, and skill-exchange workflows
  data.js          Categories and initial demonstration records
  main.jsx         React application entry point
  storage.js       Browser persistence and password hashing helpers
  styles.css       Responsive application styles
index.html         Vite HTML entry point and page metadata
package.json       Dependencies and development scripts
```

This is a local college-project prototype, not a production identity or messaging service. Use fictional data when demonstrating it on a shared device.

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#2563eb',
        accent: '#f59e0b',
        // "GridMate" theme (dashboards/marketplace/trade-history/admin) —
        // exact RGB values as specified, distinct from `primary`/`accent`
        // above so Login/Register/modals (already approved) stay untouched.
        teal: '#009687',
        'teal-dark': '#00786a',
        'brand-green': '#4caf50',
        'brand-blue': '#2196f3',
      }
    },
  },
  plugins: [],
}

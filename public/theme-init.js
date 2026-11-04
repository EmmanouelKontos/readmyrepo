// Applies the saved light/dark choice before first paint (kept external so the CSP can forbid inline scripts).
try {
  document.querySelector('meta[name="color-scheme"]').content = localStorage.getItem('color-scheme') ?? 'light dark';
} catch (e) {}

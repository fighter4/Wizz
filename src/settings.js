document.addEventListener('DOMContentLoaded', async () => {
  const themeSelect = document.getElementById('theme-select');

  // Load the saved theme and update the dropdown
  const savedTheme = await window.electronAPI.getSetting('theme');
  if (savedTheme) {
    themeSelect.value = savedTheme;
  }

  // Listen for changes and save the new theme
  themeSelect.addEventListener('change', (event) => {
    const newTheme = event.target.value;
    window.electronAPI.setSetting('theme', newTheme);
    window.electronAPI.themeUpdated(newTheme);
  });
});

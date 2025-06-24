import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

self.MonacoEnvironment = {
  getWorker(_, label) {
    if (label === 'json') return new jsonWorker();
    if (label === 'css' || label === 'scss' || label === 'less') return new cssWorker();
    if (label === 'html' || label === 'handlebars' || label === 'razor') return new htmlWorker();
    if (label === 'typescript' || label === 'javascript') return new tsWorker();
    return new editorWorker();
  },
};

import * as monaco from 'monaco-editor';
import { GoogleGenerativeAI } from '@google/generative-ai';

// --- State Management ---
let openTabs = [];
let activeTabId = null;

// --- DOM Elements ---
const editorContainer = document.getElementById('editor-container');
const tabBar = document.getElementById('tab-bar');
const openFileBtn = document.getElementById('open-file-btn');
const saveFileBtn = document.getElementById('save-file-btn');
const openDirBtn = document.getElementById('open-dir-btn');
const settingsBtn = document.getElementById('settings-btn');
const fileExplorer = document.getElementById('file-explorer');
const chatForm = document.getElementById('chat-input-form');
const chatInput = document.getElementById('chat-input');
const messagesContainer = document.getElementById('chat-messages');

// --- Monaco Editor Setup ---
const editor = monaco.editor.create(editorContainer, {
  value: '// Welcome to Wizz! Open a file or a directory to get started.\n',
  language: 'javascript',
  theme: 'vs-dark',
  automaticLayout: true,
});

// --- Tab Management ---
function addTab(filePath, content) {
  const existingTab = openTabs.find(tab => tab.id === filePath);
  if (existingTab) {
    switchTab(filePath);
    return;
  }

  const model = monaco.editor.createModel(content, undefined, monaco.Uri.file(filePath));
  const tabState = { id: filePath, path: filePath, model: model };
  openTabs.push(tabState);

  renderTabs();
  switchTab(filePath);
}

function switchTab(tabId) {
  activeTabId = tabId;
  const tab = openTabs.find(t => t.id === tabId);
  if (tab) {
    editor.setModel(tab.model);
  }
  renderTabs();
}

function closeTab(tabId) {
  const tabIndex = openTabs.findIndex(tab => tab.id === tabId);
  if (tabIndex > -1) {
    const [closedTab] = openTabs.splice(tabIndex, 1);
    closedTab.model.dispose();

    if (activeTabId === tabId) {
      if (openTabs.length > 0) {
        const newActiveTab = openTabs[tabIndex] || openTabs[openTabs.length - 1];
        switchTab(newActiveTab.id);
      } else {
        editor.setModel(null);
        activeTabId = null;
      }
    }
    renderTabs();
  }
}

function renderTabs() {
  tabBar.innerHTML = '';
  openTabs.forEach(tab => {
    const tabEl = document.createElement('div');
    tabEl.className = `tab ${tab.id === activeTabId ? 'active' : ''}`;
    tabEl.textContent = tab.path.split(/[\\/]/).pop();
    tabEl.addEventListener('click', () => switchTab(tab.id));

    const closeEl = document.createElement('span');
    closeEl.className = 'tab-close';
    closeEl.innerHTML = '&times;';
    closeEl.addEventListener('click', (e) => {
      e.stopPropagation();
      closeTab(tab.id);
    });

    tabEl.appendChild(closeEl);
    tabBar.appendChild(tabEl);
  });
}

// --- File I/O Logic ---
openFileBtn.addEventListener('click', async () => {
  const result = await window.electronAPI.openFile();
  if (result) {
    addTab(result.filePath, result.content);
  }
});

saveFileBtn.addEventListener('click', async () => {
  if (!activeTabId) return;
  const tab = openTabs.find(t => t.id === activeTabId);
  if (tab) {
    const content = tab.model.getValue();
    const result = await window.electronAPI.saveFile(tab.path, content);
    if (result && result.filePath && result.filePath !== tab.path) {
      // File was saved to a new location, update tab info
      const oldId = tab.id;
      tab.id = result.filePath;
      tab.path = result.filePath;
      if (activeTabId === oldId) {
        activeTabId = tab.id;
      }
      renderTabs();
    }
  }
});

openDirBtn.addEventListener('click', async () => {
  const directory = await window.electronAPI.openDirectory();
  if (directory) {
    fileExplorer.innerHTML = '';
    const tree = createTree(directory);
    fileExplorer.appendChild(tree);
  }
});

settingsBtn.addEventListener('click', () => {
  window.electronAPI.openSettingsWindow();
});

function createTree(item) {
  const ul = document.createElement('ul');
  ul.style.paddingLeft = '15px';

  const li = document.createElement('li');
  li.textContent = item.name;
  ul.appendChild(li);

  if (item.children) {
    item.children.forEach(child => {
      const childTree = createTree(child);
      li.appendChild(childTree);
    });
  } else {
    li.style.cursor = 'pointer';
    li.addEventListener('click', async (e) => {
      e.stopPropagation();
      const result = await window.electronAPI.readFile(item.path);
      if (result) {
        addTab(result.filePath, result.content);
      }
    });
  }
  return ul;
}

// --- Theme Management ---
function applyTheme(theme) {
  document.body.setAttribute('data-theme', theme || 'dark');
  // Also update Monaco Editor's theme
  monaco.editor.setTheme(theme === 'light' ? 'vs' : 'vs-dark');
}

// Load initial theme
window.electronAPI.getSetting('theme').then(applyTheme);

// Listen for theme changes
window.electronAPI.onThemeChanged(applyTheme);

// --- Gemini Chat Logic ---
let genAI, model;

async function initializeChat() {
  try {
    const apiKey = await window.electronAPI.getApiKey();
    if (!apiKey) {
      addMessage('ai', 'ERROR: Gemini API key not found.');
      return;
    }
    genAI = new GoogleGenerativeAI(apiKey);
    model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  } catch (error) {
    console.error("Initialization Error:", error);
    addMessage('ai', `Initialization Error: ${error.message}`);
  }
}

function addMessage(sender, text) {
  const messageDiv = document.createElement('div');
  messageDiv.classList.add('message', sender);
  const bubbleDiv = document.createElement('div');
  bubbleDiv.classList.add('message-bubble');
  bubbleDiv.textContent = text;
  messageDiv.appendChild(bubbleDiv);
  messagesContainer.appendChild(messageDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const prompt = chatInput.value.trim();
  if (!prompt || !model) return;

  addMessage('user', prompt);
  chatInput.value = '';
  addMessage('ai', '...');

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    messagesContainer.removeChild(messagesContainer.lastChild);
    addMessage('ai', text);
  } catch (error) {
    console.error("API Error:", error);
    messagesContainer.removeChild(messagesContainer.lastChild);
    addMessage('ai', `Error: ${error.message}`);
  }
});

// --- Inline Code Completion Logic ---
function registerCodeCompletion() {
  if (!model) return;

  monaco.languages.registerCompletionItemProvider('javascript', {
    provideCompletionItems: async function(model, position) {
      const textUntilPosition = model.getValueInRange({startLineNumber: 1, startColumn: 1, endLineNumber: position.lineNumber, endColumn: position.column});
      if (textUntilPosition.length < 3) return { suggestions: [] };

      try {
        const prompt = `Complete the following JavaScript code:\n\n${textUntilPosition}`;
        const result = await genAI.getGenerativeModel({ model: "gemini-1.5-flash" }).generateContent(prompt);
        const completion = (await result.response).text();
        if (!completion) return { suggestions: [] };

        return {
          suggestions: [{
            label: completion,
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: completion,
            range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column)
          }]
        };
      } catch (error) {
        console.error("Completion Error:", error);
        return { suggestions: [] };
      }
    }
  });
}

// --- Initialization ---
(async () => {
  await initializeChat();
  registerCodeCompletion();
})();

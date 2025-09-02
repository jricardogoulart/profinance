const { app, BrowserWindow } = require("electron");
const path = require("path");
const { spawn } = require("child_process");

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  win.loadFile("renderer/dashboard.html");

}

// Inicia o servidor Express junto com o Electron
app.whenReady().then(() => {
  spawn("node", ["src/server.js"], { stdio: "inherit" });
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

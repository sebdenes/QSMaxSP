const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");
const { app, BrowserWindow, dialog, shell } = require("electron");

let mainWindow = null;
let nextServer = null;
let nextApp = null;
let serverPort = null;
let isStopping = false;

function resolveAppRoot() {
  return app.getAppPath();
}

function ensureRuntimeDatabase(appRoot) {
  const runtimeDirectory = path.join(appRoot, "prisma");
  fs.mkdirSync(runtimeDirectory, { recursive: true });

  const runtimeDbPath = path.join(runtimeDirectory, "quicksizer.db");
  const bundledSeedPath = path.join(appRoot, "prisma", "desktop.db");

  if (!fs.existsSync(runtimeDbPath) && fs.existsSync(bundledSeedPath)) {
    fs.copyFileSync(bundledSeedPath, runtimeDbPath);
  }
}

function configureRuntimeEnvironment(appRoot) {
  ensureRuntimeDatabase(appRoot);

  process.env.QS_APP_ROOT = appRoot;
  process.chdir(appRoot);
  process.env.NODE_ENV = "production";
  process.env.AUTH_DISABLED = "true";
  process.env.NEXT_PUBLIC_AUTH_DISABLED = "true";
  process.env.ALLOW_SELF_SIGNUP = "false";
  process.env.ALLOW_DEMO_LOGIN = "false";
  process.env.DATABASE_URL = "file:./quicksizer.db";
}

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const tester = net.createServer();

    tester.once("error", () => resolve(false));
    tester.once("listening", () => {
      tester.close(() => resolve(true));
    });

    tester.listen(port, "127.0.0.1");
  });
}

async function findPort(startAt = 3900) {
  for (let port = startAt; port < startAt + 300; port += 1) {
    // eslint-disable-next-line no-await-in-loop
    const available = await isPortAvailable(port);
    if (available) {
      return port;
    }
  }

  throw new Error("No available localhost port found for desktop runtime.");
}

async function startNextServer(appRoot) {
  const nextFactory = require("next");

  serverPort = await findPort();
  nextApp = nextFactory({
    dev: false,
    dir: appRoot,
    hostname: "127.0.0.1",
    port: serverPort
  });

  await nextApp.prepare();
  const handle = nextApp.getRequestHandler();

  nextServer = http.createServer((request, response) => {
    Promise.resolve(handle(request, response)).catch((error) => {
      console.error("Unhandled desktop request error", error);
      response.statusCode = 500;
      response.end("Internal server error");
    });
  });

  await new Promise((resolve, reject) => {
    if (!nextServer) {
      reject(new Error("Next server instance was not created."));
      return;
    }

    nextServer.once("error", reject);
    nextServer.listen(serverPort, "127.0.0.1", () => {
      nextServer.off("error", reject);
      resolve();
    });
  });

  return serverPort;
}

async function stopNextServer() {
  if (nextServer) {
    await new Promise((resolve) => {
      nextServer.close(() => resolve());
    });
    nextServer = null;
  }

  if (nextApp && typeof nextApp.close === "function") {
    await nextApp.close();
  }

  nextApp = null;
  serverPort = null;
}

function createWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 980,
    minWidth: 1200,
    minHeight: 760,
    title: "Max Success Plan Premium Services Quicksizer",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  void mainWindow.loadURL(`http://127.0.0.1:${port}`);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

async function launchDesktopRuntime() {
  const appRoot = resolveAppRoot();
  configureRuntimeEnvironment(appRoot);
  const port = await startNextServer(appRoot);
  createWindow(port);
}

app.on("before-quit", (event) => {
  if (isStopping) {
    return;
  }

  event.preventDefault();
  isStopping = true;

  void stopNextServer().finally(() => {
    app.quit();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (!mainWindow && serverPort) {
    createWindow(serverPort);
  }
});

app.whenReady()
  .then(async () => {
    try {
      await launchDesktopRuntime();
    } catch (error) {
      const message = error instanceof Error ? error.stack ?? error.message : String(error);
      dialog.showErrorBox("QSMaxSP launch failed", message);
      app.quit();
    }
  })
  .catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    dialog.showErrorBox("QSMaxSP startup failed", message);
    app.quit();
  });

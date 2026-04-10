const BASE = process.env.CAPROVER_URL; // e.g. https://captain.zycloud.space
const PASSWORD = process.env.CAPROVER_PASSWORD;

let cachedToken = null;
let tokenExpiry = 0;

async function getToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const res = await fetch(`${BASE}/api/v2/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-namespace": "captain" },
    body: JSON.stringify({ password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`CapRover login failed: ${res.status}`);
  const { data } = await res.json();
  cachedToken = data.token;
  tokenExpiry = Date.now() + 50 * 60 * 1000; // 50 min (tokens last ~1 hr)
  return cachedToken;
}

async function api(method, path, body) {
  const token = await getToken();
  const res = await fetch(`${BASE}/api/v2${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-namespace": "captain",
      "x-captain-auth": token,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`CapRover ${method} ${path} → ${res.status}`);
  return res.json();
}

export async function appExists(appName) {
  const { data } = await api("GET", "/user/apps/appDefinitions");
  return data.appDefinitions.some((a) => a.appName === appName);
}

export async function createApp(appName) {
  await api("POST", "/user/apps/appDefinitions", {
    appName,
    hasPersistentData: false,
  });
}

export async function enableSsl(appName) {
  await api("POST", "/user/apps/appDefinitions/enablebasedomainssl", {
    appName,
  });
  await api("POST", "/user/apps/appDefinitions/update", {
    appName,
    forceSsl: true,
    websocketSupport: false,
    containerHttpPort: 80,
    notExposeAsWebApp: false,
    description: "",
  });
}

export async function uploadTarball(appName, tarballBuffer) {
  const token = await getToken();
  const form = new FormData();
  form.append(
    "sourceFile",
    new Blob([tarballBuffer], { type: "application/gzip" }),
    "app.tar.gz"
  );

  const res = await fetch(
    `${BASE}/api/v2/user/apps/appDefinitions/upload?appName=${appName}`,
    {
      method: "POST",
      headers: { "x-namespace": "captain", "x-captain-auth": token },
      body: form,
    }
  );
  if (!res.ok) throw new Error(`CapRover upload failed: ${res.status}`);
  return res.json();
}

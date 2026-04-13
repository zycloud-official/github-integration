import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Detect the project framework from a directory and return
 * an appropriate captain-definition (or null if one should already exist).
 */
export function detectFramework(dir) {
  if (existsSync(join(dir, "Dockerfile"))) {
    return { framework: "dockerfile", captainDef: null }; // use as-is
  }

  const pkgPath = join(dir, "package.json");
  if (existsSync(pkgPath)) {
    let pkg = {};
    try {
      pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    } catch {}
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    if (
      "vite" in deps ||
      "@vitejs/plugin-react" in deps ||
      "@vitejs/plugin-vue" in deps
    ) {
      return { framework: "vite", captainDef: viteDef() };
    }
    if ("next" in deps) {
      return { framework: "nextjs", captainDef: nextjsDef() };
    }
    return { framework: "node", captainDef: nodeDef() };
  }

  if (existsSync(join(dir, "requirements.txt"))) {
    return { framework: "python", captainDef: pythonDef() };
  }

  if (existsSync(join(dir, "index.html"))) {
    return { framework: "static", captainDef: staticDef() };
  }

  return { framework: "unknown", captainDef: null };
}

function viteDef() {
  return {
    schemaVersion: 2,
    dockerfileLines: [
      // node:20-alpine (musl) causes esbuild to produce a non-extensible module
      // object that breaks Vite's config loader. Use Debian slim instead.
      "FROM node:lts-slim AS builder",
      "WORKDIR /app",
      "COPY package*.json ./",
      "RUN npm install",          // npm ci requires package-lock.json; install works with any lock file or none
      "COPY . .",
      "RUN npm run build",
      "FROM nginx:alpine",
      "COPY --from=builder /app/dist /usr/share/nginx/html",
      // Single-quoted string keeps $uri literal (no shell expansion). Overwrites nginx default
      // with SPA-friendly config so client-side routing works on any path.
      "RUN echo 'server{listen 80;root /usr/share/nginx/html;index index.html;location /{try_files $uri $uri/ /index.html;}}' > /etc/nginx/conf.d/default.conf",
      "EXPOSE 80",
    ],
  };
}

function nextjsDef() {
  return {
    schemaVersion: 2,
    dockerfileLines: [
      "FROM node:lts-slim",
      "WORKDIR /app",
      "COPY package*.json ./",
      "RUN npm install",
      "COPY . .",
      "RUN npm run build",
      "EXPOSE 3000",
      'CMD ["npm", "start"]',
    ],
  };
}

function nodeDef() {
  return {
    schemaVersion: 2,
    dockerfileLines: [
      "FROM node:lts-slim",
      "WORKDIR /app",
      "COPY package*.json ./",
      "RUN npm ci --omit=dev",
      "COPY . .",
      "EXPOSE 3000",
      'CMD ["node", "index.js"]',
    ],
  };
}

function pythonDef() {
  return {
    schemaVersion: 2,
    dockerfileLines: [
      "FROM python:3.12-slim",
      "WORKDIR /app",
      "COPY requirements.txt ./",
      "RUN pip install --no-cache-dir -r requirements.txt",
      "COPY . .",
      "EXPOSE 5000",
      'CMD ["python", "app.py"]',
    ],
  };
}

function staticDef() {
  return {
    schemaVersion: 2,
    dockerfileLines: [
      "FROM nginx:alpine",
      "COPY . /usr/share/nginx/html",
      "EXPOSE 80",
    ],
  };
}

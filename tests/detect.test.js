import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { detectFramework } from "../src/detect.js";

let dir;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "detect-test-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("detectFramework", () => {
  it("detects Dockerfile and returns null captainDef", async () => {
    await writeFile(join(dir, "Dockerfile"), "FROM node:20");
    const { framework, captainDef } = detectFramework(dir);
    expect(framework).toBe("dockerfile");
    expect(captainDef).toBeNull();
  });

  it("detects Vite via vite in dependencies", async () => {
    await writeFile(
      join(dir, "package.json"),
      JSON.stringify({ dependencies: { vite: "^5.0.0" } })
    );
    const { framework, captainDef } = detectFramework(dir);
    expect(framework).toBe("vite");
    expect(captainDef.dockerfileLines.some((l) => l.includes("nginx"))).toBe(true);
    expect(captainDef.dockerfileLines.some((l) => l.includes("/dist"))).toBe(true);
  });

  it("detects Vite via @vitejs/plugin-react in devDependencies", async () => {
    await writeFile(
      join(dir, "package.json"),
      JSON.stringify({ devDependencies: { "@vitejs/plugin-react": "^4.0.0" } })
    );
    const { framework } = detectFramework(dir);
    expect(framework).toBe("vite");
  });

  it("detects Next.js", async () => {
    await writeFile(
      join(dir, "package.json"),
      JSON.stringify({ dependencies: { next: "^14.0.0" } })
    );
    const { framework, captainDef } = detectFramework(dir);
    expect(framework).toBe("nextjs");
    expect(captainDef.dockerfileLines.some((l) => l.includes("npm run build"))).toBe(true);
    expect(captainDef.dockerfileLines.some((l) => l.includes("npm"))).toBe(true);
  });

  it("detects plain Node when package.json has no known framework", async () => {
    await writeFile(
      join(dir, "package.json"),
      JSON.stringify({ dependencies: { express: "^5.0.0" } })
    );
    const { framework, captainDef } = detectFramework(dir);
    expect(framework).toBe("node");
    expect(captainDef.dockerfileLines.some((l) => l.includes("index.js"))).toBe(true);
  });

  it("detects Python via requirements.txt", async () => {
    await writeFile(join(dir, "requirements.txt"), "flask\ngunicorn\n");
    const { framework, captainDef } = detectFramework(dir);
    expect(framework).toBe("python");
    expect(captainDef.dockerfileLines.some((l) => l.includes("app.py"))).toBe(true);
  });

  it("detects static site via index.html", async () => {
    await writeFile(join(dir, "index.html"), "<!DOCTYPE html><html/>");
    const { framework, captainDef } = detectFramework(dir);
    expect(framework).toBe("static");
    expect(captainDef.dockerfileLines.some((l) => l.includes("nginx"))).toBe(true);
  });

  it("returns unknown with null captainDef for an empty directory", async () => {
    const { framework, captainDef } = detectFramework(dir);
    expect(framework).toBe("unknown");
    expect(captainDef).toBeNull();
  });

  it("Dockerfile takes priority over package.json", async () => {
    await writeFile(join(dir, "Dockerfile"), "FROM node:20");
    await writeFile(
      join(dir, "package.json"),
      JSON.stringify({ dependencies: { next: "^14.0.0" } })
    );
    const { framework } = detectFramework(dir);
    expect(framework).toBe("dockerfile");
  });
});

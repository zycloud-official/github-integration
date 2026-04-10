import {
  mkdtemp,
  mkdir,
  rm,
  writeFile,
  readFile,
  access,
} from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import * as tar from "tar";
import { downloadTarball } from "./github.js";
import { detectFramework } from "./detect.js";
import { appExists, createApp, uploadTarball, enableSsl } from "./caprover.js";
import { prisma } from "./db.js";

export async function deployApp({
  owner,
  repo,
  sha,
  installationId,
  appName,
  appId,
  deployId,
}) {
  const setStatus = (status, log) =>
    prisma.deploy.update({
      where: { id: deployId },
      data: { status, log },
    });

  await setStatus("building", null);
  let tmpDir;

  try {
    tmpDir = await mkdtemp(join(tmpdir(), "zycloud-"));
    const rawTarball = join(tmpDir, "raw.tar.gz");
    const extractDir = join(tmpDir, "src");
    const packedTarball = join(tmpDir, "deploy.tar.gz");

    // 1. Download tarball from GitHub
    const tarballBuffer = await downloadTarball(
      owner,
      repo,
      sha,
      installationId
    );
    await writeFile(rawTarball, tarballBuffer);

    // 2. Extract — strip the top-level directory GitHub adds (e.g. owner-repo-sha/)
    await mkdir(extractDir);
    await tar.extract({
      file: rawTarball,
      cwd: extractDir,
      strip: 1,
      strict: false,
    });

    // 3. Inject captain-definition if the repo doesn't have one
    const captainDefPath = join(extractDir, "captain-definition");
    let hasCaptainDef = false;
    try {
      await access(captainDefPath, constants.F_OK);
      hasCaptainDef = true;
    } catch {}

    if (!hasCaptainDef) {
      const { captainDef } = detectFramework(extractDir);
      if (captainDef) {
        await writeFile(captainDefPath, JSON.stringify(captainDef, null, 2));
      }
    }

    // 4. Repack into a clean tarball
    await tar.create({ gzip: true, file: packedTarball, cwd: extractDir }, [
      ".",
    ]);
    const deployBuffer = await readFile(packedTarball);

    // 5. Create CapRover app if this is the first deploy
    const isNew = !(await appExists(appName));
    if (isNew) await createApp(appName);

    // 6. Upload tarball to CapRover
    await uploadTarball(appName, deployBuffer);

    // 7. Enable HTTPS for new apps
    if (isNew) await enableSsl(appName);

    await setStatus(
      "success",
      `Deployed ${sha.slice(0, 7)} → https://${appName}.zycloud.space`
    );
  } catch (err) {
    await setStatus("failed", err.message);
    throw err;
  } finally {
    if (tmpDir) await rm(tmpDir, { recursive: true, force: true });
  }
}

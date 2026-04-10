import { Router } from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "../db.js";
import { deployApp } from "../deploy.js";

export const webhookRoutes = Router();

function verifySignature(rawBody, signature, secret) {
  const expected =
    "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return false;
  return timingSafeEqual(sigBuf, expBuf);
}

webhookRoutes.post("/webhook", async (req, res) => {
  const sig = req.headers["x-hub-signature-256"];
  if (
    !sig ||
    !verifySignature(req.rawBody, sig, process.env.GITHUB_WEBHOOK_SECRET)
  ) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  const event = req.headers["x-github-event"];
  const payload = req.body;

  switch (event) {
    case "push":
      await handlePush(payload);
      break;
    case "installation":
      await handleInstallation(payload);
      break;
    case "installation_repositories":
      handleInstallationRepos(payload);
      break;
    default:
      console.debug("Unhandled webhook event:", event);
  }

  res.json({ ok: true });
});

async function handlePush(payload) {
  const { repository, installation, ref, after: sha } = payload;

  if (!installation) return;
  if (ref !== `refs/heads/${repository.default_branch}`) {
    console.log(`Skipping non-default branch push: ${ref}`);
    return;
  }

  const owner = repository.owner.login.toLowerCase();
  const repo = repository.name.toLowerCase();
  const appName = `${owner}-${repo}`.replace(/[^a-z0-9-]/g, "-");
  const installationId = installation.id;

  const app = await prisma.app.upsert({
    where: { githubRepo: `${owner}/${repo}` },
    create: {
      githubRepo: `${owner}/${repo}`,
      caproverAppName: appName,
      previewUrl: `https://${appName}.zycloud.space`,
    },
    update: {},
  });

  const deploy = await prisma.deploy.create({
    data: { appId: app.id, commitSha: sha, status: "queued" },
  });

  console.log(`Deploy queued: ${appName} @ ${sha.slice(0, 7)}`);

  // Fire-and-forget — respond to GitHub quickly, deploy runs in background
  deployApp({
    owner,
    repo,
    sha,
    installationId,
    appName,
    appId: app.id,
    deployId: deploy.id,
  })
    .then(() => console.log(`Deploy succeeded: ${appName}`))
    .catch((err) => console.error(`Deploy failed: ${appName}`, err));
}

async function handleInstallation(payload) {
  const { action, installation, sender } = payload;
  const username = sender.login.toLowerCase();

  if (action === "created") {
    const existingMember = await prisma.member.findFirst({
      where: { githubUsername: username },
    });
    await prisma.installation.upsert({
      where: { githubInstallationId: installation.id },
      create: {
        githubInstallationId: installation.id,
        githubUsername: username,
        ...(existingMember ? { memberId: existingMember.id } : {}),
      },
      update: {},
    });
    console.log(`App installed by: ${username}`);
  } else if (action === "deleted") {
    await prisma.installation.deleteMany({
      where: { githubInstallationId: installation.id },
    });
    console.log(`App uninstalled by: ${username}`);
  }
}

function handleInstallationRepos(payload) {
  console.log(
    `Installation repos changed: action=${payload.action} added=${
      payload.repositories_added?.length ?? 0
    } removed=${payload.repositories_removed?.length ?? 0}`
  );
}

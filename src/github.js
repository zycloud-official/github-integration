import { App } from "@octokit/app";

export const githubApp = new App({
  appId: process.env.GITHUB_APP_ID,
  privateKey: process.env.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, "\n"),
  webhooks: { secret: process.env.GITHUB_WEBHOOK_SECRET },
  oauth: {
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
  },
});

export async function downloadTarball(owner, repo, sha, installationId) {
  const octokit = await githubApp.getInstallationOctokit(installationId);
  const { token } = await octokit.auth({
    type: "installation",
    installationId,
  });

  // GitHub returns a redirect to a signed S3 URL
  const url = `https://api.github.com/repos/${owner}/${repo}/tarball/${sha}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": "github-integration/1.0",
    },
    redirect: "follow",
  });
  if (!res.ok)
    throw new Error(`Tarball download failed: ${res.status} ${res.statusText}`);
  return Buffer.from(await res.arrayBuffer());
}

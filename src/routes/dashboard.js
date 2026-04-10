import { Router } from "express";
import { prisma } from "../db.js";

export const dashboardRoutes = Router();

async function getSession(req) {
  const token = req.cookies?.session;
  if (!token) return null;
  return prisma.member.findFirst({ where: { sessionToken: token } });
}

dashboardRoutes.get("/dashboard", async (req, res) => {
  const member = await getSession(req);
  if (!member) return res.redirect("/auth/github");

  const apps = await prisma.app.findMany({
    where: { memberId: member.id },
    include: {
      deploys: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  res.json({
    member: {
      username: member.githubUsername,
      avatarUrl: member.avatarUrl,
    },
    apps: apps.map((app) => ({
      githubRepo: app.githubRepo,
      caproverAppName: app.caproverAppName,
      previewUrl: app.previewUrl,
      createdAt: app.createdAt,
      lastStatus: app.deploys[0]?.status ?? null,
      lastCommit: app.deploys[0]?.commitSha ?? null,
      lastDeployAt: app.deploys[0]?.createdAt ?? null,
    })),
    installUrl: `https://github.com/apps/${process.env.GITHUB_APP_SLUG}/installations/new`,
  });
});

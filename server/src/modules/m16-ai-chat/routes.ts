import { Router } from "express";
import { z } from "zod";
import { ok, parse } from "../../core/http";
import type { AppContext } from "../../context";
import { requireStaff } from "../m01-identity/middleware";
import { assertAuthorized } from "../m01-identity/rbac";

const chatBody = z.object({
  storeId: z.string().min(1),
  question: z.string().trim().min(1).max(1000),
});

export function chatRouter(ctx: AppContext): Router {
  const r = Router();

  r.post("/chat", requireStaff, async (req, res) => {
    const body = parse(chatBody, req.body);
    const actor = assertAuthorized(req.actor, "USE_CHAT", body.storeId);
    ok(req, res, await ctx.chat.answer(actor, body));
  });

  return r;
}

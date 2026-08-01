// Admin-only SEO audit surface. Thin wrapper: all logic lives in
// seo-audit.server.ts and is imported inside the handler.

import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SeoRouteCheck, SeoSupportCheck } from "./seo-audit.server";

export const adminSeoAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({
      context,
    }): Promise<{
      origin: string;
      routes: SeoRouteCheck[];
      support: SeoSupportCheck;
    }> => {
      const { data: isAdmin, error } = await context.supabase.rpc("has_role", {
        _user_id: context.userId,
        _role: "admin",
      });
      if (error) throw new Error(error.message);
      if (isAdmin !== true) throw new Error("Forbidden");

      const origin = new URL(getRequest().url).origin;
      const { auditPublicRoutes, auditSupportFiles } = await import("./seo-audit.server");
      const [routes, support] = await Promise.all([
        auditPublicRoutes(origin),
        auditSupportFiles(origin),
      ]);
      return { origin, routes, support };
    },
  );

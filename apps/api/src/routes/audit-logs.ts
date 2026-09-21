import {
  Router,
} from "express";

import {
  z,
} from "zod";

import {
  supabase,
} from "../config/supabase.js";


import {
  canViewAuditLog,
} from "../security/audit-access.js";

const router = Router();

const querySchema =
  z.object({
    page: z.coerce
      .number()
      .int()
      .min(1)
      .default(1),

    pageSize: z.coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .default(25),

    action: z
      .string()
      .trim()
      .max(120)
      .optional(),

    resourceType: z
      .string()
      .trim()
      .max(120)
      .optional(),

    actorUserId: z
      .string()
      .uuid()
      .optional(),
  });

router.get(
  "/",
  async (
    req,
    res,
    next,
  ) => {
    try {
      const membership =
        req.membership!;

      /*
       * Phase 1 policy:
       * Only organisation OWNER and ADMIN
       * can inspect the full audit trail.
       */
      if (
        !canViewAuditLog(
          membership.role,
        )
      ) {
        return res
          .status(403)
          .json({
            success: false,

            error: {
              code:
                "AUDIT_LOG_FORBIDDEN",

              message:
                "Only organisation owners and administrators can view the audit log.",
            },
          });
      }

      const query =
        querySchema.parse(
          req.query,
        );

      const from =
        (query.page - 1) *
        query.pageSize;

      const to =
        from +
        query.pageSize -
        1;

      let auditQuery =
        supabase
          .from("audit_logs")
          .select(
            `
            id,
            organisation_id,
            actor_id,
            action,
            resource_type,
            resource_id,
            summary,
            metadata,
            created_at
            `,
            {
              count: "exact",
            },
          )
          .eq(
            "organisation_id",
            membership.organisationId,
          )
          .order(
            "created_at",
            {
              ascending: false,
            },
          )
          .range(
            from,
            to,
          );

      if (query.action) {
        auditQuery =
          auditQuery.eq(
            "action",
            query.action,
          );
      }

      if (
        query.resourceType
      ) {
        auditQuery =
          auditQuery.eq(
            "resource_type",
            query.resourceType,
          );
      }

      if (
        query.actorUserId
      ) {
        auditQuery =
          auditQuery.eq(
            "actor_id",
            query.actorUserId,
          );
      }

      const {
        data: logs,
        count,
        error,
      } = await auditQuery;

      if (error) {
        return next(error);
      }

      const actorIds = [
        ...new Set(
          (logs ?? [])
            .map(
              (log) =>
                log.actor_id,
            )
            .filter(
              (
                value,
              ): value is string =>
                Boolean(value),
            ),
        ),
      ];

      const actors =
        new Map<
          string,
          {
            id: string;
            email: string;
            full_name:
              | string
              | null;
            role: string;
          }
        >();

      if (
        actorIds.length > 0
      ) {
        const {
          data: profiles,
          error:
            profilesError,
        } = await supabase
          .from("profiles")
          .select(
            `
            id,
            email,
            full_name,
            role
            `,
          )
          .in(
            "id",
            actorIds,
          );

        if (profilesError) {
          return next(
            profilesError,
          );
        }

        for (
          const profile of
          profiles ?? []
        ) {
          actors.set(
            profile.id,
            profile,
          );
        }
      }

      const data =
        (logs ?? []).map(
          (log) => ({
            ...log,

            actor:
              log.actor_id
                ? actors.get(
                    log.actor_id,
                  ) ?? null
                : null,
          }),
        );

      const total =
        count ?? 0;

      return res.json({
        success: true,

        data,

        pagination: {
          page:
            query.page,

          pageSize:
            query.pageSize,

          total,

          totalPages:
            Math.ceil(
              total /
                query.pageSize,
            ),
        },
      });
    } catch (error) {
      return next(error);
    }
  },
);

export default router;

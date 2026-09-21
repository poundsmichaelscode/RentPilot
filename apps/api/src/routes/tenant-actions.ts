import {
  Router,
  type Response,
} from "express";

import {
  z,
} from "zod";

import {
  supabase,
} from "../config/supabase.js";

const router = Router();

const maintenanceSchema =
  z.object({
    title: z
      .string()
      .trim()
      .min(3)
      .max(200),

    description: z
      .string()
      .trim()
      .min(5)
      .max(5000),

    category: z.enum([
      "PLUMBING",
      "ELECTRICAL",
      "WATER",
      "SECURITY",
      "APPLIANCE",
      "STRUCTURAL",
      "CLEANING",
      "OTHER",
    ]),

    priority: z
      .enum([
        "LOW",
        "NORMAL",
        "HIGH",
        "URGENT",
      ])
      .default("NORMAL"),
  });

async function getTenantScope(
  userId: string,
) {
  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from("profiles")
    .select("id,role")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  if (
    !profile ||
    profile.role !== "tenant"
  ) {
    return {
      ok: false,
      error:
        "TENANT_ACCOUNT_REQUIRED",
    } as const;
  }

  const {
    data: tenants,
    error: tenantError,
  } = await supabase
    .from("tenants")
    .select(
      `
      id,
      organisation_id,
      profile_id,
      full_name
      `,
    )
    .eq(
      "profile_id",
      userId,
    )
    .order(
      "created_at",
      {
        ascending: false,
      },
    );

  if (tenantError) {
    throw tenantError;
  }

  if (!tenants?.length) {
    return {
      ok: false,
      error:
        "TENANT_RECORD_NOT_FOUND",
    } as const;
  }

  const tenantIds =
    tenants.map(
      (tenant) => tenant.id,
    );

  const {
    data: leases,
    error: leaseError,
  } = await supabase
    .from("leases")
    .select(
      `
      id,
      tenant_id,
      unit_id,
      status,
      start_date,
      end_date
      `,
    )
    .in(
      "tenant_id",
      tenantIds,
    )
    .order(
      "start_date",
      {
        ascending: false,
      },
    );

  if (leaseError) {
    throw leaseError;
  }

  return {
    ok: true,
    profile,
    tenants,
    tenantIds,
    leases:
      leases ?? [],
    leaseIds:
      (leases ?? []).map(
        (lease) => lease.id,
      ),
  } as const;
}

async function getCurrentHome(
  userId: string,
) {
  const scope =
    await getTenantScope(
      userId,
    );

  if (!scope.ok) {
    return scope;
  }

  const activeLease =
    scope.leases.find(
      (lease) =>
        [
          "ACTIVE",
          "EXPIRING_SOON",
        ].includes(
          lease.status,
        ),
    );

  if (!activeLease) {
    return {
      ok: false,
      error:
        "ACTIVE_LEASE_NOT_FOUND",
    } as const;
  }

  const tenant =
    scope.tenants.find(
      (item) =>
        item.id ===
        activeLease.tenant_id,
    );

  if (!tenant) {
    return {
      ok: false,
      error:
        "TENANT_RECORD_NOT_FOUND",
    } as const;
  }

  const {
    data: unit,
    error: unitError,
  } = await supabase
    .from("units")
    .select(
      `
      id,
      property_id,
      unit_number,
      unit_type
      `,
    )
    .eq(
      "id",
      activeLease.unit_id,
    )
    .maybeSingle();

  if (unitError) {
    throw unitError;
  }

  if (!unit) {
    return {
      ok: false,
      error:
        "UNIT_NOT_FOUND",
    } as const;
  }

  return {
    ok: true,
    scope,
    tenant,
    lease:
      activeLease,
    unit,
  } as const;
}

function tenantScopeError(
  code: string,
  res: Response,
) {
  switch (code) {
    case "TENANT_ACCOUNT_REQUIRED":
      return res.status(403).json({
        success: false,
        error: {
          code,
          message:
            "A tenant account is required.",
        },
      });

    case "ACTIVE_LEASE_NOT_FOUND":
      return res.status(409).json({
        success: false,
        error: {
          code,
          message:
            "No active lease is linked to your tenant account.",
        },
      });

    default:
      return res.status(404).json({
        success: false,
        error: {
          code,
          message:
            "Tenant rental information could not be found.",
        },
      });
  }
}

/*
 * Tenant creates maintenance for their
 * own current rented unit only.
 *
 * The browser supplies no organisation,
 * property, unit or tenant IDs.
 */
router.post(
  "/maintenance",
  async (
    req,
    res,
    next,
  ) => {
    try {
      const body =
        maintenanceSchema.parse(
          req.body,
        );

      const userId =
        req.user!.id;

      const home =
        await getCurrentHome(
          userId,
        );

      if (!home.ok) {
        return tenantScopeError(
          home.error,
          res,
        );
      }

      const {
        data,
        error,
      } = await supabase
        .from(
          "maintenance_requests",
        )
        .insert({
          organisation_id:
            home.tenant
              .organisation_id,

          property_id:
            home.unit
              .property_id,

          unit_id:
            home.unit.id,

          tenant_id:
            home.tenant.id,

          title:
            body.title,

          description:
            body.description,

          category:
            body.category,

          priority:
            body.priority,

          status:
            "OPEN",

          reported_by:
            userId,

          updated_by:
            userId,
        })
        .select()
        .single();

      if (error) {
        return next(error);
      }

      return res
        .status(201)
        .json({
          success: true,
          data,
        });
    } catch (error) {
      return next(error);
    }
  },
);

/*
 * Tenant downloads only ACTIVE documents
 * linked directly to their tenant or lease.
 */
router.get(
  "/documents/:id/download",
  async (
    req,
    res,
    next,
  ) => {
    try {
      const documentId =
        z.string()
          .uuid()
          .parse(
            req.params.id,
          );

      const userId =
        req.user!.id;

      const scope =
        await getTenantScope(
          userId,
        );

      if (!scope.ok) {
        return tenantScopeError(
          scope.error,
          res,
        );
      }

      const {
        data: document,
        error,
      } = await supabase
        .from("documents")
        .select(
          `
          id,
          tenant_id,
          lease_id,
          file_name,
          mime_type,
          storage_bucket,
          storage_key,
          status
          `,
        )
        .eq(
          "id",
          documentId,
        )
        .eq(
          "status",
          "ACTIVE",
        )
        .maybeSingle();

      if (error) {
        return next(error);
      }

      if (!document) {
        return res
          .status(404)
          .json({
            success: false,
            error: {
              code:
                "DOCUMENT_NOT_FOUND",

              message:
                "Document not found.",
            },
          });
      }

      const tenantAllowed =
        Boolean(
          document.tenant_id &&
            scope.tenantIds.includes(
              document.tenant_id,
            ),
        );

      const leaseAllowed =
        Boolean(
          document.lease_id &&
            scope.leaseIds.includes(
              document.lease_id,
            ),
        );

      /*
       * Return 404 instead of 403 so a
       * tenant cannot probe document IDs
       * belonging to other users.
       */
      if (
        !tenantAllowed &&
        !leaseAllowed
      ) {
        return res
          .status(404)
          .json({
            success: false,
            error: {
              code:
                "DOCUMENT_NOT_FOUND",

              message:
                "Document not found.",
            },
          });
      }

      const {
        data: signed,
        error:
          signedUrlError,
      } =
        await supabase.storage
          .from(
            document.storage_bucket,
          )
          .createSignedUrl(
            document.storage_key,
            300,
            {
              download:
                document.file_name,
            },
          );

      if (signedUrlError) {
        return next(
          signedUrlError,
        );
      }

      return res.json({
        success: true,

        data: {
          documentId:
            document.id,

          fileName:
            document.file_name,

          mimeType:
            document.mime_type,

          expiresIn:
            300,

          signedUrl:
            signed.signedUrl,
        },
      });
    } catch (error) {
      return next(error);
    }
  },
);

export default router;

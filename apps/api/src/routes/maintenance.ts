import {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { z } from "zod";

import { supabase } from "../config/supabase.js";
import { requireRole } from "../middleware/require-role.js";

const router = Router();

const writeAccess = requireRole(
  "OWNER",
  "ADMIN",
  "PROPERTY_MANAGER",
);

const categorySchema = z.enum([
  "PLUMBING",
  "ELECTRICAL",
  "WATER",
  "SECURITY",
  "APPLIANCE",
  "STRUCTURAL",
  "CLEANING",
  "OTHER",
]);

const prioritySchema = z.enum([
  "LOW",
  "NORMAL",
  "HIGH",
  "URGENT",
]);

const statusSchema = z.enum([
  "OPEN",
  "IN_PROGRESS",
  "WAITING",
  "RESOLVED",
  "CANCELLED",
]);

const createSchema = z.object({
  propertyId: z.string().uuid(),

  unitId: z
    .string()
    .uuid()
    .nullable()
    .optional(),

  tenantId: z
    .string()
    .uuid()
    .nullable()
    .optional(),

  title: z
    .string()
    .trim()
    .min(3)
    .max(200),

  description: z
    .string()
    .trim()
    .min(3)
    .max(5000),

  category: categorySchema.default(
    "OTHER",
  ),

  priority: prioritySchema.default(
    "NORMAL",
  ),

  assignedTo: z
    .string()
    .uuid()
    .nullable()
    .optional(),
});

const updateSchema = z
  .object({
    propertyId: z
      .string()
      .uuid()
      .optional(),

    unitId: z
      .string()
      .uuid()
      .nullable()
      .optional(),

    tenantId: z
      .string()
      .uuid()
      .nullable()
      .optional(),

    title: z
      .string()
      .trim()
      .min(3)
      .max(200)
      .optional(),

    description: z
      .string()
      .trim()
      .min(3)
      .max(5000)
      .optional(),

    category: categorySchema.optional(),

    priority: prioritySchema.optional(),

    assignedTo: z
      .string()
      .uuid()
      .nullable()
      .optional(),

    resolutionNotes: z
      .string()
      .trim()
      .max(5000)
      .nullable()
      .optional(),
  })
  .refine(
    (value) =>
      Object.keys(value).length > 0,
    {
      message:
        "At least one maintenance field must be provided.",
    },
  );

const statusUpdateSchema = z.object({
  status: statusSchema,

  resolutionNotes: z
    .string()
    .trim()
    .max(5000)
    .nullable()
    .optional(),
});

const listQuerySchema = z.object({
  status: statusSchema.optional(),

  priority: prioritySchema.optional(),

  category: categorySchema.optional(),

  propertyId: z
    .string()
    .uuid()
    .optional(),

  unitId: z
    .string()
    .uuid()
    .optional(),

  tenantId: z
    .string()
    .uuid()
    .optional(),

  assignedTo: z
    .string()
    .uuid()
    .optional(),

  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(50),

  offset: z.coerce
    .number()
    .int()
    .min(0)
    .default(0),
});

function maintenanceError(
  error: {
    message?: string;
    code?: string;
  },
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const message =
    error.message ?? "";

  const notFoundErrors = [
    "MAINTENANCE_PROPERTY_NOT_FOUND",
    "MAINTENANCE_UNIT_NOT_FOUND",
    "MAINTENANCE_TENANT_NOT_FOUND",
  ];

  if (
    notFoundErrors.some((code) =>
      message.includes(code),
    )
  ) {
    return res.status(404).json({
      success: false,
      error: {
        code:
          "MAINTENANCE_RESOURCE_NOT_FOUND",
        message:
          "A related maintenance resource could not be found.",
      },
    });
  }

  const conflicts = [
    "INVALID_MAINTENANCE_STATUS_TRANSITION",
    "MAINTENANCE_REQUEST_ALREADY_CLOSED",
    "MAINTENANCE_PROPERTY_ORGANISATION_MISMATCH",
    "MAINTENANCE_UNIT_ORGANISATION_MISMATCH",
    "MAINTENANCE_UNIT_PROPERTY_MISMATCH",
    "MAINTENANCE_TENANT_ORGANISATION_MISMATCH",
    "MAINTENANCE_ASSIGNEE_NOT_ORGANISATION_MEMBER",
  ];

  if (
    conflicts.some((code) =>
      message.includes(code),
    )
  ) {
    return res.status(409).json({
      success: false,
      error: {
        code: "MAINTENANCE_CONFLICT",
        message:
          "The maintenance request conflicts with the current organisation, assignment, or status.",
      },
    });
  }

  return next(error);
}

/*
 * List maintenance requests.
 *
 * Any active organisation member can read.
 */
router.get(
  "/",
  async (req, res, next) => {
    try {
      const organisationId =
        req.membership!.organisationId;

      const filters =
        listQuerySchema.parse(
          req.query,
        );

      let query = supabase
        .from("maintenance_requests")
        .select("*", {
          count: "exact",
        })
        .eq(
          "organisation_id",
          organisationId,
        )
        .order("created_at", {
          ascending: false,
        })
        .range(
          filters.offset,
          filters.offset +
            filters.limit -
            1,
        );

      if (filters.status) {
        query = query.eq(
          "status",
          filters.status,
        );
      }

      if (filters.priority) {
        query = query.eq(
          "priority",
          filters.priority,
        );
      }

      if (filters.category) {
        query = query.eq(
          "category",
          filters.category,
        );
      }

      if (filters.propertyId) {
        query = query.eq(
          "property_id",
          filters.propertyId,
        );
      }

      if (filters.unitId) {
        query = query.eq(
          "unit_id",
          filters.unitId,
        );
      }

      if (filters.tenantId) {
        query = query.eq(
          "tenant_id",
          filters.tenantId,
        );
      }

      if (filters.assignedTo) {
        query = query.eq(
          "assigned_to",
          filters.assignedTo,
        );
      }

      const {
        data,
        error,
        count,
      } = await query;

      if (error) {
        return next(error);
      }

      return res.json({
        success: true,

        data: data ?? [],

        meta: {
          total: count ?? 0,
          limit: filters.limit,
          offset: filters.offset,
        },
      });
    } catch (error) {
      return next(error);
    }
  },
);

/*
 * Get one maintenance request.
 */
router.get(
  "/:id",
  async (req, res, next) => {
    try {
      const maintenanceId =
        z.string().uuid().parse(
          req.params.id,
        );

      const organisationId =
        req.membership!.organisationId;

      const {
        data,
        error,
      } = await supabase
        .from("maintenance_requests")
        .select("*")
        .eq(
          "id",
          maintenanceId,
        )
        .eq(
          "organisation_id",
          organisationId,
        )
        .maybeSingle();

      if (error) {
        return next(error);
      }

      if (!data) {
        return res.status(404).json({
          success: false,
          error: {
            code:
              "MAINTENANCE_NOT_FOUND",
            message:
              "Maintenance request not found.",
          },
        });
      }

      return res.json({
        success: true,
        data,
      });
    } catch (error) {
      return next(error);
    }
  },
);

/*
 * Create a maintenance request.
 */
router.post(
  "/",
  writeAccess,
  async (req, res, next) => {
    try {
      const body =
        createSchema.parse(
          req.body,
        );

      const organisationId =
        req.membership!.organisationId;

      const actorId =
        req.user!.id;

      const {
        data,
        error,
      } = await supabase
        .from("maintenance_requests")
        .insert({
          organisation_id:
            organisationId,

          property_id:
            body.propertyId,

          unit_id:
            body.unitId ?? null,

          tenant_id:
            body.tenantId ?? null,

          title:
            body.title,

          description:
            body.description,

          category:
            body.category,

          priority:
            body.priority,

          status: "OPEN",

          reported_by:
            actorId,

          assigned_to:
            body.assignedTo ?? null,

          updated_by:
            actorId,
        })
        .select()
        .single();

      if (error) {
        return maintenanceError(
          error,
          req,
          res,
          next,
        );
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
 * Update maintenance request details.
 *
 * Status changes deliberately use the dedicated
 * /:id/status route.
 */
router.patch(
  "/:id",
  writeAccess,
  async (req, res, next) => {
    try {
      const maintenanceId =
        z.string().uuid().parse(
          req.params.id,
        );

      const body =
        updateSchema.parse(
          req.body,
        );

      const organisationId =
        req.membership!.organisationId;

      const {
        data: existing,
        error: existingError,
      } = await supabase
        .from("maintenance_requests")
        .select("*")
        .eq(
          "id",
          maintenanceId,
        )
        .eq(
          "organisation_id",
          organisationId,
        )
        .maybeSingle();

      if (existingError) {
        return next(
          existingError,
        );
      }

      if (!existing) {
        return res.status(404).json({
          success: false,
          error: {
            code:
              "MAINTENANCE_NOT_FOUND",
            message:
              "Maintenance request not found.",
          },
        });
      }

      const update: Record<
        string,
        unknown
      > = {
        updated_by: req.user!.id,
      };

      if (
        body.propertyId !==
        undefined
      ) {
        update.property_id =
          body.propertyId;
      }

      if (
        body.unitId !==
        undefined
      ) {
        update.unit_id =
          body.unitId;
      }

      if (
        body.tenantId !==
        undefined
      ) {
        update.tenant_id =
          body.tenantId;
      }

      if (
        body.title !== undefined
      ) {
        update.title =
          body.title;
      }

      if (
        body.description !==
        undefined
      ) {
        update.description =
          body.description;
      }

      if (
        body.category !==
        undefined
      ) {
        update.category =
          body.category;
      }

      if (
        body.priority !==
        undefined
      ) {
        update.priority =
          body.priority;
      }

      if (
        body.assignedTo !==
        undefined
      ) {
        update.assigned_to =
          body.assignedTo;
      }

      if (
        body.resolutionNotes !==
        undefined
      ) {
        update.resolution_notes =
          body.resolutionNotes;
      }

      const {
        data,
        error,
      } = await supabase
        .from("maintenance_requests")
        .update(update)
        .eq(
          "id",
          maintenanceId,
        )
        .eq(
          "organisation_id",
          organisationId,
        )
        .select()
        .single();

      if (error) {
        return maintenanceError(
          error,
          req,
          res,
          next,
        );
      }

      return res.json({
        success: true,
        data,
      });
    } catch (error) {
      return next(error);
    }
  },
);

/*
 * Change maintenance lifecycle status.
 *
 * The PostgreSQL trigger remains authoritative
 * for valid state transitions.
 */
router.patch(
  "/:id/status",
  writeAccess,
  async (req, res, next) => {
    try {
      const maintenanceId =
        z.string().uuid().parse(
          req.params.id,
        );

      const body =
        statusUpdateSchema.parse(
          req.body,
        );

      const organisationId =
        req.membership!.organisationId;

      const {
        data: existing,
        error: existingError,
      } = await supabase
        .from("maintenance_requests")
        .select("id,status")
        .eq(
          "id",
          maintenanceId,
        )
        .eq(
          "organisation_id",
          organisationId,
        )
        .maybeSingle();

      if (existingError) {
        return next(
          existingError,
        );
      }

      if (!existing) {
        return res.status(404).json({
          success: false,
          error: {
            code:
              "MAINTENANCE_NOT_FOUND",
            message:
              "Maintenance request not found.",
          },
        });
      }

      const update: Record<
        string,
        unknown
      > = {
        status: body.status,
        updated_by: req.user!.id,
      };

      if (
        body.resolutionNotes !==
        undefined
      ) {
        update.resolution_notes =
          body.resolutionNotes;
      }

      const {
        data,
        error,
      } = await supabase
        .from("maintenance_requests")
        .update(update)
        .eq(
          "id",
          maintenanceId,
        )
        .eq(
          "organisation_id",
          organisationId,
        )
        .select()
        .single();

      if (error) {
        return maintenanceError(
          error,
          req,
          res,
          next,
        );
      }

      return res.json({
        success: true,
        data,
      });
    } catch (error) {
      return next(error);
    }
  },
);

export default router;

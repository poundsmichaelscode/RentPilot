import {
  randomUUID,
  } from "node:crypto";

import {
  Router,
  type NextFunction,
  type Response,
} from "express";

import { z } from "zod";

import { supabase } from "../config/supabase.js";
import { requireRole } from "../middleware/require-role.js";

const router = Router();

const STORAGE_BUCKET =
  "rentpilot-documents";

const MAX_FILE_SIZE =
  10 * 1024 * 1024;

const uploadAccess = requireRole(
  "OWNER",
  "ADMIN",
  "PROPERTY_MANAGER",
  "ACCOUNTANT",
  "STAFF",
);

const manageAccess = requireRole(
  "OWNER",
  "ADMIN",
  "PROPERTY_MANAGER",
);

const documentTypeSchema = z.enum([
  "PROPERTY",
  "TENANT",
  "LEASE",
  "MAINTENANCE",
  "RECEIPT",
  "OTHER",
]);

const documentStatusSchema = z.enum([
  "PENDING_UPLOAD",
  "ACTIVE",
  "ARCHIVED",
  "DELETED",
]);

const mimeTypeSchema = z.enum([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const allowedExtensions:
  Record<string, string[]> = {
    "application/pdf": [
      ".pdf",
    ],

    "image/jpeg": [
      ".jpg",
      ".jpeg",
    ],

    "image/png": [
      ".png",
    ],

    "image/webp": [
      ".webp",
    ],

    "application/msword": [
      ".doc",
    ],

    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      [
        ".docx",
      ],
  };

const uploadIntentSchema =
  z.object({
    documentType:
      documentTypeSchema,

    title: z
      .string()
      .trim()
      .min(1)
      .max(200),

    description: z
      .string()
      .trim()
      .max(5000)
      .nullable()
      .optional(),

    fileName: z
      .string()
      .trim()
      .min(1)
      .max(255),

    mimeType:
      mimeTypeSchema,

    fileSize: z.coerce
      .number()
      .int()
      .positive()
      .max(MAX_FILE_SIZE),

    propertyId: z
      .string()
      .uuid()
      .nullable()
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

    leaseId: z
      .string()
      .uuid()
      .nullable()
      .optional(),

    maintenanceId: z
      .string()
      .uuid()
      .nullable()
      .optional(),

    receiptId: z
      .string()
      .uuid()
      .nullable()
      .optional(),
  });

const listSchema =
  z.object({
    documentType:
      documentTypeSchema.optional(),

    status:
      documentStatusSchema.optional(),

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

    leaseId: z
      .string()
      .uuid()
      .optional(),

    maintenanceId: z
      .string()
      .uuid()
      .optional(),

    receiptId: z
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

function safeFileName(
  value: string,
) {
  const withoutPath =
    value
      .replaceAll("\\", "/")
      .split("/")
      .pop() ?? "document";

  const cleaned =
    withoutPath
      .normalize("NFKC")
      .replace(
        /[^a-zA-Z0-9._ -]/g,
        "_",
      )
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^\.+/, "")
      .slice(0, 180);

  return cleaned || "document";
}

function validateExtension(
  fileName: string,
  mimeType: string,
) {
  const lower =
    fileName.toLowerCase();

  const extensions =
    allowedExtensions[
      mimeType
    ] ?? [];

  return extensions.some(
    (extension) =>
      lower.endsWith(
        extension,
      ),
  );
}

function documentError(
  error: {
    message?: string;
  },
  res: Response,
  next: NextFunction,
) {
  const message =
    error.message ?? "";

  const missing = [
    "DOCUMENT_PROPERTY_NOT_FOUND",
    "DOCUMENT_UNIT_NOT_FOUND",
    "DOCUMENT_TENANT_NOT_FOUND",
    "DOCUMENT_LEASE_NOT_FOUND",
    "DOCUMENT_MAINTENANCE_NOT_FOUND",
    "DOCUMENT_RECEIPT_NOT_FOUND",
  ];

  if (
    missing.some((code) =>
      message.includes(code),
    )
  ) {
    return res
      .status(404)
      .json({
        success: false,

        error: {
          code:
            "DOCUMENT_RESOURCE_NOT_FOUND",

          message:
            "A related resource could not be found.",
        },
      });
  }

  const conflicts = [
    "DOCUMENT_INVALID_STORAGE_BUCKET",
    "DOCUMENT_STORAGE_KEY_ORGANISATION_MISMATCH",
    "DOCUMENT_PROPERTY_ORGANISATION_MISMATCH",
    "DOCUMENT_UNIT_ORGANISATION_MISMATCH",
    "DOCUMENT_UNIT_PROPERTY_MISMATCH",
    "DOCUMENT_TENANT_ORGANISATION_MISMATCH",
    "DOCUMENT_LEASE_ORGANISATION_MISMATCH",
    "DOCUMENT_MAINTENANCE_ORGANISATION_MISMATCH",
    "DOCUMENT_RECEIPT_ORGANISATION_MISMATCH",
    "DOCUMENT_PROPERTY_REQUIRED",
    "DOCUMENT_TENANT_REQUIRED",
    "DOCUMENT_LEASE_REQUIRED",
    "DOCUMENT_MAINTENANCE_REQUIRED",
    "DOCUMENT_RECEIPT_REQUIRED",
    "DOCUMENT_CLOSED",
  ];

  if (
    conflicts.some((code) =>
      message.includes(code),
    )
  ) {
    return res
      .status(409)
      .json({
        success: false,

        error: {
          code:
            "DOCUMENT_CONFLICT",

          message:
            "The document conflicts with its organisation or related resource.",
        },
      });
  }

  return next(error);
}

/*
 * List organisation documents.
 */
router.get(
  "/",
  async (
    req,
    res,
    next,
  ) => {
    try {
      const organisationId =
        req.membership!
          .organisationId;

      const filters =
        listSchema.parse(
          req.query,
        );

      let query =
        supabase
          .from("documents")
          .select("*", {
            count: "exact",
          })
          .eq(
            "organisation_id",
            organisationId,
          )
          .order(
            "created_at",
            {
              ascending:
                false,
            },
          )
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
      } else {
        query = query.neq(
          "status",
          "DELETED",
        );
      }

      if (
        filters.documentType
      ) {
        query = query.eq(
          "document_type",
          filters.documentType,
        );
      }

      if (
        filters.propertyId
      ) {
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

      if (filters.leaseId) {
        query = query.eq(
          "lease_id",
          filters.leaseId,
        );
      }

      if (
        filters.maintenanceId
      ) {
        query = query.eq(
          "maintenance_id",
          filters.maintenanceId,
        );
      }

      if (
        filters.receiptId
      ) {
        query = query.eq(
          "receipt_id",
          filters.receiptId,
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

        data:
          data ?? [],

        meta: {
          total:
            count ?? 0,

          limit:
            filters.limit,

          offset:
            filters.offset,
        },
      });
    } catch (error) {
      return next(error);
    }
  },
);

/*
 * Get one document record.
 */
router.get(
  "/:id",
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

      const organisationId =
        req.membership!
          .organisationId;

      const {
        data,
        error,
      } = await supabase
        .from("documents")
        .select("*")
        .eq(
          "id",
          documentId,
        )
        .eq(
          "organisation_id",
          organisationId,
        )
        .neq(
          "status",
          "DELETED",
        )
        .maybeSingle();

      if (error) {
        return next(error);
      }

      if (!data) {
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
 * Create document metadata and issue
 * a temporary signed upload token.
 */
router.post(
  "/upload-intent",
  uploadAccess,
  async (
    req,
    res,
    next,
  ) => {
    try {
      const body =
        uploadIntentSchema.parse(
          req.body,
        );

      if (
        !validateExtension(
          body.fileName,
          body.mimeType,
        )
      ) {
        return res
          .status(400)
          .json({
            success: false,

            error: {
              code:
                "INVALID_FILE_EXTENSION",

              message:
                "The file extension does not match the declared file type.",
            },
          });
      }

      const organisationId =
        req.membership!
          .organisationId;

      const actorId =
        req.user!.id;

      const documentId =
        randomUUID();

      const fileName =
        safeFileName(
          body.fileName,
        );

      const storageKey =
        `${organisationId}/${documentId}/${fileName}`;

      const {
        data: document,
        error:
          documentInsertError,
      } = await supabase
        .from("documents")
        .insert({
          id:
            documentId,

          organisation_id:
            organisationId,

          property_id:
            body.propertyId ??
            null,

          unit_id:
            body.unitId ??
            null,

          tenant_id:
            body.tenantId ??
            null,

          lease_id:
            body.leaseId ??
            null,

          maintenance_id:
            body.maintenanceId ??
            null,

          receipt_id:
            body.receiptId ??
            null,

          document_type:
            body.documentType,

          title:
            body.title,

          description:
            body.description ??
            null,

          file_name:
            fileName,

          mime_type:
            body.mimeType,

          file_size:
            body.fileSize,

          storage_bucket:
            STORAGE_BUCKET,

          storage_key:
            storageKey,

          status:
            "PENDING_UPLOAD",

          uploaded_by:
            actorId,

          updated_by:
            actorId,
        })
        .select()
        .single();

      if (
        documentInsertError
      ) {
        return documentError(
          documentInsertError,
          res,
          next,
        );
      }

      const {
        data:
          signedUpload,
        error:
          signedUploadError,
      } =
        await supabase.storage
          .from(
            STORAGE_BUCKET,
          )
          .createSignedUploadUrl(
            storageKey,
            {
              upsert: false,
            },
          );

      if (
        signedUploadError ||
        !signedUpload
      ) {
        await supabase
          .from("documents")
          .delete()
          .eq(
            "id",
            documentId,
          )
          .eq(
            "organisation_id",
            organisationId,
          )
          .eq(
            "status",
            "PENDING_UPLOAD",
          );

        if (
          signedUploadError
        ) {
          return next(
            signedUploadError,
          );
        }

        return res
          .status(500)
          .json({
            success: false,

            error: {
              code:
                "UPLOAD_TOKEN_FAILED",

              message:
                "Unable to prepare the document upload.",
            },
          });
      }

      return res
        .status(201)
        .json({
          success: true,

          data: {
            document,

            upload: {
              bucket:
                STORAGE_BUCKET,

              path:
                signedUpload.path,

              token:
                signedUpload.token,
            },
          },
        });
    } catch (error) {
      return next(error);
    }
  },
);

/*
 * Verify that the object exists in
 * private storage and mark the
 * document ACTIVE.
 *
 * This endpoint is idempotent.
 */
router.post(
  "/:id/complete",
  uploadAccess,
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

      const organisationId =
        req.membership!
          .organisationId;

      const {
        data: document,
        error:
          documentErrorResult,
      } = await supabase
        .from("documents")
        .select("*")
        .eq(
          "id",
          documentId,
        )
        .eq(
          "organisation_id",
          organisationId,
        )
        .maybeSingle();

      if (
        documentErrorResult
      ) {
        return next(
          documentErrorResult,
        );
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

      if (
        document.status ===
        "ACTIVE"
      ) {
        return res.json({
          success: true,
          data: document,
        });
      }

      if (
        document.status !==
        "PENDING_UPLOAD"
      ) {
        return res
          .status(409)
          .json({
            success: false,

            error: {
              code:
                "DOCUMENT_NOT_PENDING",

              message:
                "Only pending uploads can be completed.",
            },
          });
      }

      const storageKey =
        String(
          document.storage_key,
        );

      const parts =
        storageKey.split("/");

      const fileName =
        parts.pop();

      const folder =
        parts.join("/");

      if (!fileName) {
        return res
          .status(500)
          .json({
            success: false,

            error: {
              code:
                "INVALID_STORAGE_KEY",

              message:
                "The document storage key is invalid.",
            },
          });
      }

      const {
        data: files,
        error:
          storageError,
      } =
        await supabase.storage
          .from(
            STORAGE_BUCKET,
          )
          .list(
            folder,
            {
              limit: 100,
              search:
                fileName,
            },
          );

      if (storageError) {
        return next(
          storageError,
        );
      }

      const storedFile =
        files?.find(
          (file) =>
            file.name ===
            fileName &&
            file.id !== null,
        );

      if (!storedFile) {
        return res
          .status(409)
          .json({
            success: false,

            error: {
              code:
                "DOCUMENT_UPLOAD_MISSING",

              message:
                "The uploaded file could not be found in storage.",
            },
          });
      }

      const metadata =
        (storedFile.metadata ?? {}) as Record<
          string,
          unknown
        >;

      const rawStoredSize =
        metadata["size"];

      const storedSize =
        typeof rawStoredSize === "number"
          ? rawStoredSize
          : typeof rawStoredSize === "string"
            ? Number(rawStoredSize)
            : 0;

      if (
        storedSize > 0 &&
        storedSize !==
          Number(
            document.file_size,
          )
      ) {
        await supabase.storage
          .from(
            STORAGE_BUCKET,
          )
          .remove([
            storageKey,
          ]);

        return res
          .status(409)
          .json({
            success: false,

            error: {
              code:
                "DOCUMENT_SIZE_MISMATCH",

              message:
                "The uploaded file size does not match the upload request.",
            },
          });
      }

      const rawStoredMime =
        metadata["mimetype"] ??
        metadata["contentType"];

      const storedMime =
        typeof rawStoredMime === "string"
          ? rawStoredMime
          : null;

      if (
        storedMime &&
        storedMime !==
          document.mime_type
      ) {
        await supabase.storage
          .from(
            STORAGE_BUCKET,
          )
          .remove([
            storageKey,
          ]);

        return res
          .status(409)
          .json({
            success: false,

            error: {
              code:
                "DOCUMENT_TYPE_MISMATCH",

              message:
                "The uploaded file type does not match the upload request.",
            },
          });
      }

      const {
        data: activeDocument,
        error:
          activationError,
      } = await supabase
        .from("documents")
        .update({
          status:
            "ACTIVE",

          updated_by:
            req.user!.id,
        })
        .eq(
          "id",
          documentId,
        )
        .eq(
          "organisation_id",
          organisationId,
        )
        .eq(
          "status",
          "PENDING_UPLOAD",
        )
        .select()
        .single();

      if (activationError) {
        return documentError(
          activationError,
          res,
          next,
        );
      }

      return res.json({
        success: true,
        data:
          activeDocument,
      });
    } catch (error) {
      return next(error);
    }
  },
);

/*
 * Issue a short-lived private
 * download URL.
 */
router.get(
  "/:id/download",
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

      const organisationId =
        req.membership!
          .organisationId;

      const {
        data: document,
        error:
          documentErrorResult,
      } = await supabase
        .from("documents")
        .select(
          `
          id,
          organisation_id,
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
          "organisation_id",
          organisationId,
        )
        .eq(
          "status",
          "ACTIVE",
        )
        .maybeSingle();

      if (
        documentErrorResult
      ) {
        return next(
          documentErrorResult,
        );
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
                "Active document not found.",
            },
          });
      }

      const {
        data,
        error,
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

      if (error) {
        return next(error);
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
            data.signedUrl,
        },
      });
    } catch (error) {
      return next(error);
    }
  },
);

/*
 * Archive a document without
 * destroying the underlying audit
 * history or storage object.
 */
router.patch(
  "/:id/archive",
  manageAccess,
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

      const organisationId =
        req.membership!
          .organisationId;

      const {
        data,
        error,
      } = await supabase
        .from("documents")
        .update({
          status:
            "ARCHIVED",

          updated_by:
            req.user!.id,
        })
        .eq(
          "id",
          documentId,
        )
        .eq(
          "organisation_id",
          organisationId,
        )
        .eq(
          "status",
          "ACTIVE",
        )
        .select()
        .maybeSingle();

      if (error) {
        return documentError(
          error,
          res,
          next,
        );
      }

      if (!data) {
        return res
          .status(404)
          .json({
            success: false,

            error: {
              code:
                "ACTIVE_DOCUMENT_NOT_FOUND",

              message:
                "Active document not found.",
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

export default router;

import {
  Router,
} from "express";

import {
  z,
} from "zod";

import {
  supabase,
} from "../config/supabase.js";

const router = Router();

const notificationIdSchema =
  z.string().uuid();

function getUserId(
  req: {
    user?: {
      id: string;
    };
  },
) {
  if (!req.user?.id) {
    throw new Error(
      "Authenticated user is required.",
    );
  }

  return req.user.id;
}

/*
 * Only notifications belonging to the
 * authenticated recipient are returned.
 *
 * This filter is required even though
 * database RLS exists because the API's
 * service client bypasses RLS.
 */
router.get(
  "/",
  async (
    req,
    res,
    next,
  ) => {
    try {
      const userId =
        getUserId(req);

      const limit =
        Math.min(
          Math.max(
            Number(
              req.query.limit ??
                30,
            ),
            1,
          ),
          100,
        );

      const unreadOnly =
        req.query.unread ===
        "true";

      let query =
        supabase
          .from("notifications")
          .select(
            `
            id,
            organisation_id,
            type,
            title,
            message,
            resource_type,
            resource_id,
            metadata,
            read_at,
            created_at
            `,
          )
          .eq(
            "recipient_user_id",
            userId,
          )
          .order(
            "created_at",
            {
              ascending: false,
            },
          )
          .limit(limit);

      if (unreadOnly) {
        query =
          query.is(
            "read_at",
            null,
          );
      }

      const {
        data,
        error,
      } = await query;

      if (error) {
        return next(error);
      }

      return res.json({
        success: true,
        data: data ?? [],
      });
    } catch (error) {
      return next(error);
    }
  },
);

router.get(
  "/unread-count",
  async (
    req,
    res,
    next,
  ) => {
    try {
      const userId =
        getUserId(req);

      const {
        count,
        error,
      } = await supabase
        .from("notifications")
        .select(
          "id",
          {
            count: "exact",
            head: true,
          },
        )
        .eq(
          "recipient_user_id",
          userId,
        )
        .is(
          "read_at",
          null,
        );

      if (error) {
        return next(error);
      }

      return res.json({
        success: true,
        data: {
          unreadCount:
            count ?? 0,
        },
      });
    } catch (error) {
      return next(error);
    }
  },
);

router.patch(
  "/read-all",
  async (
    req,
    res,
    next,
  ) => {
    try {
      const userId =
        getUserId(req);

      const {
        error,
      } = await supabase
        .from("notifications")
        .update({
          read_at:
            new Date()
              .toISOString(),
        })
        .eq(
          "recipient_user_id",
          userId,
        )
        .is(
          "read_at",
          null,
        );

      if (error) {
        return next(error);
      }

      return res.json({
        success: true,
      });
    } catch (error) {
      return next(error);
    }
  },
);

router.patch(
  "/:id/read",
  async (
    req,
    res,
    next,
  ) => {
    try {
      const userId =
        getUserId(req);

      const id =
        notificationIdSchema.parse(
          req.params.id,
        );

      const {
        data,
        error,
      } = await supabase
        .from("notifications")
        .update({
          read_at:
            new Date()
              .toISOString(),
        })
        .eq("id", id)
        .eq(
          "recipient_user_id",
          userId,
        )
        .select(
          `
          id,
          read_at
          `,
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
                "NOTIFICATION_NOT_FOUND",

              message:
                "Notification not found.",
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

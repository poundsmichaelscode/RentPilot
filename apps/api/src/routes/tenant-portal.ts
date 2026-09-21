import { Router } from "express";

import { supabase } from "../config/supabase.js";

const router = Router();

router.get(
  "/",
  async (req, res, next) => {
    try {
      const userId = req.user!.id;

      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select(
          `
          id,
          email,
          full_name,
          phone,
          role
          `,
        )
        .eq("id", userId)
        .maybeSingle();

      if (profileError) {
        return next(profileError);
      }

      if (!profile) {
        return res.status(404).json({
          success: false,
          error: {
            code: "PROFILE_NOT_FOUND",
            message: "Account profile not found.",
          },
        });
      }

      if (profile.role !== "tenant") {
        return res.status(403).json({
          success: false,
          error: {
            code: "TENANT_ACCOUNT_REQUIRED",
            message:
              "This portal is available to tenant accounts only.",
          },
        });
      }

      /*
       * Tenant identity is derived from the authenticated
       * profile ID. The client never supplies organisation,
       * tenant or lease IDs for workspace discovery.
       */
      const {
        data: tenantRecords,
        error: tenantsError,
      } = await supabase
        .from("tenants")
        .select("*")
        .eq("profile_id", userId)
        .order("created_at", {
          ascending: false,
        });

      if (tenantsError) {
        return next(tenantsError);
      }

      const tenants =
        tenantRecords ?? [];

      const tenantIds =
        tenants.map(
          (tenant) => tenant.id,
        );

      /*
       * A tenant may exist in more than one organisation,
       * so keep the data model capable of multiple leases.
       */
      let leases: any[] = [];

      if (tenantIds.length > 0) {
        const {
          data,
          error,
        } = await supabase
          .from("leases")
          .select("*")
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

        if (error) {
          return next(error);
        }

        leases = data ?? [];
      }

      const leaseIds =
        leases.map(
          (lease) => lease.id,
        );

      const unitIds = [
        ...new Set(
          leases.map(
            (lease) =>
              lease.unit_id,
          ),
        ),
      ];

      let units: any[] = [];

      if (unitIds.length > 0) {
        const {
          data,
          error,
        } = await supabase
          .from("units")
          .select("*")
          .in(
            "id",
            unitIds,
          );

        if (error) {
          return next(error);
        }

        units = data ?? [];
      }

      const propertyIds = [
        ...new Set(
          units.map(
            (unit) =>
              unit.property_id,
          ),
        ),
      ];

      let properties: any[] = [];

      if (propertyIds.length > 0) {
        const {
          data,
          error,
        } = await supabase
          .from("properties")
          .select(
            `
            id,
            name,
            address,
            city,
            state,
            country,
            property_type,
            description
            `,
          )
          .in(
            "id",
            propertyIds,
          );

        if (error) {
          return next(error);
        }

        properties =
          data ?? [];
      }

      let charges: any[] = [];
      let payments: any[] = [];

      if (leaseIds.length > 0) {
        const [
          chargeResult,
          paymentResult,
        ] = await Promise.all([
          supabase
            .from("rent_charges")
            .select("*")
            .in(
              "lease_id",
              leaseIds,
            )
            .order(
              "due_date",
              {
                ascending: true,
              },
            ),

          supabase
            .from("rent_payments")
            .select("*")
            .in(
              "lease_id",
              leaseIds,
            )
            .order(
              "payment_date",
              {
                ascending: false,
              },
            ),
        ]);

        if (chargeResult.error) {
          return next(
            chargeResult.error,
          );
        }

        if (paymentResult.error) {
          return next(
            paymentResult.error,
          );
        }

        charges =
          chargeResult.data ?? [];

        payments =
          paymentResult.data ?? [];
      }

      const paymentIds =
        payments.map(
          (payment) =>
            payment.id,
        );

      let receipts: any[] = [];

      if (paymentIds.length > 0) {
        const {
          data,
          error,
        } = await supabase
          .from("receipts")
          .select("*")
          .in(
            "payment_id",
            paymentIds,
          )
          .order(
            "issued_at",
            {
              ascending: false,
            },
          );

        if (error) {
          return next(error);
        }

        receipts =
          data ?? [];
      }

      let maintenance: any[] = [];

      if (tenantIds.length > 0) {
        const {
          data,
          error,
        } = await supabase
          .from(
            "maintenance_requests",
          )
          .select("*")
          .in(
            "tenant_id",
            tenantIds,
          )
          .order(
            "created_at",
            {
              ascending: false,
            },
          );

        if (error) {
          return next(error);
        }

        maintenance =
          data ?? [];
      }

      let documents: any[] = [];

      if (
        tenantIds.length > 0 ||
        leaseIds.length > 0
      ) {
        const filters: string[] =
          [];

        for (const tenantId of tenantIds) {
          filters.push(
            `tenant_id.eq.${tenantId}`,
          );
        }

        for (const leaseId of leaseIds) {
          filters.push(
            `lease_id.eq.${leaseId}`,
          );
        }

        if (filters.length > 0) {
          const {
            data,
            error,
          } = await supabase
            .from("documents")
            .select("*")
            .or(
              filters.join(","),
            )
            .eq(
              "status",
              "ACTIVE",
            )
            .order(
              "created_at",
              {
                ascending: false,
              },
            );

          if (error) {
            return next(error);
          }

          documents =
            data ?? [];
        }
      }

      return res.json({
        success: true,

        data: {
          profile,
          tenants,
          leases,
          units,
          properties,
          charges,
          payments,
          receipts,
          maintenance,
          documents,
        },
      });
    } catch (error) {
      return next(error);
    }
  },
);

export default router;

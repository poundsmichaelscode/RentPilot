import assert from "node:assert/strict";
import {
  describe,
  it,
} from "node:test";

import {
  canViewAuditLog,
} from "./audit-access.js";

describe(
  "audit log authorization",
  () => {
    it(
      "allows OWNER",
      () => {
        assert.equal(
          canViewAuditLog(
            "OWNER",
          ),
          true,
        );
      },
    );

    it(
      "allows ADMIN",
      () => {
        assert.equal(
          canViewAuditLog(
            "ADMIN",
          ),
          true,
        );
      },
    );

    it(
      "denies PROPERTY_MANAGER",
      () => {
        assert.equal(
          canViewAuditLog(
            "PROPERTY_MANAGER",
          ),
          false,
        );
      },
    );

    it(
      "denies ACCOUNTANT",
      () => {
        assert.equal(
          canViewAuditLog(
            "ACCOUNTANT",
          ),
          false,
        );
      },
    );

    it(
      "denies missing roles",
      () => {
        assert.equal(
          canViewAuditLog(
            undefined,
          ),
          false,
        );
      },
    );
  },
);

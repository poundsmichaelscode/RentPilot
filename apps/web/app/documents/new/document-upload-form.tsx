"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

import { apiFetch } from "../../../lib/api";
import styles from "../../management.module.css";

const MAX_FILE_SIZE =
  10 * 1024 * 1024;

const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

type Property = {
  id: string;
  name: string;
};

type Tenant = {
  id: string;
  full_name: string;
};

type Lease = {
  id: string;
  tenant_id: string;
  unit_id: string;
  status: string;
};

type MaintenanceRequest = {
  id: string;
  title: string;
  status: string;
};

type ListResponse<T> = {
  success: true;
  data: T[];
};

type UploadIntentResponse = {
  success: true;

  data: {
    document: {
      id: string;
    };

    upload: {
      bucket: string;
      path: string;
      token: string;
    };
  };
};

const supabaseUrl =
  process.env
    .NEXT_PUBLIC_SUPABASE_URL;

const supabaseKey =
  process.env
    .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Supabase browser configuration is missing.",
  );
}

const browserSupabase =
  createClient(
    supabaseUrl,
    supabaseKey,
  );

export default function DocumentUploadForm() {
  const router = useRouter();

  const [properties, setProperties] =
    useState<Property[]>([]);

  const [tenants, setTenants] =
    useState<Tenant[]>([]);

  const [leases, setLeases] =
    useState<Lease[]>([]);

  const [maintenance, setMaintenance] =
    useState<MaintenanceRequest[]>([]);

  const [documentType, setDocumentType] =
    useState("OTHER");

  const [title, setTitle] =
    useState("");

  const [description, setDescription] =
    useState("");

  const [propertyId, setPropertyId] =
    useState("");

  const [tenantId, setTenantId] =
    useState("");

  const [leaseId, setLeaseId] =
    useState("");

  const [
    maintenanceId,
    setMaintenanceId,
  ] = useState("");

  const [file, setFile] =
    useState<File | null>(null);

  const [loading, setLoading] =
    useState(false);

  const [loadingOptions, setLoadingOptions] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [
          propertyResponse,
          tenantResponse,
          leaseResponse,
          maintenanceResponse,
        ] = await Promise.all([
          apiFetch<ListResponse<Property>>(
            "/properties",
          ),

          apiFetch<ListResponse<Tenant>>(
            "/tenants",
          ),

          apiFetch<ListResponse<Lease>>(
            "/leases",
          ),

          apiFetch<
            ListResponse<MaintenanceRequest>
          >(
            "/maintenance",
          ),
        ]);

        setProperties(
          propertyResponse.data,
        );

        setTenants(
          tenantResponse.data,
        );

        setLeases(
          leaseResponse.data,
        );

        setMaintenance(
          maintenanceResponse.data,
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load document options.",
        );
      } finally {
        setLoadingOptions(false);
      }
    }

    void load();
  }, []);

  const activeLeases = useMemo(
    () =>
      leases.filter((lease) =>
        [
          "ACTIVE",
          "EXPIRING_SOON",
          "DRAFT",
        ].includes(lease.status),
      ),
    [leases],
  );

  function changeDocumentType(
    nextType: string,
  ) {
    setDocumentType(nextType);

    setPropertyId("");
    setTenantId("");
    setLeaseId("");
    setMaintenanceId("");
  }

  function chooseFile(
    selected: File | null,
  ) {
    setError(null);

    if (!selected) {
      setFile(null);
      return;
    }

    if (
      selected.size >
      MAX_FILE_SIZE
    ) {
      setFile(null);

      setError(
        "File must be 10 MB or smaller.",
      );

      return;
    }

    if (
      !ALLOWED_TYPES.includes(
        selected.type,
      )
    ) {
      setFile(null);

      setError(
        "Allowed files: PDF, JPG, PNG, WebP, DOC and DOCX.",
      );

      return;
    }

    setFile(selected);

    if (!title) {
      setTitle(
        selected.name.replace(
          /\.[^.]+$/,
          "",
        ),
      );
    }
  }

  async function submit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!file) {
      setError(
        "Choose a document to upload.",
      );
      return;
    }

    if (
      documentType === "PROPERTY" &&
      !propertyId
    ) {
      setError(
        "Choose a property.",
      );
      return;
    }

    if (
      documentType === "TENANT" &&
      !tenantId
    ) {
      setError(
        "Choose a tenant.",
      );
      return;
    }

    if (
      documentType === "LEASE" &&
      !leaseId
    ) {
      setError(
        "Choose a lease.",
      );
      return;
    }

    if (
      documentType ===
        "MAINTENANCE" &&
      !maintenanceId
    ) {
      setError(
        "Choose a maintenance request.",
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const intent =
        await apiFetch<UploadIntentResponse>(
          "/documents/upload-intent",
          {
            method: "POST",

            body: JSON.stringify({
              documentType,
              title,
              description:
                description ||
                undefined,

              fileName:
                file.name,

              mimeType:
                file.type,

              fileSize:
                file.size,

              propertyId:
                propertyId ||
                undefined,

              tenantId:
                tenantId ||
                undefined,

              leaseId:
                leaseId ||
                undefined,

              maintenanceId:
                maintenanceId ||
                undefined,
            }),
          },
        );

      const {
        document,
        upload,
      } = intent.data;

      const {
        error: uploadError,
      } =
        await browserSupabase.storage
          .from(upload.bucket)
          .uploadToSignedUrl(
            upload.path,
            upload.token,
            file,
            {
              contentType:
                file.type,
              cacheControl:
                "3600",
            },
          );

      if (uploadError) {
        throw new Error(
          uploadError.message,
        );
      }

      await apiFetch(
        `/documents/${document.id}/complete`,
        {
          method: "POST",
        },
      );

      router.replace(
        "/documents",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to upload document.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <div
        className={styles.shell}
        style={{ maxWidth: 850 }}
      >
        <div className={styles.topbar}>
          <Link
            className={styles.back}
            href="/documents"
          >
            ← Documents
          </Link>
        </div>

        <header className={styles.header}>
          <div>
            <span className={styles.eyebrow}>
              SECURE STORAGE
            </span>

            <h1>
              Upload document
            </h1>

            <p>
              Files are stored privately
              and accessed using temporary
              signed links.
            </p>
          </div>
        </header>

        <section className={styles.card}>
          {loadingOptions ? (
            <div className={styles.empty}>
              Loading workspace…
            </div>
          ) : (
            <form
              className={styles.form}
              onSubmit={submit}
            >
              <div className={styles.grid}>
                <label>
                  Document type

                  <select
                    value={documentType}
                    onChange={(event) =>
                      changeDocumentType(
                        event.target.value,
                      )
                    }
                  >
                    <option value="PROPERTY">
                      Property
                    </option>

                    <option value="TENANT">
                      Tenant
                    </option>

                    <option value="LEASE">
                      Lease
                    </option>

                    <option value="MAINTENANCE">
                      Maintenance
                    </option>

                    <option value="OTHER">
                      Other
                    </option>
                  </select>
                </label>

                {documentType ===
                "PROPERTY" ? (
                  <label>
                    Property

                    <select
                      required
                      value={propertyId}
                      onChange={(event) =>
                        setPropertyId(
                          event.target.value,
                        )
                      }
                    >
                      <option value="">
                        Choose property
                      </option>

                      {properties.map(
                        (property) => (
                          <option
                            key={
                              property.id
                            }
                            value={
                              property.id
                            }
                          >
                            {property.name}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                ) : null}

                {documentType ===
                "TENANT" ? (
                  <label>
                    Tenant

                    <select
                      required
                      value={tenantId}
                      onChange={(event) =>
                        setTenantId(
                          event.target.value,
                        )
                      }
                    >
                      <option value="">
                        Choose tenant
                      </option>

                      {tenants.map(
                        (tenant) => (
                          <option
                            key={tenant.id}
                            value={
                              tenant.id
                            }
                          >
                            {
                              tenant.full_name
                            }
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                ) : null}

                {documentType ===
                "LEASE" ? (
                  <label>
                    Lease

                    <select
                      required
                      value={leaseId}
                      onChange={(event) =>
                        setLeaseId(
                          event.target.value,
                        )
                      }
                    >
                      <option value="">
                        Choose lease
                      </option>

                      {activeLeases.map(
                        (lease) => (
                          <option
                            key={lease.id}
                            value={
                              lease.id
                            }
                          >
                            Lease{" "}
                            {lease.id.slice(
                              0,
                              8,
                            )}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                ) : null}

                {documentType ===
                "MAINTENANCE" ? (
                  <label>
                    Maintenance request

                    <select
                      required
                      value={
                        maintenanceId
                      }
                      onChange={(event) =>
                        setMaintenanceId(
                          event.target.value,
                        )
                      }
                    >
                      <option value="">
                        Choose request
                      </option>

                      {maintenance.map(
                        (request) => (
                          <option
                            key={
                              request.id
                            }
                            value={
                              request.id
                            }
                          >
                            {request.title}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                ) : null}

                <label
                  className={styles.full}
                >
                  Title

                  <input
                    required
                    maxLength={200}
                    value={title}
                    onChange={(event) =>
                      setTitle(
                        event.target.value,
                      )
                    }
                  />
                </label>

                <label
                  className={styles.full}
                >
                  Description

                  <textarea
                    rows={3}
                    maxLength={5000}
                    value={description}
                    onChange={(event) =>
                      setDescription(
                        event.target.value,
                      )
                    }
                  />
                </label>

                <label
                  className={styles.full}
                >
                  File

                  <input
                    required
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                    onChange={(event) =>
                      chooseFile(
                        event.target
                          .files?.[0] ??
                          null,
                      )
                    }
                  />

                  <small>
                    PDF, JPG, PNG, WebP,
                    DOC or DOCX. Maximum
                    10 MB.
                  </small>
                </label>
              </div>

              {file ? (
                <div className={styles.card}>
                  <strong>
                    {file.name}
                  </strong>

                  <p>
                    {(
                      file.size /
                      (1024 * 1024)
                    ).toFixed(2)}{" "}
                    MB
                  </p>
                </div>
              ) : null}

              {error ? (
                <div
                  className={styles.error}
                  role="alert"
                >
                  {error}
                </div>
              ) : null}

              <div className={styles.actions}>
                <Link
                  className={
                    styles.secondary
                  }
                  href="/documents"
                >
                  Cancel
                </Link>

                <button
                  type="submit"
                  className={
                    styles.primary
                  }
                  disabled={
                    loading ||
                    !file
                  }
                >
                  {loading
                    ? "Uploading..."
                    : "Upload securely"}
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}

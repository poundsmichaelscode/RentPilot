"use client";

import {
  useEffect,
  useState,
} from "react";

import Link from "next/link";

import {
  apiFetch,
} from "../../../lib/api";

import styles from "../tenant.module.css";

type DocumentRecord = {
  id: string;
  title: string;
  description:
    | string
    | null;
  document_type: string;
  file_name: string;
  mime_type: string;
  file_size:
    | number
    | string;
  created_at: string;
  uploaded_at:
    | string
    | null;
};

type PortalResponse = {
  success: true;

  data: {
    documents:
      DocumentRecord[];
  };
};

type DownloadResponse = {
  success: true;

  data: {
    signedUrl: string;
    fileName: string;
    expiresIn: number;
  };
};

function humanize(
  value: string,
) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase(),
    );
}

function fileSize(
  value: number | string,
) {
  const bytes =
    Number(value || 0);

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (
    bytes <
    1024 * 1024
  ) {
    return `${(
      bytes / 1024
    ).toFixed(1)} KB`;
  }

  return `${(
    bytes /
    (1024 * 1024)
  ).toFixed(1)} MB`;
}

export default function TenantDocuments() {
  const [documents, setDocuments] =
    useState<DocumentRecord[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [actionId, setActionId] =
    useState<string | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const response =
          await apiFetch<PortalResponse>(
            "/tenant-portal",
          );

        setDocuments(
          response.data.documents ??
            [],
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load your documents.",
        );
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  async function download(
    documentId: string,
  ) {
    setActionId(documentId);
    setError(null);

    try {
      const response =
        await apiFetch<DownloadResponse>(
          `/tenant-portal/documents/${documentId}/download`,
        );

      window.location.assign(
        response.data.signedUrl,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to download document.",
      );
    } finally {
      setActionId(null);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <nav className={styles.topbar}>
          <Link
            className={styles.back}
            href="/dashboard"
          >
            ← My dashboard
          </Link>

          <div className={styles.nav}>
            <Link href="/tenant/lease">
              My lease
            </Link>

            <Link href="/tenant/payments">
              Payments
            </Link>

            <Link href="/tenant/maintenance/new">
              Report issue
            </Link>
          </div>
        </nav>

        <header className={styles.hero}>
          <span className={styles.eyebrow}>
            MY DOCUMENTS
          </span>

          <h1>
            Important rental documents.
          </h1>

          <p>
            View files securely shared
            with your tenant account or
            lease. Download links expire
            automatically.
          </p>
        </header>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.eyebrow}>
              SECURE FILES
            </span>

            <h2>
              Documents
            </h2>
          </div>

          {error ? (
            <div className={styles.error}>
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className={styles.loading}>
              Loading documents…
            </div>
          ) : documents.length === 0 ? (
            <div className={styles.empty}>
              No documents have been
              shared with your account
              yet.
            </div>
          ) : (
            <div
              className={
                styles.documentList
              }
            >
              {documents.map(
                (document) => (
                  <article
                    key={document.id}
                    className={
                      styles.documentRow
                    }
                  >
                    <div>
                      <span
                        className={
                          styles.eyebrow
                        }
                      >
                        {humanize(
                          document.document_type,
                        )}
                      </span>

                      <h3>
                        {document.title}
                      </h3>

                      <p>
                        {
                          document.file_name
                        }
                        {" · "}
                        {fileSize(
                          document.file_size,
                        )}
                        {" · "}
                        {new Date(
                          document.uploaded_at ??
                            document.created_at,
                        ).toLocaleDateString(
                          "en-NG",
                        )}
                      </p>
                    </div>

                    <button
                      type="button"
                      className={
                        styles.secondary
                      }
                      disabled={
                        actionId ===
                        document.id
                      }
                      onClick={() =>
                        void download(
                          document.id,
                        )
                      }
                    >
                      {actionId ===
                      document.id
                        ? "Preparing..."
                        : "Download"}
                    </button>
                  </article>
                ),
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

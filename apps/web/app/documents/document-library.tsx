"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";
import Link from "next/link";

import { apiFetch } from "../../lib/api";
import styles from "../management.module.css";

type DocumentRecord = {
  id: string;
  document_type: string;
  title: string;
  description: string | null;
  file_name: string;
  mime_type: string;
  file_size: number | string;
  status: string;
  uploaded_at: string | null;
  created_at: string;
};

type ListResponse = {
  success: true;
  data: DocumentRecord[];
};

type DownloadResponse = {
  success: true;
  data: {
    signedUrl: string;
    fileName: string;
    expiresIn: number;
  };
};

function humanize(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    );
}

function fileSize(value: number | string) {
  const bytes = Number(value);

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(
    bytes /
    (1024 * 1024)
  ).toFixed(1)} MB`;
}

export default function DocumentLibrary() {
  const [documents, setDocuments] =
    useState<DocumentRecord[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [actionId, setActionId] =
    useState<string | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);

      const response =
        await apiFetch<ListResponse>(
          "/documents?status=ACTIVE",
        );

      setDocuments(response.data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load documents.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function download(
    documentId: string,
  ) {
    setActionId(documentId);
    setError(null);

    try {
      const response =
        await apiFetch<DownloadResponse>(
          `/documents/${documentId}/download`,
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

  async function archive(
    documentId: string,
  ) {
    setActionId(documentId);
    setError(null);

    try {
      await apiFetch(
        `/documents/${documentId}/archive`,
        {
          method: "PATCH",
        },
      );

      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to archive document.",
      );
    } finally {
      setActionId(null);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.topbar}>
          <Link
            className={styles.back}
            href="/dashboard"
          >
            ← Dashboard
          </Link>

          <nav className={styles.nav}>
            <Link href="/maintenance">
              Maintenance
            </Link>

            <Link href="/leases">
              Leases
            </Link>

            <Link href="/rent">
              Rent
            </Link>
          </nav>
        </div>

        <header className={styles.header}>
          <div>
            <span className={styles.eyebrow}>
              SECURE STORAGE
            </span>

            <h1>Documents</h1>

            <p>
              Store lease, property,
              tenant and maintenance
              documents securely.
            </p>
          </div>

          <Link
            className={styles.primary}
            href="/documents/new"
          >
            + Upload document
          </Link>
        </header>

        {error ? (
          <div
            className={styles.error}
            role="alert"
          >
            {error}
          </div>
        ) : null}

        {loading ? (
          <section className={styles.card}>
            <div className={styles.empty}>
              Loading documents…
            </div>
          </section>
        ) : documents.length === 0 ? (
          <section className={styles.card}>
            <div className={styles.empty}>
              No active documents yet.
            </div>
          </section>
        ) : (
          <section className={styles.list}>
            {documents.map((document) => (
              <article
                key={document.id}
                className={styles.card}
              >
                <div className={styles.header}>
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

                    <h2>
                      {document.title}
                    </h2>

                    <p>
                      {document.file_name}
                    </p>
                  </div>

                  <div>
                    <strong>
                      {fileSize(
                        document.file_size,
                      )}
                    </strong>

                    <p>
                      {humanize(
                        document.status,
                      )}
                    </p>
                  </div>
                </div>

                {document.description ? (
                  <p>
                    {document.description}
                  </p>
                ) : null}

                <div
                  className={styles.actions}
                >
                  <small>
                    Uploaded{" "}
                    {new Date(
                      document.uploaded_at ??
                        document.created_at,
                    ).toLocaleDateString(
                      "en-NG",
                    )}
                  </small>

                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                    }}
                  >
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
                      Download
                    </button>

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
                        void archive(
                          document.id,
                        )
                      }
                    >
                      Archive
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}

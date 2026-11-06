/**
 * Server configuration, read from the environment.
 *
 * The service account may be supplied either as a JSON file path
 * (GOOGLE_APPLICATION_CREDENTIALS, the standard variable) or inline as
 * FIREBASE_SERVICE_ACCOUNT_JSON, which is convenient on platforms where the
 * secret is configured as an environment variable rather than a file.
 */

import { readFileSync } from 'node:fs';

export interface ServiceAccount {
  project_id?: string;
  client_email?: string;
  private_key?: string;
}

export interface Config {
  port: number;
  projectId: string;
  databaseURL: string;
  serviceAccount: ServiceAccount | null;
  /** Origins allowed to call the API. '*' allows any origin. */
  allowedOrigins: string[];
}

function readServiceAccount(): ServiceAccount | null {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (inline) {
    try {
      return JSON.parse(inline) as ServiceAccount;
    } catch (error) {
      throw new Error(
        `FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON: ${(error as Error).message}`,
      );
    }
  }

  const path = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (path) {
    return JSON.parse(readFileSync(path, 'utf8')) as ServiceAccount;
  }

  return null;
}

export function loadConfig(): Config {
  const projectId =
    process.env.FIREBASE_PROJECT_ID ??
    process.env.VITE_FIREBASE_PROJECT_ID ??
    readServiceAccount()?.project_id;

  const databaseURL =
    process.env.FIREBASE_DATABASE_URL ??
    process.env.VITE_FIREBASE_DATABASE_URL ??
    (projectId ? `https://${projectId}-default-rtdb.firebaseio.com` : undefined);

  if (!projectId) {
    throw new Error(
      'FIREBASE_PROJECT_ID is required (or provide a service account with a project_id).',
    );
  }
  if (!databaseURL) {
    throw new Error('FIREBASE_DATABASE_URL is required.');
  }

  const port = Number(process.env.PORT ?? 8080);
  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '*')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return {
    port,
    projectId,
    databaseURL,
    serviceAccount: readServiceAccount(),
    allowedOrigins,
  };
}

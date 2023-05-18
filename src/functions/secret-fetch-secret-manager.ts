import {
  InvalidSecretDefinitionError,
  SecretFetch,
  WorkspaceContext,
} from '@causa/workspace';
import { GoogleSecretManagerService } from '../services/index.js';

/**
 * The regular expression used to match the (Secret Manager) secret ID/name, and possibly its version and project.
 * [projects/<projectId>/secrets]<secretName>[/versions/<version>]
 */
const SECRET_ID_REGEX =
  /^(?:projects\/(?<projectId>[\w-]+)\/secrets\/)?(?<secretName>[\w-]+)(?:\/versions\/(?<version>(\d+|latest)))?$/;

/**
 * An error thrown when the default GCP project is needed to look up a secret but it has not been defined.
 */
export class UndefinedDefaultGcpProjectError extends Error {
  constructor() {
    super(
      'The default GCP project for the Google Secret Manager could not be found in the configuration.',
    );
  }
}

/**
 * An error thrown when the value returned by the Google Secret Manager client cannot be read as a string.
 */
export class UnexpectedSecretValueError extends Error {
  constructor() {
    super(
      'The secret value from the Google Secret Manager could not be parsed.',
    );
  }
}

/**
 * Implements {@link SecretFetch} for secrets using the Google Secret Manager backend (`google.secretManager`).
 *
 * ```yaml
 * secrets:
 *   simpleSecret:
 *     id: simple-secret
 *   secretWithProject:
 *     id: projects/gcp-project/secrets/my-secret
 *   secretWithVersion:
 *     id: projects/gcp-project/secrets/my-secret/versions/12
 * ```
 *
 * If not specified, the GCP project ID will be obtained from `google.secretManager.project`, or will fallback to
 * `google.project`.
 */
export class SecretFetchForGoogleSecretManager extends SecretFetch {
  async _call(context: WorkspaceContext): Promise<string> {
    const id = this.configuration.id as string | undefined;
    if (!id) {
      throw new InvalidSecretDefinitionError(
        `Missing 'id' field that should reference the secret.`,
      );
    }

    const match = id.match(SECRET_ID_REGEX);
    const secretName = match?.groups?.secretName;
    if (!secretName) {
      throw new InvalidSecretDefinitionError(
        `Failed to parse secret reference '${id}'.`,
      );
    }

    const { client, defaultProject } = context.service(
      GoogleSecretManagerService,
    );
    const project = match?.groups?.projectId ?? defaultProject;
    const version = match?.groups?.version ?? 'latest';
    if (!project) {
      throw new UndefinedDefaultGcpProjectError();
    }

    const name = client.secretVersionPath(project, secretName, version);
    const [value] = await client.accessSecretVersion({ name });

    const bufferData = value.payload?.data;
    if (!bufferData || typeof bufferData !== 'object') {
      throw new UnexpectedSecretValueError();
    }

    return bufferData.toString();
  }

  _supports(): boolean {
    return this.backend === 'google.secretManager';
  }
}

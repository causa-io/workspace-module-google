import {
  InvalidSecretDefinitionError,
  type WorkspaceContext,
} from '@causa/workspace';
import { GoogleSecretManagerService } from '../../services/index.js';
import {
  type SecretFetchForGoogleSecretManager,
  UndefinedDefaultGcpProjectError,
  UnexpectedSecretValueError,
} from './fetch-secret-manager.js';

/**
 * The regular expression used to match the (Secret Manager) secret ID/name, and possibly its version and project.
 * [projects/<projectId>/secrets]<secretName>[/versions/<version>]
 */
const SECRET_ID_REGEX =
  /^(?:projects\/(?<projectId>[\w-]+)\/secrets\/)?(?<secretName>[\w-]+)(?:\/versions\/(?<version>(\d+|latest)))?$/;

export default async function call(
  this: SecretFetchForGoogleSecretManager,
  context: WorkspaceContext,
): Promise<string> {
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

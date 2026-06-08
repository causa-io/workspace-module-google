/**
 * The regular expression matching a Cloud Run service resource ID
 * (e.g. `projects/<projectId>/locations/<location>/services/<name>`).
 * The `parent` and `name` named groups respectively capture the parent location resource and the short service name.
 */
export const CLOUD_RUN_SERVICE_ID_REGEX =
  /^(?<parent>projects\/[\w-]+\/locations\/[\w-]+)\/services\/(?<name>[\w-]+)$/;

/**
 * Returns the short service ID (the last path segment) for a full service resource name.
 */
export function shortServiceId(id: string): string {
  return id.split('/').at(-1) ?? id;
}

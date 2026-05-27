/**
 * The regular expression matching a Pub/Sub subscription resource ID
 * (e.g. `projects/<projectId>/subscriptions/<name>`).
 */
export const PUBSUB_SUBSCRIPTION_ID_REGEX =
  /^projects\/[\w-]+\/subscriptions\/[\w-]+$/;

/**
 * Returns the short subscription ID (the last path segment) for a full subscription resource name.
 */
export function shortSubscriptionId(id: string): string {
  return id.split('/').at(-1) ?? id;
}

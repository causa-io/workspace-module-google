import { ServicesClient } from '@google-cloud/run';
import { grpc } from 'google-gax';

/**
 * The role used to allow a service account to call a Cloud Run service.
 */
const INVOKER_ROLE = 'roles/run.invoker';

/**
 * A service to manage Cloud Run services.
 */
export class CloudRunService {
  /**
   * The Cloud Run client.
   */
  readonly servicesClient: ServicesClient;

  constructor() {
    this.servicesClient = new ServicesClient();
  }

  /**
   * Retrieves the URI at which a Cloud Run service is available and can be requested.
   *
   * @param serviceId The ID of the Cloud Run service.
   *   This should be in the format `projects/<projectId>/locations/<location>/services/<name>`.
   * @returns The URI at which the service is available.
   */
  async getServiceUri(serviceId: string): Promise<string> {
    const [service] = await this.servicesClient.getService({ name: serviceId });
    return service.uri ?? '';
  }

  /**
   * Allows a service account to call a Cloud Run service by editing the IAM policy bindings.
   *
   * @param serviceId The ID of the Cloud Run service.
   *   This should be in the format `projects/<projectId>/locations/<location>/services/<name>`.
   * @param serviceAccountEmail The email of the service account that should be allowed to call the service.
   */
  async addInvokerBinding(
    serviceId: string,
    serviceAccountEmail: string,
  ): Promise<void> {
    const [policy] = await this.servicesClient.getIamPolicy({
      resource: serviceId,
    });

    const members = [`serviceAccount:${serviceAccountEmail}`];
    const binding = { role: INVOKER_ROLE, members };
    policy.bindings = [...(policy.bindings ?? []), binding];

    await this.servicesClient.setIamPolicy(
      { resource: serviceId, policy },
      // This can occur due to eventual consistency when the service account is created.
      { retry: { retryCodes: [grpc.status.INVALID_ARGUMENT] } },
    );
  }

  /**
   * Removes a service account from the list of allowed invokers of a Cloud Run service.
   *
   * @param serviceId The ID of the Cloud Run service.
   *   This should be in the format `projects/<projectId>/locations/<location>/services/<name>`.
   * @param serviceAccountEmail The email of the service account that should be removed from the allowed invokers.
   */
  async removeInvokerBinding(
    serviceId: string,
    serviceAccountEmail: string,
  ): Promise<void> {
    const [policy] = await this.servicesClient.getIamPolicy({
      resource: serviceId,
    });

    policy.bindings = (policy.bindings ?? []).flatMap((binding) => {
      if (binding.role !== INVOKER_ROLE || binding.condition) {
        return binding;
      }

      // `includes` ensures that deleted service accounts (in the form of `deleted:serviceAccount:...`) are also removed
      // from the list.
      binding.members = binding.members?.filter(
        (member) => !member.includes(`serviceAccount:${serviceAccountEmail}`),
      );

      return binding.members?.length ? binding : [];
    });

    await this.servicesClient.setIamPolicy({
      resource: serviceId,
      policy,
    });
  }
}

import { ServicesClient, protos } from '@google-cloud/run';
import { grpc } from 'google-gax';
import { CLOUD_RUN_SERVICE_ID_REGEX } from './cloud-run.utils.js';

export {
  CLOUD_RUN_SERVICE_ID_REGEX,
  shortServiceId,
} from './cloud-run.utils.js';

/**
 * The possible ingress settings for a Cloud Run service.
 */
export const IngressTraffic = protos.google.cloud.run.v2.IngressTraffic;

/**
 * The role used to allow a service account to call a Cloud Run service.
 */
const INVOKER_ROLE = 'roles/run.invoker';

/**
 * Overrides that can be applied to a Cloud Run service copy.
 */
export type CloudRunServiceOverrides = {
  /**
   * The minimum number of instances for the service.
   */
  minInstanceCount?: number;

  /**
   * The maximum number of instances for the service.
   */
  maxInstanceCount?: number;

  /**
   * The maximum number of concurrent requests per instance.
   */
  requestConcurrency?: number;

  /**
   * The ingress setting for the copy. Defaults to the source service's ingress when not set.
   */
  ingress?: protos.google.cloud.run.v2.IngressTraffic;

  /**
   * Labels to set on the copy, merged on top of the source service's labels.
   */
  labels?: Record<string, string>;
};

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
   * Creates a copy of an existing Cloud Run service.
   * The copy reuses the source service's revision template (image, environment, runtime service account, etc.), ingress,
   * and labels, unless overridden through the options.
   *
   * @param sourceService The ID of the Cloud Run service to copy.
   *   This should be in the format `projects/<projectId>/locations/<location>/services/<name>`.
   * @param name The name of the service copy to create.
   * @param options Options for the copy.
   * @returns The created service copy.
   */
  async copy(
    sourceService: string,
    name: string,
    options: {
      /**
       * Overrides to apply to the copy. Unset scaling properties are inherited from the source service.
       */
      overrides?: CloudRunServiceOverrides;
    } = {},
  ): Promise<protos.google.cloud.run.v2.IService> {
    const match = sourceService.match(CLOUD_RUN_SERVICE_ID_REGEX);
    if (!match?.groups) {
      throw new Error(`Invalid Cloud Run service ID '${sourceService}'.`);
    }
    const { parent } = match.groups;

    const [source] = await this.servicesClient.getService({
      name: sourceService,
    });

    const { revision, ...template } = { ...source.template };

    const {
      minInstanceCount,
      maxInstanceCount,
      requestConcurrency,
      ingress,
      labels,
    } = options.overrides ?? {};
    if (minInstanceCount !== undefined || maxInstanceCount !== undefined) {
      template.scaling = {
        ...template.scaling,
        ...(minInstanceCount !== undefined ? { minInstanceCount } : {}),
        ...(maxInstanceCount !== undefined ? { maxInstanceCount } : {}),
      };
    }
    if (requestConcurrency !== undefined) {
      template.maxInstanceRequestConcurrency = requestConcurrency;
    }

    const service: protos.google.cloud.run.v2.IService = {
      template,
      ingress: ingress ?? source.ingress,
      labels: { ...source.labels, ...labels },
    };

    const [operation] = await this.servicesClient.createService({
      parent,
      serviceId: name,
      service,
    });
    const [created] = await operation.promise();

    return created;
  }

  /**
   * Deletes a Cloud Run service.
   * This tolerates the service not existing (e.g. when it was already deleted).
   *
   * @param name The ID of the Cloud Run service to delete.
   *   This should be in the format `projects/<projectId>/locations/<location>/services/<name>`.
   */
  async delete(name: string): Promise<void> {
    try {
      const [operation] = await this.servicesClient.deleteService({ name });
      await operation.promise();
    } catch (error: any) {
      if (error.code === grpc.status.NOT_FOUND) {
        return;
      }

      throw error;
    }
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

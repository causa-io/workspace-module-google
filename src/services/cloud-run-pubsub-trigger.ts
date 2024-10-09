import { WorkspaceContext } from '@causa/workspace';
import { EventTopicTriggerCreationError } from '@causa/workspace-core';
import { Subscription } from '@google-cloud/pubsub';
import { randomBytes } from 'crypto';
import type { Logger } from 'pino';
import type { GoogleConfiguration } from '../configurations/index.js';
import { CloudRunService } from './cloud-run.js';
import { IamService } from './iam.js';
import { PubSubService } from './pubsub.js';

/**
 * The service account that should be used by Pub/Sub to invoke Cloud Run services for a given backfill operation, along
 * with the corresponding resource ID that should be deleted as part of the backfill cleaning.
 */
type BackfillInvokerServiceAccount = {
  /**
   * The service account email that should be used by Pub/Sub when pushing messages to Cloud Run services.
   */
  serviceAccountEmail: string;

  /**
   * The resource ID of the service account that should be deleted as part of the backfill cleaning.
   */
  resourceId: string | null;
};

/**
 * A service that manages (creates) Pub/Sub triggers pointing to Cloud Run services.
 * This is used for backfilling operations. The reason it is a service is to persist temporary service accounts and IAM
 * grants, such that they can be reused within the same backfilling operation.
 */
export class CloudRunPubSubTriggerService {
  /**
   * The service managing Cloud Run resources.
   */
  private readonly cloudRunService: CloudRunService;

  /**
   * The service managing Pub/Sub resources.
   */
  private readonly pubSubService: PubSubService;

  /**
   * The service managing IAM permissions.
   */
  private readonly iamService: IamService;

  /**
   * A set of IAM bindings that have already been created.
   * This is used to avoid creating the same bindings multiple times within a single backfill operation.
   * An IAM binding allows the service account used by Pub/Sub for a single backfill operation to invoke a Cloud Run
   * service. The format of strings in this set is the one used to reference bindings during deletion as well, i.e.
   * `projects/<projectId>/locations/<location>/services/<name>/invokerBindings/<serviceAccountEmail>`.
   */
  private readonly invokerBindingIds = new Set<string>();

  /**
   * A map of backfill IDs to promises resolving to the service account email used by Pub/Sub to invoke Cloud Run
   * services for the backfill.
   */
  private readonly backfillInvokerServiceAccounts: Record<
    string,
    Promise<string>
  > = {};

  /**
   * The logger used by this service.
   */
  private readonly logger: Logger;

  /**
   * The ID of the GCP project in which resources should be created.
   */
  readonly projectId: string;

  constructor(context: WorkspaceContext) {
    this.cloudRunService = context.service(CloudRunService);
    this.pubSubService = context.service(PubSubService);
    this.iamService = context.service(IamService);
    this.logger = context.logger;

    this.projectId = context
      .asConfiguration<GoogleConfiguration>()
      .getOrThrow('google.project');
  }

  /**
   * Creates a service account that should be used by Pub/Sub to invoke Cloud Run services for a given backfill
   * operation.
   *
   * @param backfillId The ID of the backfilling operation.
   * @returns The service account email that should be used by Pub/Sub when pushing messages to Cloud Run services,
   *   along with the corresponding resource ID that should be deleted as part of the backfill cleaning.
   */
  private async createBackfillInvokerServiceAccount(
    backfillId: string,
  ): Promise<BackfillInvokerServiceAccount> {
    const serviceAccountId = `backfill-pubsub-${backfillId}`;
    const bindings = await this.pubSubService.getPushServiceAccountBindings();

    this.logger.info(
      `🛂 Creating Pub/Sub backfilling service account '${serviceAccountId}'.`,
    );
    const serviceAccount = await this.iamService.createServiceAccount(
      this.projectId,
      serviceAccountId,
      { bindings },
    );

    return {
      serviceAccountEmail: serviceAccount.email ?? '',
      resourceId: serviceAccount.name ?? null,
    };
  }

  /**
   * Gets or creates a service account that should be used by Pub/Sub to invoke Cloud Run services for a given backfill
   * operation.
   *
   * @param backfillId The ID of the backfilling operation.
   * @returns The service account email that should be used by Pub/Sub when pushing messages to Cloud Run services.
   *   If `resourceId` is not `null`, it should be added to the list of resources to delete as part of the backfill
   *   cleaning.
   */
  private async getBackfillInvokerServiceAccount(
    backfillId: string,
  ): Promise<BackfillInvokerServiceAccount> {
    const existingServiceAccountPromise =
      this.backfillInvokerServiceAccounts[backfillId];
    if (existingServiceAccountPromise) {
      return {
        serviceAccountEmail: await existingServiceAccountPromise,
        resourceId: null,
      };
    }

    const creationPromise =
      this.createBackfillInvokerServiceAccount(backfillId);
    this.backfillInvokerServiceAccounts[backfillId] = creationPromise.then(
      (result) => result.serviceAccountEmail,
    );

    return await creationPromise;
  }

  /**
   * Grants the invoker role to a service account for a given Cloud Run service.
   * This is used to allow Pub/Sub to invoke the Cloud Run service.
   * If a resource ID string is returned, it should be added to the list of resources to delete as part of the backfill
   * cleaning.
   *
   * @param serviceId The ID of the Cloud Run service.
   * @param pubSubServiceAccount The service account email for which the invoker role should be granted.
   * @returns The resource ID of the IAM binding that was created, or `null` if the binding already existed.
   */
  private async grantPubSubInvokerRole(
    serviceId: string,
    pubSubServiceAccount: string,
  ): Promise<string | null> {
    const invokerBindingId = `${serviceId}/invokerBindings/${pubSubServiceAccount}`;
    if (this.invokerBindingIds.has(invokerBindingId)) {
      return null;
    }
    this.invokerBindingIds.add(invokerBindingId);

    this.logger.info(
      `🛂 Granting invoker IAM role to backfilling service account '${pubSubServiceAccount}' for Cloud Run service '${serviceId}'.`,
    );
    await this.cloudRunService.addInvokerBinding(
      serviceId,
      pubSubServiceAccount,
    );

    return invokerBindingId;
  }

  /**
   * Creates a Pub/Sub subscription that will push messages to a Cloud Run service.
   *
   * @param backfillId The ID of the backfilling operation.
   * @param topicId The ID of the Pub/Sub topic to subscribe to.
   * @param serviceId The ID of the Cloud Run service to invoke.
   * @param path The HTTP endpoint of the Cloud Run service to invoke.
   * @param serviceAccountEmail The service account email that should be used by Pub/Sub when pushing messages to the
   *   Cloud Run service.
   * @returns The ID of the Pub/Sub subscription that was created. It should be added to the list of resources to delete
   *   as part of the backfill cleaning.
   */
  private async createSubscription(
    backfillId: string,
    topicId: string,
    serviceId: string,
    path: string,
    serviceAccountEmail: string,
  ): Promise<string> {
    const serviceUri = await this.cloudRunService.getServiceUri(serviceId);
    const pushEndpoint = `${serviceUri}${path}`;

    const subscriptionId = Subscription.formatName_(
      this.projectId,
      `backfill-${backfillId}-${randomBytes(3).toString('hex')}`,
    );

    this.logger.info(
      `📫 Creating Pub/Sub subscription '${subscriptionId}' for Cloud Run service '${serviceId}'.`,
    );

    await this.pubSubService.pubSub.createSubscription(
      topicId,
      subscriptionId,
      {
        pushConfig: { pushEndpoint, oidcToken: { serviceAccountEmail } },
        expirationPolicy: {},
        ackDeadlineSeconds: 60 * 10,
        retryPolicy: {
          minimumBackoff: { seconds: 1, nanos: 0 },
          maximumBackoff: { seconds: 60, nanos: 0 },
        },
      },
    );

    return subscriptionId;
  }

  /**
   * Creates a Pub/Sub trigger (push subscription) pointing to a Cloud Run service.
   * This requires several resources, such as:
   * - A service account that should be used by Pub/Sub to invoke Cloud Run services for the backfill.
   * - An IAM binding allowing the service account to invoke the Cloud Run service.
   * - A Pub/Sub subscription that will push messages to the Cloud Run service.
   * The IDs of these resources are returned, and should be deleted as part of the backfill cleaning.
   *
   * @param backfillId The ID of the backfilling operation.
   * @param topicId The ID of the Pub/Sub topic to subscribe to.
   * @param serviceId The ID of the Cloud Run service to invoke.
   * @param path The HTTP endpoint of the Cloud Run service to invoke.
   * @returns The IDs of the resources that were created. They should be added to the list of resources to delete as
   *   part of the backfill cleaning.
   */
  async create(
    backfillId: string,
    topicId: string,
    serviceId: string,
    path: string,
  ): Promise<string[]> {
    const resourceIds: string[] = [];

    try {
      const pubSubInvokerServiceAccount =
        await this.getBackfillInvokerServiceAccount(backfillId);
      if (pubSubInvokerServiceAccount.resourceId) {
        resourceIds.push(pubSubInvokerServiceAccount.resourceId);
      }

      const { serviceAccountEmail } = pubSubInvokerServiceAccount;
      const iamResourceId = await this.grantPubSubInvokerRole(
        serviceId,
        serviceAccountEmail,
      );
      if (iamResourceId) {
        resourceIds.push(iamResourceId);
      }

      const subscriptionId = await this.createSubscription(
        backfillId,
        topicId,
        serviceId,
        path,
        serviceAccountEmail,
      );
      resourceIds.push(subscriptionId);

      return resourceIds;
    } catch (error) {
      throw new EventTopicTriggerCreationError(error, resourceIds);
    }
  }
}

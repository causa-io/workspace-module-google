import type { ModuleRegistrationContext } from '@causa/workspace';
import {
  EmulatorStartForFirebaseStorage,
  EmulatorStartForFirestore,
  EmulatorStartForIdentityPlatform,
  EmulatorStartForPubSub,
  EmulatorStartForSpanner,
  EmulatorStopForFirebaseStorage,
  EmulatorStopForFirestore,
  EmulatorStopForIdentityPlatform,
  EmulatorStopForPubSub,
  EmulatorStopForSpanner,
} from './emulator/index.js';
import {
  EventTopicBrokerCreateTopicForPubSub,
  EventTopicBrokerCreateTriggerForCloudRun,
  EventTopicBrokerDeleteTopicForPubSub,
  EventTopicBrokerDeleteTriggerResourceForCloudRunInvokerRole,
  EventTopicBrokerDeleteTriggerResourceForPubSubSubscription,
  EventTopicBrokerDeleteTriggerResourceForServiceAccount,
  EventTopicBrokerGetTopicIdForPubSub,
  EventTopicBrokerPublishEventsForGoogle,
} from './event-topic/index.js';
import { GoogleAppCheckGenerateToken } from './google-app-check/index.js';
import { GoogleFirebaseStorageMergeRules } from './google-firebase-storage/index.js';
import { GoogleFirestoreMergeRules } from './google-firestore/index.js';
import {
  GoogleIdentityPlatformGenerateCustomToken,
  GoogleIdentityPlatformGenerateToken,
} from './google-identity-platform/index.js';
import { GooglePubSubWriteTopics } from './google-pubsub/index.js';
import { GoogleServicesEnable } from './google-services/index.js';
import {
  GoogleSpannerListDatabases,
  GoogleSpannerWriteDatabases,
} from './google-spanner/index.js';
import {
  ProjectGetArtefactDestinationForCloudFunctions,
  ProjectGetArtefactDestinationForCloudRun,
  ProjectPushArtefactForCloudFunctions,
} from './project/index.js';
import {
  SecretFetchForGoogleAccessToken,
  SecretFetchForGoogleSecretManager,
} from './secret/index.js';
import { TypeScriptGetDecoratorRendererForGoogleSpanner } from './typescript/index.js';

export function registerFunctions(context: ModuleRegistrationContext) {
  context.registerFunctionImplementations(
    EmulatorStartForFirebaseStorage,
    EmulatorStartForFirestore,
    EmulatorStartForIdentityPlatform,
    EmulatorStartForPubSub,
    EmulatorStartForSpanner,
    EmulatorStopForFirebaseStorage,
    EmulatorStopForFirestore,
    EmulatorStopForIdentityPlatform,
    EmulatorStopForPubSub,
    EmulatorStopForSpanner,
    EventTopicBrokerCreateTopicForPubSub,
    EventTopicBrokerCreateTriggerForCloudRun,
    EventTopicBrokerDeleteTopicForPubSub,
    EventTopicBrokerDeleteTriggerResourceForCloudRunInvokerRole,
    EventTopicBrokerDeleteTriggerResourceForPubSubSubscription,
    EventTopicBrokerDeleteTriggerResourceForServiceAccount,
    EventTopicBrokerGetTopicIdForPubSub,
    EventTopicBrokerPublishEventsForGoogle,
    GoogleAppCheckGenerateToken,
    GoogleFirebaseStorageMergeRules,
    GoogleFirestoreMergeRules,
    GoogleIdentityPlatformGenerateCustomToken,
    GoogleIdentityPlatformGenerateToken,
    GooglePubSubWriteTopics,
    GoogleServicesEnable,
    GoogleSpannerListDatabases,
    GoogleSpannerWriteDatabases,
    ProjectGetArtefactDestinationForCloudFunctions,
    ProjectGetArtefactDestinationForCloudRun,
    ProjectPushArtefactForCloudFunctions,
    SecretFetchForGoogleAccessToken,
    SecretFetchForGoogleSecretManager,
    TypeScriptGetDecoratorRendererForGoogleSpanner,
  );
}

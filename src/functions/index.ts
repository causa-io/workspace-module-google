import type { ModuleRegistrationContext } from '@causa/workspace';
import { CausaListConfigurationSchemasForGoogle } from './causa/index.js';
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
  EventTopicBrokerWaitForProcessingForPubSub,
  EventTopicCreateBackfillSourceForBigQuery,
  EventTopicQueryEventsForBigQuery,
} from './event-topic/index.js';
import { GoogleAppCheckGenerateToken } from './google-app-check/index.js';
import { GoogleFirebaseStorageMergeRules } from './google-firebase-storage/index.js';
import {
  DatabaseQueryRecordsForFirestore,
  GoogleFirestoreMergeRules,
  ModelGenerateTypeScriptDecoratorsForGoogleFirestore,
  ModelSchemaExtractDatabaseForGoogleFirestore,
} from './google-firestore/index.js';
import {
  GoogleIdentityPlatformGenerateCustomToken,
  GoogleIdentityPlatformGenerateToken,
} from './google-identity-platform/index.js';
import { GooglePubSubWriteTopics } from './google-pubsub/index.js';
import { GoogleServicesEnable } from './google-services/index.js';
import {
  DatabaseQueryRecordsForSpanner,
  GoogleSpannerListDatabases,
  GoogleSpannerWriteDatabases,
  ModelGenerateTypeScriptDecoratorsForGoogleSpanner,
  ModelSchemaExtractDatabaseForGoogleSpanner,
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
import { ServiceContainerQueryLogsForCloudRun } from './service-container/index.js';

export function registerFunctions(context: ModuleRegistrationContext) {
  context.registerFunctionImplementations(
    CausaListConfigurationSchemasForGoogle,
    DatabaseQueryRecordsForFirestore,
    DatabaseQueryRecordsForSpanner,
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
    EventTopicBrokerWaitForProcessingForPubSub,
    EventTopicCreateBackfillSourceForBigQuery,
    EventTopicQueryEventsForBigQuery,
    GoogleAppCheckGenerateToken,
    GoogleFirebaseStorageMergeRules,
    GoogleFirestoreMergeRules,
    GoogleIdentityPlatformGenerateCustomToken,
    GoogleIdentityPlatformGenerateToken,
    GooglePubSubWriteTopics,
    GoogleServicesEnable,
    GoogleSpannerListDatabases,
    GoogleSpannerWriteDatabases,
    ModelGenerateTypeScriptDecoratorsForGoogleFirestore,
    ModelGenerateTypeScriptDecoratorsForGoogleSpanner,
    ModelSchemaExtractDatabaseForGoogleFirestore,
    ModelSchemaExtractDatabaseForGoogleSpanner,
    ProjectGetArtefactDestinationForCloudFunctions,
    ProjectGetArtefactDestinationForCloudRun,
    ProjectPushArtefactForCloudFunctions,
    SecretFetchForGoogleAccessToken,
    SecretFetchForGoogleSecretManager,
    ServiceContainerQueryLogsForCloudRun,
  );
}

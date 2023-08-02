import { ModuleRegistrationContext } from '@causa/workspace';
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
import { GoogleAppCheckGenerateToken } from './google-app-check/index.js';
import { GoogleFirebaseStorageMergeRules } from './google-firebase-storage/index.js';
import { GoogleFirestoreMergeRules } from './google-firestore/index.js';
import {
  GoogleIdentityPlatformGenerateCustomToken,
  GoogleIdentityPlatformGenerateToken,
} from './google-identity-platform/index.js';
import { GooglePubSubWriteTopics } from './google-pubsub-write-topics.js';
import { GoogleServicesEnable } from './google-services-enable.js';
import { GoogleSpannerListDatabases } from './google-spanner-list-databases.js';
import { GoogleSpannerWriteDatabases } from './google-spanner-write-databases.js';
import { ProjectGetArtefactDestinationForCloudFunctions } from './project-get-artefact-destination-cloud-functions.js';
import { ProjectGetArtefactDestinationForCloudRun } from './project-get-artefact-destination-cloud-run.js';
import { ProjectPushArtefactForCloudFunctions } from './project-push-artefact-cloud-functions.js';
import { SecretFetchForGoogleSecretManager } from './secret-fetch-secret-manager.js';

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
    SecretFetchForGoogleSecretManager,
  );
}

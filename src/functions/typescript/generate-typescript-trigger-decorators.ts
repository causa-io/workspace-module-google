import type { ServiceContainerConfiguration } from '@causa/workspace-core';
import { ModelGenerateTypeScriptTriggerDecorators } from '@causa/workspace-typescript';
import {
  type TypeScriptDecorator,
  externalImportSpec,
  externalSymbolAlias,
} from '@causa/workspace-typescript/code-generation';

/**
 * The name of the Causa module for the TypeScript runtime, from which `UseEventHandler` is imported.
 */
const CAUSA_RUNTIME_NESTJS_MODULE = '@causa/runtime/nestjs';

/**
 * The name of the Causa module for the TypeScript Google runtime.
 */
const CAUSA_GOOGLE_MODULE = '@causa/runtime-google';

/**
 * The handler ID symbol to pass to `UseEventHandler` for each supported trigger type, along with the module from
 * which it should be imported.
 */
const HANDLER_IDS_FOR_TRIGGER_TYPES: Record<
  string,
  { module: string; symbol: string }
> = {
  event: { module: CAUSA_GOOGLE_MODULE, symbol: 'PUBSUB_EVENT_HANDLER_ID' },
  'google.pubSub': {
    module: CAUSA_GOOGLE_MODULE,
    symbol: 'PUBSUB_EVENT_HANDLER_ID',
  },
  task: {
    module: CAUSA_GOOGLE_MODULE,
    symbol: 'CLOUD_TASKS_EVENT_HANDLER_ID',
  },
  'google.tasks': {
    module: CAUSA_GOOGLE_MODULE,
    symbol: 'CLOUD_TASKS_EVENT_HANDLER_ID',
  },
  cron: {
    module: CAUSA_GOOGLE_MODULE,
    symbol: 'CLOUD_SCHEDULER_EVENT_HANDLER_ID',
  },
  'google.scheduler': {
    module: CAUSA_GOOGLE_MODULE,
    symbol: 'CLOUD_SCHEDULER_EVENT_HANDLER_ID',
  },
  'google.eventarc': {
    module: CAUSA_RUNTIME_NESTJS_MODULE,
    symbol: 'CLOUDEVENTS_EVENT_HANDLER_ID',
  },
};

/**
 * Implements {@link ModelGenerateTypeScriptTriggerDecorators} for services running on the Google platform.
 *
 * Each supported trigger type is mapped to a `@UseEventHandler(...)` decorator with the handler ID of the Google
 * service backing the trigger (Pub/Sub, Cloud Tasks, Cloud Scheduler, or Eventarc).
 */
export class ModelGenerateTypeScriptTriggerDecoratorsForGoogle extends ModelGenerateTypeScriptTriggerDecorators {
  _call(): TypeScriptDecorator[] {
    const handlerId = HANDLER_IDS_FOR_TRIGGER_TYPES[this.trigger.type];
    if (!handlerId) {
      return [];
    }

    const useEventHandlerAlias = externalSymbolAlias(
      CAUSA_RUNTIME_NESTJS_MODULE,
      'UseEventHandler',
    );
    const handlerIdAlias = externalSymbolAlias(
      handlerId.module,
      handlerId.symbol,
    );

    const imports: Record<string, string[]> = {
      [CAUSA_RUNTIME_NESTJS_MODULE]: [
        externalImportSpec(CAUSA_RUNTIME_NESTJS_MODULE, 'UseEventHandler'),
      ],
    };
    (imports[handlerId.module] ??= []).push(
      externalImportSpec(handlerId.module, handlerId.symbol),
    );

    return [{ source: `@${useEventHandlerAlias}(${handlerIdAlias})`, imports }];
  }

  _supports(): boolean {
    return (
      this.generator === 'typescriptNestjsController' &&
      this._context.get('project.language') === 'typescript' &&
      this._context
        .asConfiguration<ServiceContainerConfiguration>()
        .get('serviceContainer.platform') === 'google.cloudRun'
    );
  }
}

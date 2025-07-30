import { causaJsonSchemaAttributeProducer } from '@causa/workspace-core';
import { TypeScriptWithDecoratorsTargetLanguage } from '@causa/workspace-typescript';
import { readFile } from 'fs/promises';
import {
  FetchingJSONSchemaStore,
  InputData,
  JSONSchemaInput,
  quicktype,
} from 'quicktype-core';

export async function generateFromSchema(
  lang: TypeScriptWithDecoratorsTargetLanguage,
  schema: any,
  outputFile: string,
  uri?: string,
): Promise<string> {
  const input = new JSONSchemaInput(new FetchingJSONSchemaStore(), [
    causaJsonSchemaAttributeProducer,
  ]);
  await input.addSource({
    name: undefined as any,
    schema: JSON.stringify(schema),
    uris: [uri ?? 'test.json'],
  });
  const inputData = new InputData();
  inputData.addInput(input);

  const result = await quicktype({ inputData, lang });
  const outputLines = result.lines.join('\n');
  await lang.writeFile(outputLines);

  const output = await readFile(outputFile);
  return output.toString();
}

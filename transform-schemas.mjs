import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { globby } from 'globby';
import { dump, load } from 'js-yaml';

/**
 * The root directory of the repository.
 */
const ROOT_DIR = dirname(fileURLToPath(import.meta.url));

/**
 * The definition that should replace `_TemplateString` in schemas that define it.
 */
const TEMPLATE_STRING_DEF = {
  oneOf: [
    { type: 'string' },
    {
      type: 'object',
      additionalProperties: false,
      properties: {
        $format: {
          type: 'string',
          description: 'A string with formatting instructions.',
        },
      },
    },
  ],
};

/**
 * Reads a YAML JSONSchema file, replaces the `_TemplateString` definition if it exists, and writes the result to the
 * corresponding path under `dist/`.
 *
 * @param {string} relativePath The path to the source schema file, relative to the repository root.
 */
async function processSchema(relativePath) {
  const content = await readFile(join(ROOT_DIR, relativePath), 'utf-8');
  const schema = load(content);

  if (schema.$defs?._TemplateString) {
    schema.$defs._TemplateString = TEMPLATE_STRING_DEF;
  }

  const destPath = join(ROOT_DIR, 'dist', relativePath.slice('src/'.length));
  await mkdir(dirname(destPath), { recursive: true });
  await writeFile(destPath, dump(schema));
}

const files = await globby('src/configurations/schemas/**/*.yaml', {
  cwd: ROOT_DIR,
});

await Promise.all(files.map(processSchema));

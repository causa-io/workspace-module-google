import { WorkspaceContext } from '@causa/workspace';
import { createContext } from '@causa/workspace/testing';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'fs/promises';
import { join, resolve } from 'path';
import { mergeFirebaseRulesFiles } from './rules.js';

describe('rules', () => {
  describe('mergeFirebaseRulesFiles', () => {
    let context: WorkspaceContext;
    let tmpDir: string;

    beforeEach(async () => {
      tmpDir = resolve(await mkdtemp('firebase-rules-'));
      ({ context } = createContext({
        rootPath: tmpDir,
      }));
    });

    afterEach(async () => {
      await rm(tmpDir, { recursive: true });
    });

    it('should merge the rules files and not follow symlinks', async () => {
      await mkdir(join(tmpDir, 'first'));
      await mkdir(join(tmpDir, 'second'));
      await writeFile(
        join(tmpDir, 'first', 'a.rules'),
        'some\nFirst\n\nRules\n',
      );
      await writeFile(
        join(tmpDir, 'second', 'b.rules'),
        'some\n  Other\nRules\n',
      );
      await writeFile(join(tmpDir, 'second', 'c.nope'), '🙅');
      await symlink(
        join(tmpDir, 'second', 'b.rules'),
        join(tmpDir, 'second', 'not-c.rules'),
      );

      const actualPath = await mergeFirebaseRulesFiles(
        'Type',
        ['**/*.rules'],
        (rules) => `📓\n${rules}\n✅`,
        'output',
        context,
      );

      expect(actualPath).toEqual(join(tmpDir, 'output'));
      expect(await readFile(actualPath, 'utf-8')).toEqual(
        `📓
    // first/a.rules
    some
    First

    Rules

    // second/b.rules
    some
      Other
    Rules
✅`,
      );
    });

    it('should create the output directory if it does not exist', async () => {
      await writeFile(join(tmpDir, 'a.rules'), '🛂');

      const actualPath = await mergeFirebaseRulesFiles(
        'Type',
        ['*.rules'],
        (rules) => rules,
        'some-folder/output',
        context,
      );

      expect(actualPath).toEqual(join(tmpDir, 'some-folder/output'));
      expect(await readFile(actualPath, 'utf-8')).toEqual(
        '    // a.rules\n    🛂',
      );
    });
  });
});

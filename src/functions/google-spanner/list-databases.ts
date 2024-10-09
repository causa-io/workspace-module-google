import {
  WorkspaceContext,
  WorkspaceFunction,
  listFilesAndFormat,
} from '@causa/workspace';
import { readFile } from 'fs/promises';
import type { GoogleConfiguration } from '../../configurations/index.js';

/**
 * The definition of a Spanner database with its DDL statements.
 */
export type SpannerDatabase = {
  /**
   * The ID / name of the database.
   */
  id: string;

  /**
   * The paths (relative to the workspace root) containing DDL statements for this database.
   */
  ddlFiles: string[];

  /**
   * The DDL statements for the database.
   */
  ddls: string[];
};

/**
 * The default format used to infer the ID / name of the database from the format parts.
 */
const DEFAULT_DDL_DATABASE_ID_FORMAT = '${ database }';

/**
 * The default glob pattern used to find DDL statements in the workspace.
 */
const DEFAULT_DDL_GLOBS = ['domains/*/spanner/*.sql'];

/**
 * The default regular expression used to extract format parts from DDL file paths.
 */
const DEFAULT_DDL_REGULAR_EXPRESSION =
  'domains/(?<database>[\\w-]+)\\/spanner\\/[\\w-]+\\.sql';

/**
 * A function that lists Spanner databases defined in the workspace, and returns their corresponding DDLs.
 */
export class GoogleSpannerListDatabases extends WorkspaceFunction<
  Promise<SpannerDatabase[]>
> {
  async _call(context: WorkspaceContext): Promise<SpannerDatabase[]> {
    const googleConf = context.asConfiguration<GoogleConfiguration>();
    const format =
      googleConf.get('google.spanner.ddls.format') ??
      DEFAULT_DDL_DATABASE_ID_FORMAT;
    const globs =
      googleConf.get('google.spanner.ddls.globs') ?? DEFAULT_DDL_GLOBS;
    const regExp =
      googleConf.get('google.spanner.ddls.regularExpression') ??
      DEFAULT_DDL_REGULAR_EXPRESSION;

    context.logger.debug('🗃️ Listing Spanner databases and DDL files.');

    const filesAndFormats = await listFilesAndFormat(
      globs,
      regExp,
      format,
      context.rootPath,
      {
        nonMatchingPathHandler: (path) =>
          context.logger.warn(
            `📂 Path '${path}' matches the Spanner DDL globs but did not match the regular expression. It will be ignored.`,
          ),
      },
    );

    const databaseDdlFiles = filesAndFormats.reduce(
      (files, { rendered, filePath }) => {
        (files[rendered] ?? (files[rendered] = [])).push(filePath);
        return files;
      },
      {} as Record<string, string[]>,
    );

    return await Promise.all(
      Object.entries(databaseDdlFiles).map(async ([id, ddlFiles]) => {
        ddlFiles.sort();

        const ddlsInFiles = await Promise.all(
          ddlFiles.map((ddlFile) => this.parseDdlFile(ddlFile)),
        );

        const ddls = ddlsInFiles.flatMap((ddls) => ddls);

        context.logger.debug(
          `🗃️ Found Spanner database '${id}' with ${ddlFiles.length} DDL file(s) and ${ddls.length} statement(s).`,
        );

        return { id, ddlFiles, ddls };
      }),
    );
  }

  /**
   * Parses a SQL file containing Spanner DDL statements.
   * End-of-the-line comments are removed, and statements are split using semicolons.
   *
   * @param path The path to the SQL file containing DDL statements.
   * @returns The list of DDL statements.
   */
  private async parseDdlFile(path: string): Promise<string[]> {
    const rawFile = (await readFile(path)).toString();
    return (
      rawFile
        // Removing comments using the `-- My comment until the end of the line` syntax.
        .replace(/--.*$/gm, '')
        // Trimming lines for readability in logs, and joining them to easily split into statements.
        .split('\n')
        .map((statement) => statement.trim())
        .join(' ')
        // Splitting the SQL statements.
        .split(';')
        // Trimming for readability in logs.
        .map((statement) => statement.trim())
    );
  }

  _supports(): boolean {
    return true;
  }
}

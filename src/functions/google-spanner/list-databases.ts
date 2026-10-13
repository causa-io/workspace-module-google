import { WorkspaceFunction, listFilesAndFormat } from '@causa/workspace';
import { readFile } from 'fs/promises';
import type { GoogleConfiguration } from '../../configurations/index.js';

/**
 * A table created by a `CREATE TABLE` statement in a Spanner DDL file.
 */
export type SpannerTable = {
  /**
   * The name of the table.
   */
  readonly name: string;

  /**
   * The absolute path of the DDL file creating the table.
   */
  readonly file: string;

  /**
   * The line of the statement in the file.
   */
  readonly line: number;
};

/**
 * The definition of a Spanner database with its DDL statements.
 */
export type SpannerDatabase = {
  /**
   * The ID / name of the database.
   */
  id: string;

  /**
   * The absolute paths of the files containing DDL statements for this database.
   */
  ddlFiles: string[];

  /**
   * The DDL statements for the database.
   */
  ddls: string[];

  /**
   * The tables created by the `CREATE TABLE` statements of the DDL files.
   */
  tables: SpannerTable[];
};

/**
 * Matches a `CREATE TABLE` DDL statement, capturing the name of the table.
 */
const CREATE_TABLE_REGEX =
  /^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"']?([A-Za-z_]\w*)/i;

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
  async _call(): Promise<SpannerDatabase[]> {
    const googleConf = this._context.asConfiguration<GoogleConfiguration>();
    const format =
      googleConf.get('google.spanner.ddls.format') ??
      DEFAULT_DDL_DATABASE_ID_FORMAT;
    const globs =
      googleConf.get('google.spanner.ddls.globs') ?? DEFAULT_DDL_GLOBS;
    const regExp =
      googleConf.get('google.spanner.ddls.regularExpression') ??
      DEFAULT_DDL_REGULAR_EXPRESSION;

    this._context.logger.debug('🗃️ Listing Spanner databases and DDL files.');

    const filesAndFormats = await listFilesAndFormat(
      globs,
      regExp,
      format,
      this._context.rootPath,
      {
        nonMatchingPathHandler: (path) =>
          this._context.logger.warn(
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

        const statements = (
          await Promise.all(
            ddlFiles.map((ddlFile) => this.parseDdlFile(ddlFile)),
          )
        ).flat();

        const ddls = statements.map(({ statement }) => statement);
        const tables = statements.flatMap(({ statement, file, line }) => {
          const name = statement.match(CREATE_TABLE_REGEX)?.[1];
          return name ? [{ name, file, line }] : [];
        });

        this._context.logger.debug(
          `🗃️ Found Spanner database '${id}' with ${ddlFiles.length} DDL file(s) and ${ddls.length} statement(s).`,
        );

        return { id, ddlFiles, ddls, tables };
      }),
    );
  }

  /**
   * Parses a SQL file containing Spanner DDL statements.
   * End-of-the-line comments are removed, and statements are split using semicolons.
   *
   * @param path The path to the SQL file containing DDL statements.
   * @returns The list of DDL statements, along with the file and the line at which each statement starts.
   */
  private async parseDdlFile(
    path: string,
  ): Promise<{ statement: string; file: string; line: number }[]> {
    const rawFile = (await readFile(path)).toString();
    // Removing comments using the `-- My comment until the end of the line` syntax, which preserves line numbers.
    const withoutComments = rawFile.replace(/--.*$/gm, '');

    let line = 1;
    return withoutComments.split(';').map((rawStatement) => {
      const leadingWhitespace = rawStatement.match(/^\s*/)![0];
      const startLine = line + leadingWhitespace.split('\n').length - 1;
      line += rawStatement.split('\n').length - 1;

      const statement = rawStatement
        // Trimming lines for readability in logs, and joining them into a single line.
        .split('\n')
        .map((statementLine) => statementLine.trim())
        .join(' ')
        .trim();
      return { statement, file: path, line: startLine };
    });
  }

  _supports(): boolean {
    return true;
  }
}

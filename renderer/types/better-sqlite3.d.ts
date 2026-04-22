declare module 'better-sqlite3' {
  interface Statement {
    all: (...params: unknown[]) => unknown[];
    get: (...params: unknown[]) => unknown;
    run: (...params: unknown[]) => { changes: number; lastInsertRowid: number | bigint };
    iterate: (...params: unknown[]) => IterableIterator<unknown>;
  }

  interface Database {
    prepare: (sql: string) => Statement;
    exec: (sql: string) => void;
    close: () => void;
    pragma: (sql: string, options?: { simple?: boolean }) => unknown;
    transaction: <T extends (...args: unknown[]) => unknown>(fn: T) => T;
  }

  interface DatabaseConstructor {
    new (path: string, options?: { readonly?: boolean; fileMustExist?: boolean; timeout?: number }): Database;
    (path: string, options?: { readonly?: boolean; fileMustExist?: boolean; timeout?: number }): Database;
  }

  const Database: DatabaseConstructor;
  export default Database;
}

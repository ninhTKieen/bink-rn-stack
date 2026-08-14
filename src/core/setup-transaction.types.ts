export type SetupFileSnapshot =
  | {
      path: string;
      absolutePath: string;
      kind: 'missing';
    }
  | {
      path: string;
      absolutePath: string;
      kind: 'file';
      content: Buffer;
      mode: number;
    }
  | {
      path: string;
      absolutePath: string;
      kind: 'symlink';
      target: string;
    }
  | {
      path: string;
      absolutePath: string;
      kind: 'directory';
      mode: number;
    };

export interface SetupTransaction {
  projectRoot: string;
  snapshots: SetupFileSnapshot[];
}

export interface SetupRollbackFailure {
  path: string;
  message: string;
}

export interface SetupRollbackResult {
  restored: string[];
  removed: string[];
  untouched: string[];
  failures: SetupRollbackFailure[];
}

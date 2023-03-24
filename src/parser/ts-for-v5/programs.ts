import type { ProgramOptions } from "./parse-tsx-for-typescript";
import type { TS, typescript } from "../../types";
import path from "path";

const tsServices = new Map<string, TSService>();

/**
 * Get TS Program instance
 * The program instance is a program instance for parsing `*.astro` files as TSX.
 */
export function getTSProgram(
  code: string,
  options: ProgramOptions,
  ts: TS
): typescript.Program {
  const tsconfigPath = options.project;

  let service = tsServices.get(tsconfigPath);
  if (!service) {
    service = new TSService(tsconfigPath, ts);
    tsServices.set(tsconfigPath, service);
  }

  return service.getProgram(code, options.filePath);
}

export class TSService {
  private readonly watch: typescript.WatchOfConfigFile<typescript.BuilderProgram>;

  private readonly patchedHostSet = new WeakSet<typescript.CompilerHost>();

  private currTarget: {
    code: string;
    filePath: string;
    sourceFile?: typescript.SourceFile;
  } = {
    code: "",
    filePath: "",
  };

  private readonly fileWatchCallbacks = new Map<
    string,
    {
      update: () => void;
    }
  >();

  private readonly ts: TS;

  public constructor(tsconfigPath: string, ts: TS) {
    this.ts = ts;
    this.watch = this.createWatch(tsconfigPath);
  }

  public getProgram(code: string, filePath: string): typescript.Program {
    const normalized = normalizeFileName(this.ts, filePath);
    const lastTarget = this.currTarget;
    this.currTarget = {
      code,
      filePath: normalized,
    };
    for (const { filePath: targetPath } of [this.currTarget, lastTarget]) {
      if (!targetPath) continue;
      this.fileWatchCallbacks.get(targetPath)?.update();
    }
    const program = this.watch.getProgram().getProgram();

    // sets parent pointers in source files
    program.getTypeChecker();

    return program;
  }

  private createWatch(
    tsconfigPath: string
  ): typescript.WatchOfConfigFile<typescript.BuilderProgram> {
    const { ts } = this;
    type CreateProgram = typescript.CreateProgram<typescript.BuilderProgram>;

    const createAbstractBuilder = (
      ...args: Parameters<CreateProgram>
    ): ReturnType<CreateProgram> => {
      const [
        rootNames,
        options,
        argHost,
        oldProgram,
        configFileParsingDiagnostics,
        projectReferences,
      ] = args;

      const host: typescript.CompilerHost = argHost!;
      if (!this.patchedHostSet.has(host)) {
        this.patchedHostSet.add(host);

        const getTargetSourceFile = (
          fileName: string,
          languageVersionOrOptions:
            | typescript.ScriptTarget
            | typescript.CreateSourceFileOptions
        ) => {
          if (this.currTarget.filePath === normalizeFileName(ts, fileName)) {
            return (this.currTarget.sourceFile ??= ts.createSourceFile(
              this.currTarget.filePath,
              this.currTarget.code,
              languageVersionOrOptions,
              true,
              ts.ScriptKind.TSX
            ));
          }
          return null;
        };

        /* eslint-disable @typescript-eslint/unbound-method -- ignore */
        const original = {
          getSourceFile: host.getSourceFile,
          getSourceFileByPath: host.getSourceFileByPath!,
        };
        /* eslint-enable @typescript-eslint/unbound-method -- ignore */
        host.getSourceFile = (fileName, languageVersionOrOptions, ...args) => {
          const originalSourceFile = original.getSourceFile.call(
            host,
            fileName,
            languageVersionOrOptions,
            ...args
          );
          return (
            getTargetSourceFile(fileName, languageVersionOrOptions) ??
            originalSourceFile
          );
        };
        host.getSourceFileByPath = (
          fileName,
          path,
          languageVersionOrOptions,
          ...args
        ) => {
          const originalSourceFile = original.getSourceFileByPath.call(
            host,
            fileName,
            path,
            languageVersionOrOptions,
            ...args
          );
          return (
            getTargetSourceFile(fileName, languageVersionOrOptions) ??
            originalSourceFile
          );
        };
      }
      return ts.createAbstractBuilder(
        rootNames,
        options,
        host,
        oldProgram,
        configFileParsingDiagnostics,
        projectReferences
      );
    };
    const watchCompilerHost = ts.createWatchCompilerHost(
      tsconfigPath,
      {
        noEmit: true,
        jsx: ts.JsxEmit.Preserve,

        // This option is required if `includes` only includes `*.astro` files.
        // However, the option is not in the documentation.
        // https://github.com/microsoft/TypeScript/issues/28447
        allowNonTsExtensions: true,
      },
      ts.sys,
      createAbstractBuilder,
      (diagnostic) => {
        throw new Error(formatDiagnostics(ts, [diagnostic]));
      },
      () => {
        // Not reported in reportWatchStatus.
      },
      undefined,
      [
        {
          extension: ".astro",
          isMixedContent: true,
          scriptKind: ts.ScriptKind.Deferred,
        },
      ]
    );
    /* eslint-disable @typescript-eslint/unbound-method -- ignore */
    const original = {
      readFile: watchCompilerHost.readFile,
    };
    /* eslint-enable @typescript-eslint/unbound-method -- ignore */
    watchCompilerHost.readFile = (fileName, ...args) => {
      const normalized = normalizeFileName(ts, fileName);
      if (this.currTarget.filePath === normalized) {
        // It is the file currently being parsed.
        return this.currTarget.code;
      }

      return original.readFile.call(watchCompilerHost, fileName, ...args);
    };

    // It keeps a callback to mark the parsed file as changed so that it can be reparsed.
    watchCompilerHost.watchFile = (fileName, callback) => {
      const normalized = normalizeFileName(ts, fileName);
      this.fileWatchCallbacks.set(normalized, {
        update: () => callback(fileName, ts.FileWatcherEventKind.Changed),
      });

      return {
        close: () => {
          this.fileWatchCallbacks.delete(normalized);
        },
      };
    };
    // Use watchCompilerHost but don't actually watch the files and directories.
    watchCompilerHost.watchDirectory = () => {
      return {
        close: () => {
          // noop
        },
      };
    };

    /**
     * It heavily references typescript-eslint.
     * @see https://github.com/typescript-eslint/typescript-eslint/blob/84e316be33dac5302bd0367c4d1960bef40c484d/packages/typescript-estree/src/create-program/createWatchProgram.ts#L297-L309
     */
    watchCompilerHost.afterProgramCreate = (program) => {
      const originalDiagnostics = program.getConfigFileParsingDiagnostics();
      const configFileDiagnostics = originalDiagnostics.filter(
        (diag) =>
          diag.category === ts.DiagnosticCategory.Error && diag.code !== 18003
      );
      if (configFileDiagnostics.length > 0) {
        throw new Error(formatDiagnostics(ts, configFileDiagnostics));
      }
    };

    const watch = ts.createWatchProgram(watchCompilerHost);
    return watch;
  }
}

/** Format diagnostics */
function formatDiagnostics(ts: TS, diagnostics: typescript.Diagnostic[]) {
  return ts.formatDiagnostics(diagnostics, {
    getCanonicalFileName: (f) => f,
    getCurrentDirectory: () => process.cwd(),
    getNewLine: () => "\n",
  });
}

/** Normalize file name */
function normalizeFileName(ts: TS, fileName: string) {
  let normalized = path.normalize(fileName);
  if (normalized.endsWith(path.sep)) {
    normalized = normalized.slice(0, -1);
  }
  if (ts.sys.useCaseSensitiveFileNames) {
    return toAbsolutePath(normalized, null);
  }
  return toAbsolutePath(normalized.toLowerCase(), null);
}

/** To absolute path */
function toAbsolutePath(filePath: string, baseDir: string | null) {
  return path.isAbsolute(filePath)
    ? filePath
    : path.join(baseDir || process.cwd(), filePath);
}

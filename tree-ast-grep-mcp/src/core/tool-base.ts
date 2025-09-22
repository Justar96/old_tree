import { PathResolver, ResolvedPaths } from './path-resolver.js';
import { ParameterValidator } from './validator.js';
import { WorkspaceManager } from './workspace-manager.js';
import { AstGrepBinaryManager } from './binary-manager.js';
import { ValidationError } from '../types/errors.js';

export abstract class BaseTool {
  protected pathResolver: PathResolver;
  protected validator: ParameterValidator;

  constructor(
    protected workspaceManager: WorkspaceManager,
    protected binaryManager: AstGrepBinaryManager
  ) {
    this.pathResolver = new PathResolver(workspaceManager.getWorkspaceRoot());
    this.validator = new ParameterValidator(workspaceManager.getWorkspaceRoot());
  }

  protected async resolveAndValidatePaths(paths?: string[]): Promise<ResolvedPaths> {
    const resolved = await this.pathResolver.resolvePaths(paths);

    if (resolved.errors.length > 0) {
      throw new ValidationError('Path resolution failed', {
        errors: resolved.errors,
        workspace: resolved.workspace,
        requestedPaths: paths
      });
    }

    return resolved;
  }

  protected resolveAndValidatePathsSync(paths?: string[]): ResolvedPaths {
    const resolved = this.pathResolver.resolvePathsSync(paths);

    if (resolved.errors.length > 0) {
      throw new ValidationError('Path resolution failed', {
        errors: resolved.errors,
        workspace: resolved.workspace,
        requestedPaths: paths
      });
    }

    return resolved;
  }

  protected buildCommonArgs(params: any): string[] {
    const args: string[] = [];

    // Consistent parameter handling across all tools
    if (params.threads) {
      args.push('--threads', String(params.threads));
    }

    if (params.follow) {
      args.push('--follow');
    }

    if (params.noIgnore) {
      args.push('--no-ignore', 'hidden');
      args.push('--no-ignore', 'dot');
      args.push('--no-ignore', 'vcs');
    }

    // Add include patterns using globs
    if (params.include && params.include.length > 0) {
      for (const pattern of params.include) {
        args.push('--globs', pattern);
      }
    }

    // Add exclude patterns (ast-grep uses --globs with ! prefix for exclusion)
    if (params.exclude && params.exclude.length > 0) {
      for (const pattern of params.exclude) {
        args.push('--globs', `!${pattern}`);
      }
    }

    // Root/workdir controls (if provided)
    if (params.root) {
      args.push('--root', params.root);
    }
    if (params.workdir) {
      args.push('--workdir', params.workdir);
    }

    // Add ignore path options
    if (params.ignorePath && params.ignorePath.length > 0) {
      for (const ig of params.ignorePath) {
        args.push('--ignore-path', ig);
      }
    }

    return args;
  }

  protected buildLanguageArgs(language?: string): string[] {
    const args: string[] = [];
    if (language) {
      args.push('--lang', language);
    }
    return args;
  }

  protected buildJsonArgs(jsonStyle?: string): string[] {
    const args: string[] = [];
    args.push(`--json=${jsonStyle || 'stream'}`);
    return args;
  }

  /**
   * Normalize file paths for consistent display
   */
  protected normalizePath(filePath: string, relativePaths?: boolean): string {
    if (relativePaths && filePath) {
      return this.pathResolver.getRelativePath(filePath);
    }
    return filePath;
  }

  /**
   * Get workspace root for context
   */
  protected getWorkspaceRoot(): string {
    return this.workspaceManager.getWorkspaceRoot();
  }

  /**
   * Abstract method that each tool must implement
   */
  abstract execute(params: any): Promise<any>;
}
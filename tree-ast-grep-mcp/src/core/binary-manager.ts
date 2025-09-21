import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { BinaryError, InstallationOptions } from '../types/errors.js';

const execFileAsync = promisify(execFile);

export class AstGrepBinaryManager {
  private binaryPath: string | null = null;
  private isInitialized = false;
  private options: InstallationOptions;

  constructor(options: InstallationOptions = {}) {
    this.options = options;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Priority order:
    // 1. Custom binary path
    if (this.options.customBinaryPath) {
      await this.useCustomBinary(this.options.customBinaryPath);
      return;
    }

    // 2. System binary (if requested)
    if (this.options.useSystem) {
      await this.useSystemBinary();
      return;
    }

    // 3. Platform-specific or auto-install
    if (this.options.autoInstall || this.options.platform) {
      await this.installPlatformBinary();
      return;
    }

    // 4. Fallback to system binary
    await this.useSystemBinary();
  }

  private async useCustomBinary(customPath: string): Promise<void> {
    if (await this.testBinary(customPath)) {
      this.binaryPath = customPath;
      this.isInitialized = true;
    } else {
      throw new BinaryError(`Custom binary path "${customPath}" is not valid`);
    }
  }

  private async useSystemBinary(): Promise<void> {
    const systemPath = await this.findBinaryInPath();
    if (systemPath && await this.testBinary(systemPath)) {
      this.binaryPath = systemPath;
      this.isInitialized = true;
    } else {
      throw new BinaryError(
        'ast-grep binary not found in PATH. Please install ast-grep or use --auto-install option.'
      );
    }
  }

  private async installPlatformBinary(): Promise<void> {
    const platform = this.options.platform === 'auto' ?
      process.platform : this.options.platform || process.platform;
    const arch = process.arch;

    // Validate platform/architecture support
    const supportedPlatforms = ['win32', 'darwin', 'linux'];
    const supportedArchs = ['x64', 'arm64'];

    if (!supportedPlatforms.includes(platform)) {
      console.error(`Unsupported platform: ${platform}. Falling back to system binary.`);
      await this.useSystemBinary();
      return;
    }

    if (!supportedArchs.includes(arch)) {
      console.error(`Unsupported architecture: ${arch}. Falling back to system binary.`);
      await this.useSystemBinary();
      return;
    }

    const cacheDir = this.options.cacheDir ||
      path.join(os.homedir(), '.ast-grep-mcp', 'binaries');

    const binaryName = this.getBinaryName(platform, arch);
    const binaryPath = path.join(cacheDir, binaryName);

    // Check if binary exists in cache and is valid
    if (await this.fileExists(binaryPath)) {
      if (await this.testBinary(binaryPath)) {
        console.error(`Using cached binary: ${binaryPath}`);
        this.binaryPath = binaryPath;
        this.isInitialized = true;
        return;
      } else {
        // Remove invalid cached binary
        try {
          await fs.unlink(binaryPath);
        } catch {
          // Ignore cleanup errors
        }
      }
    }

    // Try to download binary
    try {
      console.error(`Installing ast-grep binary for ${platform}-${arch}...`);
      await this.downloadBinary(platform, arch, binaryPath);
      this.binaryPath = binaryPath;
      this.isInitialized = true;
      console.error(`Successfully installed binary at ${binaryPath}`);
    } catch (error) {
      console.error(`Failed to download binary: ${error instanceof Error ? error.message : String(error)}`);
      console.error('Falling back to system binary...');
      
      // Fallback to system binary
      try {
        await this.useSystemBinary();
      } catch (systemError) {
        throw new BinaryError(
          `Failed to install ast-grep binary and no system binary found.\n` +
          `Download error: ${error instanceof Error ? error.message : String(error)}\n` +
          `System binary error: ${systemError instanceof Error ? systemError.message : String(systemError)}\n\n` +
          `Solutions:\n` +
          `1. Install ast-grep manually: https://github.com/ast-grep/ast-grep#installation\n` +
          `2. Use --use-system option if ast-grep is available\n` +
          `3. Set AST_GREP_BINARY_PATH environment variable\n` +
          `4. Check network connectivity for automatic download`
        );
      }
    }
  }

  private async findBinaryInPath(): Promise<string | null> {
    const paths = process.env.PATH?.split(path.delimiter) || [];
    const binaryNames = process.platform === 'win32' ?
      ['ast-grep.exe', 'ast-grep'] : ['ast-grep'];

    for (const searchPath of paths) {
      for (const binaryName of binaryNames) {
        const fullPath = path.join(searchPath, binaryName);
        if (await this.fileExists(fullPath) && await this.testBinary(fullPath)) {
          return fullPath;
        }
      }
    }

    return null;
  }

  private async testBinary(binaryPath: string): Promise<boolean> {
    try {
      await execFileAsync(binaryPath, ['--version'], { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private getBinaryName(platform: string, arch: string): string {
    const extension = platform === 'win32' ? '.exe' : '';
    return `ast-grep-${platform}-${arch}${extension}`;
  }

  private async downloadBinary(platform: string, arch: string, targetPath: string): Promise<void> {
    const version = '0.39.5'; // Latest version
    const baseUrl = `https://github.com/ast-grep/ast-grep/releases/download/${version}`;

    const fileMap: Record<string, string> = {
      'win32-x64': 'app-x86_64-pc-windows-msvc.zip',
      'win32-arm64': 'app-aarch64-pc-windows-msvc.zip',
      'darwin-x64': 'app-x86_64-apple-darwin.zip',
      'darwin-arm64': 'app-aarch64-apple-darwin.zip',
      'linux-x64': 'app-x86_64-unknown-linux-gnu.zip',
      'linux-arm64': 'app-aarch64-unknown-linux-gnu.zip'
    };

    const fileName = fileMap[`${platform}-${arch}`];
    if (!fileName) {
      throw new BinaryError(`Unsupported platform: ${platform}-${arch}`);
    }

    const downloadUrl = `${baseUrl}/${fileName}`;
    const tempZipPath = targetPath + '.zip';

    // Ensure cache directory exists
    await fs.mkdir(path.dirname(targetPath), { recursive: true });

    console.error(`Downloading ast-grep binary for ${platform}-${arch}...`);

    try {
      // Download with retry logic
      await this.downloadWithRetry(downloadUrl, tempZipPath, 3);

      // Extract binary from zip
      await this.extractBinary(tempZipPath, targetPath, platform);

      // Set executable permissions on Unix systems
      if (platform !== 'win32') {
        await fs.chmod(targetPath, '755');
      }

      // Test the downloaded binary
      if (!await this.testBinary(targetPath)) {
        throw new BinaryError('Downloaded binary failed validation test');
      }

      console.error(`Binary installed successfully at ${targetPath}`);

    } catch (error) {
      // Cleanup on failure
      await this.cleanup([tempZipPath, targetPath]);
      
      if (error instanceof BinaryError) {
        throw error;
      }
      
      throw new BinaryError(
        `Failed to download ast-grep binary: ${error instanceof Error ? error.message : String(error)}\n` +
        `Fallback options:\n` +
        `1. Install ast-grep manually: https://github.com/ast-grep/ast-grep\n` +
        `2. Use --use-system option if ast-grep is in PATH\n` +
        `3. Set AST_GREP_BINARY_PATH environment variable`
      );
    }
  }

  private async downloadWithRetry(url: string, outputPath: string, maxRetries: number): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.error(`Download attempt ${attempt}/${maxRetries}...`);
        await this.downloadFile(url, outputPath);
        return; // Success
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`Attempt ${attempt} failed: ${lastError.message}`);
        
        if (attempt < maxRetries) {
          // Wait before retry (exponential backoff)
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          console.error(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Download failed after all retries');
  }

  private async downloadFile(url: string, outputPath: string): Promise<void> {
    // Use Node.js built-in fetch (available in Node 18+)
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('No response body');
    }

    // Stream download to handle large files
    const fileStream = await fs.open(outputPath, 'w');
    const writer = fileStream.createWriteStream();

    try {
      const reader = response.body.getReader();
      let totalBytes = 0;
      const contentLength = response.headers.get('content-length');
      const expectedBytes = contentLength ? parseInt(contentLength, 10) : 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        await writer.write(value);
        totalBytes += value.length;

        // Log progress for large downloads
        if (expectedBytes > 0 && totalBytes % (1024 * 1024) === 0) {
          const progress = Math.round((totalBytes / expectedBytes) * 100);
          console.error(`Download progress: ${progress}% (${totalBytes}/${expectedBytes} bytes)`);
        }
      }

      console.error(`Download completed: ${totalBytes} bytes`);

    } finally {
      await writer.close();
      await fileStream.close();
    }
  }

  private async extractBinary(zipPath: string, targetPath: string, platform: string): Promise<void> {
    try {
      const extractDir = path.join(path.dirname(targetPath), 'extract');
      await fs.mkdir(extractDir, { recursive: true });

      if (platform === 'win32') {
        // Use PowerShell on Windows
        await execFileAsync('powershell', [
          '-Command',
          `Expand-Archive -Path "${zipPath}" -DestinationPath "${extractDir}" -Force`
        ], { timeout: 30000 });
      } else {
        // Check if unzip is available, fallback to manual extraction
        try {
          await execFileAsync('unzip', ['-o', zipPath, '-d', extractDir], { timeout: 30000 });
        } catch (unzipError) {
          throw new Error('Unzip command not available. Please install unzip or use --use-system option.');
        }
      }

      // Find the ast-grep binary in extracted files
      const extractedFiles = await this.findFilesRecursively(extractDir);
      const binaryPattern = platform === 'win32' ? /ast-grep\.exe$/ : /ast-grep$/;
      const astGrepFile = extractedFiles.find(file => binaryPattern.test(file));

      if (!astGrepFile) {
        throw new Error(`ast-grep binary not found in archive. Found files: ${extractedFiles.join(', ')}`);
      }

      // Move binary to final location
      await fs.rename(astGrepFile, targetPath);

      // Cleanup extract directory
      await fs.rm(extractDir, { recursive: true, force: true });

    } catch (error) {
      throw new Error(`Failed to extract binary: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async findFilesRecursively(dir: string): Promise<string[]> {
    const files: string[] = [];
    
    async function scan(currentDir: string): Promise<void> {
      const items = await fs.readdir(currentDir);
      
      for (const item of items) {
        const itemPath = path.join(currentDir, item);
        const stats = await fs.stat(itemPath);
        
        if (stats.isFile()) {
          files.push(itemPath);
        } else if (stats.isDirectory()) {
          await scan(itemPath);
        }
      }
    }
    
    await scan(dir);
    return files;
  }

  private async cleanup(paths: string[]): Promise<void> {
    for (const filePath of paths) {
      try {
        await fs.unlink(filePath);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  getBinaryPath(): string | null {
    return this.binaryPath;
  }

  async executeAstGrep(args: string[], options: { cwd?: string; timeout?: number } = {}): Promise<{ stdout: string; stderr: string }> {
    if (!this.binaryPath) {
      throw new BinaryError('Binary not initialized');
    }

    const execOptions = {
      cwd: options.cwd || process.cwd(),
      timeout: options.timeout || 30000, // 30 second default
      maxBuffer: 1024 * 1024 * 10, // 10MB buffer
    };

    try {
      const result = await execFileAsync(this.binaryPath, args, execOptions);
      return {
        stdout: result.stdout,
        stderr: result.stderr,
      };
    } catch (error: any) {
      if (error.code === 'ETIMEDOUT') {
        throw new Error(`ast-grep execution timed out after ${execOptions.timeout}ms`);
      }
      if (error.code === 'ENOENT') {
        throw new BinaryError(`ast-grep binary not found at ${this.binaryPath}`);
      }
      throw new Error(`ast-grep execution failed: ${error.message}`);
    }
  }
}
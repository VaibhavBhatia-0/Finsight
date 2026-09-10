import { spawn } from 'child_process';
import path from 'path';
import { AppError } from '../middleware/errorHandler';

export class AnalyticsService {
  private static pythonPath = process.env.PYTHON_PATH || 'python';
  private static analyticsBaseDir = path.resolve(__dirname, '../../../analytics');

  public static async runScript<TInput = any, TOutput = any>(
    subPath: string,
    payload: TInput
  ): Promise<TOutput> {
    const scriptPath = path.join(this.analyticsBaseDir, subPath);

    return new Promise<TOutput>((resolve, reject) => {
      const child = spawn(this.pythonPath, [scriptPath]);

      let stdoutData = '';
      let stderrData = '';
      let settled = false;
      const maxOutputBytes = 5 * 1024 * 1024;
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        child.kill();
        reject(new AppError('Analytics calculation timed out', 504, 'ANALYTICS_TIMEOUT'));
      }, 30_000);

      child.stdout.on('data', (chunk) => {
        stdoutData += chunk.toString();
        if (stdoutData.length > maxOutputBytes && !settled) {
          settled = true;
          clearTimeout(timeout);
          child.kill();
          reject(new AppError('Analytics output exceeded the permitted size', 502, 'ANALYTICS_OUTPUT_LIMIT'));
        }
      });

      child.stderr.on('data', (chunk) => {
        stderrData += chunk.toString();
      });

      child.on('error', (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        reject(new AppError(`Failed to spawn Python process: ${err.message}`, 500, 'ANALYTICS_SPAWN_ERROR'));
      });

      child.on('close', (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        if (code !== 0) {
          console.error(`[Python Analytics Error in ${subPath}] Code ${code}: ${stderrData}`);
          reject(new AppError('Analytics calculation failed', 422, 'ANALYTICS_EXECUTION_ERROR'));
          return;
        }

        try {
          const parsed = JSON.parse(stdoutData.trim());
          resolve(parsed as TOutput);
        } catch (e: any) {
          console.error(`[Python Analytics JSON Parse Error] Raw output: ${stdoutData}`);
          reject(new AppError(`Invalid JSON returned from Python analytics: ${e.message}`, 500, 'ANALYTICS_PARSE_ERROR'));
        }
      });

      // Write payload to Python script's stdin
      child.stdin.write(JSON.stringify(payload));
      child.stdin.end();
    });
  }
}

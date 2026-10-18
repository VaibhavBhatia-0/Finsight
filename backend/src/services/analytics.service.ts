import { spawn } from 'child_process';
import path from 'path';
import { AppError } from '../middleware/errorHandler';

export class AnalyticsService {
  private static pythonPath = process.env.PYTHON_PATH || 'python';
  private static analyticsBaseDir = process.env.ANALYTICS_DIR
    ? path.resolve(process.env.ANALYTICS_DIR)
    : path.resolve(__dirname, '../../../analytics');

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
      const maxDiagnosticBytes = 64 * 1024;
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
        if (stderrData.length < maxDiagnosticBytes) stderrData += chunk.toString().slice(0, maxDiagnosticBytes - stderrData.length);
      });

      child.on('error', (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        console.error(JSON.stringify({ level: 'error', event: 'analytics_spawn_error', script: subPath, errorName: err.name, message: safeDiagnostic(err.message), timestamp: new Date().toISOString() }));
        reject(new AppError('Analytics service is unavailable', 503, 'ANALYTICS_SPAWN_ERROR'));
      });

      child.on('close', (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        if (code !== 0) {
          console.error(JSON.stringify({ level: 'error', event: 'analytics_execution_error', script: subPath, exitCode: code, diagnostic: safeDiagnostic(stderrData), timestamp: new Date().toISOString() }));
          reject(new AppError('Analytics calculation failed', 422, 'ANALYTICS_EXECUTION_ERROR'));
          return;
        }

        try {
          const parsed = JSON.parse(stdoutData.trim());
          resolve(parsed as TOutput);
        } catch (error) {
          console.error(JSON.stringify({ level: 'error', event: 'analytics_parse_error', script: subPath, errorName: error instanceof Error ? error.name : 'Error', message: safeDiagnostic(error instanceof Error ? error.message : 'Invalid JSON'), outputBytes: stdoutData.length, timestamp: new Date().toISOString() }));
          reject(new AppError('Analytics service returned invalid output', 502, 'ANALYTICS_PARSE_ERROR'));
        }
      });

      // Write payload to Python script's stdin
      child.stdin.write(JSON.stringify(payload));
      child.stdin.end();
    });
  }
}

function safeDiagnostic(value: string): string {
  return value
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi, 'Bearer [REDACTED]')
    .replace(/\b(password|token|secret|authorization|cookie)\s*[=:]\s*[^\s,;]+/gi, '$1=[REDACTED]')
    .slice(0, 2000);
}

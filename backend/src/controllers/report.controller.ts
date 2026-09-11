import { NextFunction, Request, Response } from 'express';
import { ReportService } from '../services/report.service';
import type { ReportQuery } from '../validators/report.validator';

export class ReportController {
  static async export(req: Request, res: Response, next: NextFunction) {
    try {
      const file = await ReportService.generate(req.user!.id, req.query as unknown as ReportQuery);
      res.status(200)
        .setHeader('Content-Type', file.contentType)
        .setHeader('Content-Disposition', `attachment; filename="${file.filename}"`)
        .setHeader('Cache-Control', 'private, no-store')
        .send(file.buffer);
    } catch (error) {
      next(error);
    }
  }
}

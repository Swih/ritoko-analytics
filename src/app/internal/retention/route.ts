import { timingSafeEqual } from 'node:crypto';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const websiteId = process.env.RITOKO_WEBSITE_ID;
  const provided = Buffer.from(request.headers.get('authorization') || '');
  const expected = Buffer.from(`Bearer ${secret || ''}`);
  if (!secret || provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!websiteId) return Response.json({ error: 'Website not configured' }, { status: 503 });
  const cutoff = new Date(Date.now() - 90 * 86400000);
  const where = { websiteId, createdAt: { lt: cutoff } };
  const deleted = await prisma.client.$transaction(async (tx) => {
    const counts: Record<string, number> = {};
    counts.eventData = (await tx.eventData.deleteMany({ where })).count;
    counts.sessionData = (await tx.sessionData.deleteMany({ where })).count;
    counts.revenue = (await tx.revenue.deleteMany({ where })).count;
    counts.sessionReplay = (await tx.sessionReplay.deleteMany({ where })).count;
    counts.sessionReplaySaved = (await tx.sessionReplaySaved.deleteMany({ where })).count;
    counts.heatmapEvent = (await tx.heatmapEvent.deleteMany({ where })).count;
    counts.sessionLink = (await tx.sessionLink.deleteMany({ where })).count;
    counts.websiteEvent = (await tx.websiteEvent.deleteMany({ where })).count;
    counts.session = (await tx.session.deleteMany({ where: { ...where, websiteEvents: { none: {} }, sessionData: { none: {} }, revenue: { none: {} } } })).count;
    return counts;
  }, { timeout: 45000 });
  return Response.json({ cutoff: cutoff.toISOString(), deleted }, { headers: { 'Cache-Control': 'no-store' } });
}
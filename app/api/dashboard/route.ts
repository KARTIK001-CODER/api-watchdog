import { sql } from '@/lib/db';
import { redis } from '@/lib/redis';
import { NextResponse } from 'next/server';
import type { DashboardData, ServiceStatus } from '@/lib/types';

export async function GET() {
  try {
    const res = await sql`SELECT name FROM monitored_services ORDER BY id ASC`;
    const services = res.rows.map(r => r.name);
    
    const latest: Record<string, ServiceStatus> = {};
    let allHealthy = true;
    
    for (const service of services) {
      const cached = await redis.get(`latest:${service}`);
      if (cached) {
        latest[service] = typeof cached === 'string' ? JSON.parse(cached) : cached;
        if (latest[service]?.statusQuality !== 'HEALTHY') {
          allHealthy = false;
        }
      } else {
        latest[service] = { 
          statusQuality: 'NO DATA', 
          responseTime: 0,
          statusCode: 0,
          timestamp: new Date().toISOString()
        };
        allHealthy = false;
      }
    }

    const history = await sql`
      SELECT service_name, response_time, status_quality, created_at
      FROM api_logs
      WHERE created_at > NOW() - INTERVAL '24 HOURS'
      ORDER BY created_at ASC
      LIMIT 500
    `;

    const groupedHistory: Record<string, { time: string; value: number; status: string }[]> = {};
    const statusCounts: Record<string, Record<string, number>> = {};
    for (const service of services) {
      statusCounts[service.toUpperCase()] = { HEALTHY: 0, DEGRADED: 0, DOWN: 0 };
    }

    for (const row of history.rows) {
      const serviceName = (row.service_name as string).toUpperCase();
      if (!groupedHistory[serviceName]) {
        groupedHistory[serviceName] = [];
      }
      groupedHistory[serviceName].push({
        time: row.created_at,
        value: row.response_time,
        status: row.status_quality
      });

      if (statusCounts[serviceName]) {
        statusCounts[serviceName][row.status_quality] = 
          (statusCounts[serviceName][row.status_quality] || 0) + 1;
      }
    }

    const uptime: Record<string, number> = {};
    for (const [service, counts] of Object.entries(statusCounts)) {
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      const healthy = counts.HEALTHY || 0;
      uptime[service] = total > 0 ? Math.round((healthy / total) * 100) : 100;
    }

    const calendarHistory = await sql`
      SELECT service_name, DATE(created_at) as date,
             COUNT(*) as total_checks,
             SUM(CASE WHEN status_quality = 'HEALTHY' THEN 1 ELSE 0 END) as healthy_checks
      FROM api_logs
      WHERE created_at > NOW() - INTERVAL '30 DAYS'
      GROUP BY service_name, DATE(created_at)
      ORDER BY date ASC
    `;

    const calendar: Record<string, { date: string; uptime: number }[]> = {};
    for (const service of services) {
      calendar[service.toUpperCase()] = [];
    }

    for (const row of calendarHistory.rows) {
      const serviceName = (row.service_name as string).toUpperCase();
      if (!calendar[serviceName]) calendar[serviceName] = [];
      const uptimePercentage = row.total_checks > 0 ? Math.round((row.healthy_checks / row.total_checks) * 100) : 0;
      // Date is returned as an object by node-postgres sometimes
      const dateStr = new Date(row.date).toISOString().split('T')[0];
      calendar[serviceName].push({
        date: dateStr,
        uptime: uptimePercentage
      });
    }

    return NextResponse.json({
      latest,
      history: groupedHistory,
      uptime,
      calendar,
      allHealthy,
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}
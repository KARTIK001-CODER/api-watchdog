import { redis } from '@/lib/redis';
import { NextResponse, NextRequest } from 'next/server';
import type { HealthResponse } from '@/lib/types';

import { sql } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const ip = request.ip || request.headers.get('x-forwarded-for') || '127.0.0.1';
    const limit = 10;
    const windowSeconds = 60;

    const currentMinute = Math.floor(Date.now() / 1000 / windowSeconds);
    const key = `ratelimit:health:${ip}:${currentMinute}`;
    
    const requests = await redis.incr(key);
    if (requests === 1) {
      await redis.expire(key, windowSeconds);
    }
    
    if (requests > limit) {
      return NextResponse.json(
        { status: 'ERROR', error: 'Too Many Requests' },
        { status: 429 }
      );
    }

    const res = await sql`SELECT name FROM monitored_services ORDER BY id ASC`;
    const services = res.rows.map(r => r.name);
    
    const status: HealthResponse['services'] = {};

    for (const service of services) {
      const cached = await redis.get(`latest:${service}`);
      if (cached) {
        const data = typeof cached === 'string' ? JSON.parse(cached) : cached;
        status[service] = {
          status: data.statusQuality,
          response_time: data.responseTime,
          last_checked: data.timestamp
        };
      } else {
        status[service] = {
          status: 'NO DATA',
          response_time: 0,
          last_checked: null
        };
      }
    }

    const allHealthy = Object.values(status).every(s => s.status === 'HEALTHY');
    const hasDegraded = Object.values(status).some(s => s.status === 'DEGRADED');

    let systemStatus: HealthResponse['status'] = 'HEALTHY';
    if (!allHealthy) {
      systemStatus = hasDegraded ? 'DEGRADED' : 'DOWN';
    }

    return NextResponse.json({
      status: systemStatus,
      timestamp: new Date().toISOString(),
      services: status,
      endpoints: {
        dashboard: '/',
        health: '/api/health',
        ping: '/api/ping'
      }
    });

  } catch (error: any) {
    return NextResponse.json(
      { status: 'ERROR', error: error.message },
      { status: 500 }
    );
  }
}
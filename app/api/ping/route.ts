import { sql } from '@/lib/db';
import { redis } from '@/lib/redis';
import { diagnoseAPIFailure, analyzeTrend } from '@/lib/groq';
import { NextResponse, NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let services = [];
  try {
    const res = await sql`SELECT name, url FROM monitored_services ORDER BY id ASC`;
    services = res.rows;
  } catch (err) {
    console.error('Failed to load services from DB:', err);
    return NextResponse.json({ error: 'Failed to load services' }, { status: 500 });
  }

  const results = [];

  for (const service of services) {
    const start = Date.now();
    let statusCode = 500;
    let payload = null;
    let errorMessage: string | null = null;

    try {
      const res = await fetch(service.url, { 
        signal: AbortSignal.timeout(10000) 
      });
      statusCode = res.status;
      payload = await res.json().catch(() => null);
    } catch (error: any) {
      statusCode = 500;
      errorMessage = error.message;
    }

    const responseTime = Date.now() - start;
    let statusQuality: 'HEALTHY' | 'DEGRADED' | 'DOWN' = 'HEALTHY';
    let aiDiagnosis: string | null = null;
    let trendPrediction: string = 'STABLE';

    // Check if it's down
    if (statusCode >= 400) {
      statusQuality = 'DOWN';
      
      const historyResult = await sql`
        SELECT response_time FROM api_logs 
        WHERE service_name = ${service.name} AND status_code = 200 
        ORDER BY created_at DESC LIMIT 5
      `;
      
      const history = historyResult.rows.map((row: any) => row.response_time);
      
      aiDiagnosis = await diagnoseAPIFailure(service.name, statusCode, history);
      
      if (process.env.DISCORD_WEBHOOK_URL) {
        await fetch(process.env.DISCORD_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            embeds: [{
              title: `🚨 ${service.name} API is DOWN!`,
              description: `**HTTP Status Code:** \`${statusCode}\`\n\n**🧠 AI Diagnosis & Next Steps:**\n${aiDiagnosis}`,
              color: 16711680, // Red
              timestamp: new Date().toISOString(),
              footer: { text: "API Watchdog Automated Alert" }
            }]
          })
        });
      }
    } 
    // Check for anomaly (degraded performance)
    else {
      const historyResult = await sql`
        SELECT response_time FROM api_logs 
        WHERE service_name = ${service.name} AND status_code = 200 
        ORDER BY created_at DESC LIMIT 10
      `;
      
      const times = historyResult.rows.map((row: any) => row.response_time);
      
      if (times.length > 5) {
        const avg = times.reduce((a: number, b: number) => a + b, 0) / times.length;
        
        if (responseTime > avg * 2) {
          statusQuality = 'DEGRADED';
          trendPrediction = await analyzeTrend(service.name, times);
          
          if (process.env.DISCORD_WEBHOOK_URL) {
            await fetch(process.env.DISCORD_WEBHOOK_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                embeds: [{
                  title: `⚠️ ${service.name} API is DEGRADED!`,
                  description: `**Current Speed:** \`${responseTime}ms\` (Normal: ~${Math.round(avg)}ms)\n\n**📊 AI Trend Prediction:**\n\`${trendPrediction}\`\n\n*Action required: Check database locks, queue backups, or third-party rate limits.*`,
                  color: 16753920, // Orange/Yellow
                  timestamp: new Date().toISOString(),
                  footer: { text: "API Watchdog Automated Alert" }
                }]
              })
            });
          }
        }
      }
    }

    // Save to database
    await sql`
      INSERT INTO api_logs (
        service_name, 
        response_time, 
        status_code, 
        status_quality, 
        payload,
        error_message
      )
      VALUES (
        ${service.name}, 
        ${responseTime}, 
        ${statusCode}, 
        ${statusQuality}, 
        ${JSON.stringify(payload)},
        ${errorMessage}
      )
    `;

    // Save to Redis cache
    await redis.set(
      `latest:${service.name}`,
      JSON.stringify({ 
        responseTime, 
        statusCode, 
        statusQuality, 
        timestamp: new Date().toISOString(),
        aiDiagnosis,
        trendPrediction
      }),
      { ex: 300 }
    );

    results.push({ 
      service: service.name, 
      status: statusQuality, 
      responseTime,
      trendPrediction
    });
  }

  return NextResponse.json({ 
    success: true, 
    results,
    timestamp: new Date().toISOString()
  });
}

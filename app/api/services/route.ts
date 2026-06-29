import { sql } from '@/lib/db';
import { NextResponse, NextRequest } from 'next/server';

export async function GET() {
  try {
    const result = await sql`
      SELECT id, name, url, created_at 
      FROM monitored_services 
      ORDER BY id ASC
    `;
    return NextResponse.json({ success: true, services: result.rows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, url } = await request.json();
    if (!name || !url) {
      return NextResponse.json({ error: 'Name and URL are required' }, { status: 400 });
    }
    
    const result = await sql`
      INSERT INTO monitored_services (name, url) 
      VALUES (${name}, ${url})
      RETURNING id, name, url
    `;
    return NextResponse.json({ success: true, service: result.rows[0] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }
    
    await sql`DELETE FROM monitored_services WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

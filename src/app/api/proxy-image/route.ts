import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get('url');

  if (!imageUrl) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  try {
    const upstream = await fetch(imageUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ARIFA/1.0)' },
    });

    if (!upstream.ok) {
      console.error(`[proxy-image] upstream ${upstream.status} ${upstream.statusText} for: ${imageUrl.slice(0, 200)}`);
      return NextResponse.json({ error: `Upstream ${upstream.status}: ${upstream.statusText}` }, { status: 502 });
    }

    const buffer = await upstream.arrayBuffer();
    const ct = upstream.headers.get('content-type') || 'image/jpeg';

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': ct,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err: any) {
    console.error('[proxy-image] fetch error:', err?.message ?? String(err));
    return NextResponse.json({ error: err?.message ?? 'Failed to proxy image' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import * as https from 'node:https';
import * as http from 'node:http';
import type { IncomingMessage } from 'node:http';

function fetchRaw(url: string, redirects = 5): Promise<{ data: Buffer; contentType: string }> {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, (res: IncomingMessage) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        if (redirects <= 0) { reject(new Error('Too many redirects')); return; }
        fetchRaw(res.headers.location, redirects - 1).then(resolve).catch(reject);
        return;
      }
      if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => resolve({
        data: Buffer.concat(chunks),
        contentType: (res.headers['content-type'] as string) || 'image/jpeg',
      }));
      res.on('error', reject);
    }).on('error', reject);
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get('url');

  if (!imageUrl) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  try {
    const { data, contentType } = await fetchRaw(imageUrl);
    return new NextResponse(data.buffer as ArrayBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Error proxying image:', error);
    return NextResponse.json({ error: 'Failed to proxy image' }, { status: 500 });
  }
}

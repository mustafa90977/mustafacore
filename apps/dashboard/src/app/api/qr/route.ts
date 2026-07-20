import { NextRequest, NextResponse } from 'next/server';
import { getOrchestrator } from '@/lib/orchestrator';

export async function GET(request: NextRequest) {
  try {
    const instanceId = request.nextUrl.searchParams.get('instanceId');

    if (!instanceId) {
      return NextResponse.json({ error: 'instanceId is required' }, { status: 400 });
    }

    const orchestrator = await getOrchestrator();
    const qr = await orchestrator.getQRCode(instanceId);

    if (!qr.qr) {
      return NextResponse.json({ qr: null, message: 'No QR code available' });
    }

    return NextResponse.json({ qr: qr.qr, expiresAt: qr.expiresAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

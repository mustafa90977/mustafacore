import { NextRequest, NextResponse } from 'next/server';
import { getOrchestrator } from '@/lib/orchestrator';

export async function GET(request: NextRequest) {
  try {
    const instanceId = request.nextUrl.searchParams.get('instanceId');

    if (!instanceId) {
      return NextResponse.json({ error: 'instanceId is required' }, { status: 400 });
    }

    const orchestrator = await getOrchestrator();
    const status = await orchestrator.getStatus(instanceId);

    return NextResponse.json(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

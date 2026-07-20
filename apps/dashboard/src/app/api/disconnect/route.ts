import { NextRequest, NextResponse } from 'next/server';
import { getOrchestrator } from '@/lib/orchestrator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { instanceId } = body;

    if (!instanceId || typeof instanceId !== 'string') {
      return NextResponse.json({ error: 'instanceId is required' }, { status: 400 });
    }

    const orchestrator = await getOrchestrator();
    await orchestrator.stopConnection(instanceId);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

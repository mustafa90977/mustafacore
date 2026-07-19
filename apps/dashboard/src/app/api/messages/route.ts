import { NextRequest, NextResponse } from 'next/server';
import { DbContext, MessageRepository } from '@wacore/infrastructure';

export async function GET(request: NextRequest) {
  try {
    const instanceId = request.nextUrl.searchParams.get('instanceId');

    if (!instanceId) {
      return NextResponse.json({ error: 'instanceId is required' }, { status: 400 });
    }

    const db = new DbContext();
    const messageRepo = new MessageRepository(db);
    const messages = await messageRepo.findRecentByInstanceId(instanceId, 100);

    const mapped = messages.map((msg: any) => ({
      id: msg.id,
      externalId: msg.externalId,
      direction: msg.direction,
      type: msg.type,
      content: msg.content,
      status: msg.status,
      timestamp: msg.timestamp,
      createdAt: msg.createdAt,
      customer: msg.conversation?.customer || null,
      conversationId: msg.conversationId,
    }));

    return NextResponse.json({ messages: mapped });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

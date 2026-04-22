import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { text, maxTokens = 200 } = await request.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'text is required and must be a string' }, { status: 400 });
    }

    // Call Claude API for summarization
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: Math.min(maxTokens, 500),
      messages: [
        {
          role: 'user',
          content: `Summarize the following text concisely (in ${maxTokens} words or less):\n\n${text}`,
        },
      ],
    });

    const summary =
      response.content[0].type === 'text'
        ? response.content[0].text
        : 'Failed to summarize text';

    return NextResponse.json({ summary }, { status: 200 });
  } catch (error) {
    console.error('Summarization error:', error);
    return NextResponse.json(
      {
        error: 'summarization_failed',
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

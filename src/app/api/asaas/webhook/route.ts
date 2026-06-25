import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const body = await request.json();
  const event = body?.event;
  const payment = body?.payment;

  if (!event || !payment) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  // TODO: handle PAYMENT_RECEIVED, PAYMENT_CONFIRMED, PAYMENT_OVERDUE
  // - Look up local invoice by Asaas customer/payment ID
  // - Create Payment record
  // - Update account status

  return NextResponse.json({ received: true });
}

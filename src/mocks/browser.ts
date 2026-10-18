import { setupWorker } from 'msw/browser';
import { getMockConfig, subscribeMockConfig } from './config';
import { db } from './db';
import { handlers } from './handlers';

export const worker = setupWorker(...handlers);

/** Customers paying the merchant every ~8–20s, so the dashboard feels live. */
export function startLiveInflows(): void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const schedule = () => {
    clearTimeout(timer);
    if (!getMockConfig().liveInflows) return;
    timer = setTimeout(() => {
      db.receivePayment();
      schedule();
    }, 8_000 + Math.random() * 12_000);
  };
  subscribeMockConfig(schedule);
  schedule();
}

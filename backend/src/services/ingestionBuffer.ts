import { SignalInput } from '../types';

export class IngestionBuffer {
  private readonly queue: SignalInput[] = [];

  constructor(private readonly maxSize: number) {}

  enqueue(signal: SignalInput): boolean {
    if (this.queue.length >= this.maxSize) {
      return false;
    }
    this.queue.push(signal);
    return true;
  }

  drain(batchSize: number): SignalInput[] {
    return this.queue.splice(0, batchSize);
  }

  size(): number {
    return this.queue.length;
  }
}

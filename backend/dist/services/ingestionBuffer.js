"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IngestionBuffer = void 0;
class IngestionBuffer {
    maxSize;
    queue = [];
    constructor(maxSize) {
        this.maxSize = maxSize;
    }
    enqueue(signal) {
        if (this.queue.length >= this.maxSize) {
            return false;
        }
        this.queue.push(signal);
        return true;
    }
    drain(batchSize) {
        return this.queue.splice(0, batchSize);
    }
    size() {
        return this.queue.length;
    }
}
exports.IngestionBuffer = IngestionBuffer;

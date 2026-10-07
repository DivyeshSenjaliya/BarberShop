import type { Response } from 'express';
import type { Page } from '../core/pagination';

/**
 * Response helpers — the single place that decides the success envelope, so
 * every endpoint answers with the same shape and status conventions.
 */

export interface ApiEnvelope<T> {
  data: T;
}

export function sendOk<T>(res: Response, data: T): void {
  res.status(200).json({ data } satisfies ApiEnvelope<T>);
}

export function sendCreated<T>(res: Response, data: T, location?: string): void {
  if (location) res.setHeader('Location', location);
  res.status(201).json({ data } satisfies ApiEnvelope<T>);
}

export function sendAccepted<T>(res: Response, data: T): void {
  res.status(202).json({ data } satisfies ApiEnvelope<T>);
}

export function sendNoContent(res: Response): void {
  res.status(204).send();
}

export function sendPage<T>(res: Response, page: Page<T>): void {
  res.status(200).json({ data: page.data, pageInfo: page.pageInfo });
}

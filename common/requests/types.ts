import type { GenerateRequestV2 } from '../types/inference'

export type PayloadOpts = GenerateRequestV2 & { prompt: string }

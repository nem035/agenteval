import { z } from 'zod'

const providerConfigSchema = z.object({
  apiKey: z.string().optional(),
  baseURL: z.string().url().optional(),
}).optional()

const judgeConfigSchema = z.object({
  provider: z.enum(['anthropic', 'openai']).optional(),
  model: z.string().optional(),
}).optional()

export const configSchema = z.object({
  providers: z.object({
    anthropic: providerConfigSchema,
    openai: providerConfigSchema,
  }).optional(),
  defaultProvider: z.enum(['anthropic', 'openai']).optional(),
  defaultModel: z.string().optional(),
  include: z.array(z.string()).optional(),
  exclude: z.array(z.string()).optional(),
  trials: z.number().int().positive().optional(),
  timeout: z.number().int().positive().optional(),
  parallel: z.boolean().optional(),
  maxConcurrency: z.number().int().positive().optional(),
  judge: judgeConfigSchema,
  reporters: z.array(z.enum(['console', 'json'])).optional(),
  maxCost: z.number().positive().optional(),
})

export type ConfigSchema = z.infer<typeof configSchema>

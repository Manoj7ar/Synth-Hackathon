import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime'
import {
  getAwsRegion,
  getNovaFastModelId,
  getNovaMultimodalModelId,
  getNovaTextModelId,
  isNovaConfigured,
} from '@/lib/aws/config'

type NovaMessage = {
  role: 'user' | 'assistant'
  content: string
}

type GenerateNovaTextArgs = {
  prompt: string
  systemPrompt?: string
  modelId?: string
  maxTokens?: number
  temperature?: number
}

type GenerateNovaTextFromMessagesArgs = {
  messages: NovaMessage[]
  systemPrompt?: string
  modelId?: string
  maxTokens?: number
  temperature?: number
}

type GenerateNovaMultimodalTextArgs = {
  prompt: string
  imageFiles: File[]
  systemPrompt?: string
  modelId?: string
  maxTokens?: number
  temperature?: number
}

type ConverseResponseLike = {
  output?: {
    message?: {
      content?: Array<{ text?: string }>
    }
  }
}

let bedrockClient: BedrockRuntimeClient | null = null

function getBedrockClient() {
  if (!isNovaConfigured()) {
    throw new Error('Amazon Nova is not configured. Set AWS_REGION and Bedrock model env vars.')
  }

  if (!bedrockClient) {
    bedrockClient = new BedrockRuntimeClient({
      region: getAwsRegion(),
    })
  }

  return bedrockClient
}

function normalizeTextFromConverseResponse(response: unknown) {
  const content = (response as ConverseResponseLike)?.output?.message?.content ?? []
  const text = content
    .map((part) => (typeof part?.text === 'string' ? part.text : ''))
    .filter(Boolean)
    .join('\n')
    .trim()

  if (!text) {
    throw new Error('Amazon Nova returned an empty response.')
  }

  return text
}

async function converse(args: GenerateNovaTextFromMessagesArgs) {
  const client = getBedrockClient()

  const command = new ConverseCommand({
    modelId: args.modelId ?? getNovaTextModelId(),
    system: args.systemPrompt ? [{ text: args.systemPrompt }] : undefined,
    messages: args.messages.map((message) => ({
      role: message.role,
      content: [{ text: message.content }],
    })) as never,
    inferenceConfig: {
      maxTokens: args.maxTokens ?? 1200,
      temperature: args.temperature ?? 0.3,
    },
  } as never)

  const response = await client.send(command)
  return normalizeTextFromConverseResponse(response)
}

export async function generateNovaText(args: GenerateNovaTextArgs) {
  return converse({
    messages: [{ role: 'user', content: args.prompt }],
    systemPrompt: args.systemPrompt,
    modelId: args.modelId ?? getNovaFastModelId(),
    maxTokens: args.maxTokens,
    temperature: args.temperature,
  })
}

export async function generateNovaTextFromMessages(args: GenerateNovaTextFromMessagesArgs) {
  return converse({
    ...args,
    modelId: args.modelId ?? getNovaTextModelId(),
  })
}

function imageFormatForFile(file: File): 'jpeg' | 'png' | 'gif' | 'webp' {
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/gif') return 'gif'
  if (file.type === 'image/webp') return 'webp'
  return 'jpeg'
}

export async function generateNovaMultimodalText(args: GenerateNovaMultimodalTextArgs) {
  const client = getBedrockClient()
  const imageContentBlocks = await Promise.all(
    args.imageFiles.map(async (file) => ({
      image: {
        format: imageFormatForFile(file),
        source: {
          bytes: new Uint8Array(await file.arrayBuffer()),
        },
      },
    }))
  )

  const command = new ConverseCommand({
    modelId: args.modelId ?? getNovaMultimodalModelId(),
    system: args.systemPrompt ? [{ text: args.systemPrompt }] : undefined,
    messages: [
      {
        role: 'user',
        content: [{ text: args.prompt }, ...imageContentBlocks],
      },
    ] as never,
    inferenceConfig: {
      maxTokens: args.maxTokens ?? 1200,
      temperature: args.temperature ?? 0.2,
    },
  } as never)

  const response = await client.send(command)
  return normalizeTextFromConverseResponse(response)
}

export { isNovaConfigured }



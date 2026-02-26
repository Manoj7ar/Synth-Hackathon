import { generateNovaText, isNovaConfigured } from '@/lib/nova'

type GeminiCompatibleContent =
  | string
  | Array<
      | { text?: string }
      | { inlineData?: { mimeType?: string; data?: string } }
    >

type GeminiLikeResponse = {
  response: {
    text: () => string
  }
}

export function isGeminiConfigured(): boolean {
  return isNovaConfigured()
}

export function getGeminiModel() {
  return {
    async generateContent(content: GeminiCompatibleContent): Promise<GeminiLikeResponse> {
      if (Array.isArray(content)) {
        const hasInlineData = content.some(
          (part) => typeof part === 'object' && part !== null && 'inlineData' in part && part.inlineData
        )

        if (hasInlineData) {
          throw new Error(
            'Audio transcription is not enabled in the Amazon Nova hackathon build. Use transcript text or browser live transcript.'
          )
        }

        const prompt = content
          .map((part) => {
            if (typeof part === 'string') return part
            if ('text' in part && typeof part.text === 'string') return part.text
            return ''
          })
          .filter(Boolean)
          .join('\n\n')

        const text = await generateNovaText({ prompt })
        return {
          response: {
            text: () => text,
          },
        }
      }

      const text = await generateNovaText({ prompt: content })
      return {
        response: {
          text: () => text,
        },
      }
    },
  }
}

export const genAI = null


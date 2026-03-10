import type { CSSProperties } from 'react'

const grainSvg = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180' viewBox='0 0 180 180'%3E%3Cg fill='%2368573f' fill-opacity='0.18'%3E%3Ccircle cx='14' cy='26' r='1'/%3E%3Ccircle cx='42' cy='68' r='1'/%3E%3Ccircle cx='88' cy='32' r='1'/%3E%3Ccircle cx='132' cy='54' r='1'/%3E%3Ccircle cx='168' cy='18' r='1'/%3E%3Ccircle cx='22' cy='122' r='1'/%3E%3Ccircle cx='64' cy='148' r='1'/%3E%3Ccircle cx='114' cy='124' r='1'/%3E%3Ccircle cx='154' cy='144' r='1'/%3E%3Ccircle cx='78' cy='92' r='1'/%3E%3C/g%3E%3C/svg%3E")`

export const heroImageBackdropStyle: CSSProperties = {
  backgroundImage: "url('/landing/hero-sky.jpg')",
  backgroundSize: 'cover',
}

export const heroDandelionOverlayStyle: CSSProperties = {
  backgroundImage: "url('/landing/hero-dandelions.png')",
  backgroundSize: 'cover',
}

export const heroNoiseOverlayStyle: CSSProperties = {
  backgroundImage: "url('/landing/hero-noise.png')",
  backgroundRepeat: 'repeat',
}

export const grainTextureStyle: CSSProperties = {
  backgroundImage: grainSvg,
  backgroundRepeat: 'repeat',
  backgroundSize: '180px 180px',
}

export const heroBackdropStyle: CSSProperties = {
  backgroundImage:
    'radial-gradient(circle at 16% 18%, rgba(56, 189, 248, 0.3), transparent 28%), radial-gradient(circle at 80% 14%, rgba(250, 204, 21, 0.18), transparent 24%), linear-gradient(160deg, #07111a 0%, #17324a 42%, #4c280f 100%)',
  backgroundSize: 'cover',
}

export const heroBloomStyle: CSSProperties = {
  backgroundImage:
    'radial-gradient(circle at 18% 78%, rgba(255, 247, 232, 0.26), transparent 28%), radial-gradient(circle at 78% 70%, rgba(249, 168, 37, 0.16), transparent 32%), linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0))',
  backgroundSize: 'cover',
}

export const warmMeshStyle: CSSProperties = {
  backgroundImage:
    'radial-gradient(circle at center, rgba(56, 189, 248, 0.18), transparent 60%), linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 50%, rgba(232,212,179,0.3) 100%)',
}

#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.resolve(__dirname, '..')
const THEMES_DIR = path.join(ROOT_DIR, 'themes')
const PREVIEWS_DIR = path.join(ROOT_DIR, 'previews')
const REGISTRY_PATH = path.join(ROOT_DIR, 'registry.json')
const README_PATH = path.join(ROOT_DIR, 'README.md')

const RESERVED_THEME_IDS = new Set(['light', 'dark', 'auto'])
const LEGACY_COLOR_TOKENS = new Set([
  'color-primary',
  'color-bg',
  'color-fg',
  'color-text',
  'color-text-muted',
  'color-border',
  'color-button',
  'color-button-hover',
  'color-list-selection',
  'color-list-selection-fg',
  'color-scrollbar',
])
const REQUIRED_COLOR_KEYS = ['background', 'foreground', 'primary', 'card', 'border']
const THEME_ID_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const CSS_TOKEN_REGEX = /^[a-z0-9-]+$/i
const GITHUB_URL_REGEX = /^https:\/\/github\.com\/[\w.-]+(?:\/[\w.-]+)?\/?$/
const COMMIT_SHA_REGEX = /^[0-9a-f]{40}$/i

// Safe CSS color values: #hex, rgb/rgba, hsl/hsla, oklch
const HEX_COLOR_REGEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i
const FUNC_COLOR_REGEX = /^(?:rgba?|hsla?|oklch)\([0-9.%\s,/+deg-]+\)$/i

function isValidCssColor(value) {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > 80) return false
  if (/[;{}\r\n]|url\(|expression\(|@import/i.test(trimmed)) return false
  return HEX_COLOR_REGEX.test(trimmed) || FUNC_COLOR_REGEX.test(trimmed)
}

function resolveCommitSha() {
  const envSha = process.env.REGISTRY_COMMIT_SHA || process.env.GITHUB_SHA
  if (envSha && COMMIT_SHA_REGEX.test(envSha)) {
    return envSha.toLowerCase()
  }

  try {
    const gitSha = execSync('git rev-parse HEAD', {
      cwd: ROOT_DIR,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    if (COMMIT_SHA_REGEX.test(gitSha)) {
      return gitSha.toLowerCase()
    }
  }
  catch {
    // Repository not initialized yet
  }

  return '0'.repeat(40)
}

function validateTheme(fileName, rawContent) {
  const errors = []

  if (!fileName.endsWith('.json')) {
    return { errors: [`${fileName}: Expected .json extension`] }
  }

  const id = fileName.slice(0, -'.json'.length)

  if (!THEME_ID_REGEX.test(id)) {
    errors.push(`${fileName}: Theme ID "${id}" must be kebab-case (a-z, 0-9, -)`)
  }

  if (RESERVED_THEME_IDS.has(id)) {
    errors.push(`${fileName}: Theme ID "${id}" is reserved for built-in themes`)
  }

  let data
  try {
    data = JSON.parse(rawContent)
  }
  catch (err) {
    return { errors: [`${fileName}: Invalid JSON (${err.message})`] }
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { errors: [`${fileName}: Root must be a JSON object`] }
  }

  if (typeof data.name !== 'string' || !data.name.trim() || data.name.trim().length > 64) {
    errors.push(`${fileName}: "name" must be a non-empty string (max 64 chars)`)
  }

  if (data.type !== 'light' && data.type !== 'dark') {
    errors.push(`${fileName}: "type" must be "light" or "dark"`)
  }

  if (data.author !== undefined && (typeof data.author !== 'string' || !data.author.trim() || data.author.trim().length > 64)) {
    errors.push(`${fileName}: "author" must be a non-empty string (max 64 chars)`)
  }

  if (data.authorUrl !== undefined && (typeof data.authorUrl !== 'string' || !GITHUB_URL_REGEX.test(data.authorUrl.trim()))) {
    errors.push(`${fileName}: "authorUrl" must be a valid https://github.com/... URL`)
  }

  if (data.license !== undefined && (typeof data.license !== 'string' || !data.license.trim() || data.license.trim().length > 64)) {
    errors.push(`${fileName}: "license" must be a non-empty string (max 64 chars)`)
  }

  if (data.copyright !== undefined && (typeof data.copyright !== 'string' || !data.copyright.trim() || data.copyright.trim().length > 200)) {
    errors.push(`${fileName}: "copyright" must be a non-empty string (max 200 chars)`)
  }

  if (!data.colors || typeof data.colors !== 'object' || Array.isArray(data.colors)) {
    errors.push(`${fileName}: "colors" must be an object`)
  }
  else {
    for (const requiredKey of REQUIRED_COLOR_KEYS) {
      if (!(requiredKey in data.colors)) {
        errors.push(`${fileName}: Missing required color token "colors.${requiredKey}"`)
      }
    }

    for (const [key, value] of Object.entries(data.colors)) {
      if (!CSS_TOKEN_REGEX.test(key)) {
        errors.push(`${fileName}: Invalid color token key "${key}"`)
      }
      if (LEGACY_COLOR_TOKENS.has(key)) {
        errors.push(`${fileName}: Legacy color token "${key}" is not allowed`)
      }
      if (!isValidCssColor(value)) {
        errors.push(`${fileName}: Invalid CSS color value for "colors.${key}": ${JSON.stringify(value)}`)
      }
    }
  }

  if (data.editorColors !== undefined) {
    if (!data.editorColors || typeof data.editorColors !== 'object' || Array.isArray(data.editorColors)) {
      errors.push(`${fileName}: "editorColors" must be an object`)
    }
    else {
      for (const [key, value] of Object.entries(data.editorColors)) {
        if (!key.startsWith('editor-') || !CSS_TOKEN_REGEX.test(key)) {
          errors.push(`${fileName}: Invalid editor color key "${key}" (must start with "editor-")`)
        }
        if (!isValidCssColor(value)) {
          errors.push(`${fileName}: Invalid CSS color value for "editorColors.${key}": ${JSON.stringify(value)}`)
        }
      }
    }
  }

  if (errors.length > 0) {
    return { errors }
  }

  const sha256 = createHash('sha256').update(rawContent, 'utf8').digest('hex')
  const preview = {
    background: data.colors.background.trim(),
    card: data.colors.card.trim(),
    foreground: data.colors.foreground.trim(),
    primary: data.colors.primary.trim(),
    border: data.colors.border.trim(),
    ...(data.colors.accent ? { accent: data.colors.accent.trim() } : {}),
    ...(data.editorColors?.['editor-keyword'] ? { keyword: data.editorColors['editor-keyword'].trim() } : {}),
    ...(data.editorColors?.['editor-string'] ? { string: data.editorColors['editor-string'].trim() } : {}),
    ...(data.editorColors?.['editor-comment'] ? { comment: data.editorColors['editor-comment'].trim() } : {}),
  }

  const entry = {
    id,
    name: data.name.trim(),
    ...(data.author ? { author: data.author.trim() } : {}),
    ...(data.authorUrl ? { authorUrl: data.authorUrl.trim() } : {}),
    type: data.type,
    file: `themes/${fileName}`,
    sha256,
    preview,
  }

  return { errors: [], entry }
}

function renderPreviewSvg(entry) {
  const isLight = entry.type === 'light'
  const p = entry.preview
  const bg = p.background
  const card = p.card
  const fg = p.foreground
  const primary = p.primary
  const border = p.border
  const accent = p.accent || card
  const keyword = p.keyword || primary
  const str = p.string || (isLight ? '#16a34a' : '#4ade80')
  const comment = p.comment || (isLight ? '#9ca3af' : '#71717a')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="72" viewBox="0 0 180 72" fill="none">
  <defs>
    <clipPath id="clip">
      <rect x="0.5" y="0.5" width="179" height="71" rx="7.5" />
    </clipPath>
  </defs>
  <g clip-path="url(#clip)">
    <rect width="180" height="72" fill="${bg}" />
    <rect width="60" height="72" fill="${card}" />
    <line x1="60" y1="0" x2="60" y2="72" stroke="${border}" stroke-width="1" />
    <!-- Sidebar -->
    <rect x="10" y="12" width="24" height="5" rx="2.5" fill="${primary}" opacity="0.9" />
    <rect x="8" y="23" width="44" height="9" rx="3" fill="${accent}" />
    <rect x="12" y="26" width="28" height="3" rx="1.5" fill="${fg}" />
    <rect x="10" y="38" width="36" height="3" rx="1.5" fill="${fg}" opacity="0.55" />
    <rect x="10" y="47" width="28" height="3" rx="1.5" fill="${fg}" opacity="0.4" />
    <!-- Editor -->
    <rect x="72" y="16" width="18" height="4" rx="2" fill="${keyword}" />
    <rect x="94" y="16" width="30" height="4" rx="2" fill="${fg}" />
    <rect x="128" y="16" width="24" height="4" rx="2" fill="${str}" />
    <rect x="80" y="27" width="22" height="4" rx="2" fill="${primary}" />
    <rect x="106" y="27" width="36" height="4" rx="2" fill="${str}" />
    <rect x="80" y="38" width="44" height="4" rx="2" fill="${comment}" opacity="0.8" />
    <rect x="72" y="49" width="16" height="4" rx="2" fill="${keyword}" />
    <rect x="92" y="49" width="28" height="4" rx="2" fill="${fg}" />
  </g>
  <rect x="0.5" y="0.5" width="179" height="71" rx="7.5" stroke="${border}" />
</svg>
`
}

function syncPreviews(themes) {
  mkdirSync(PREVIEWS_DIR, { recursive: true })
  const expectedFiles = new Set()

  for (const theme of themes) {
    const fileName = `${theme.id}.svg`
    expectedFiles.add(fileName)
    writeFileSync(path.join(PREVIEWS_DIR, fileName), renderPreviewSvg(theme), 'utf8')
  }

  for (const existing of readdirSync(PREVIEWS_DIR)) {
    if (existing.endsWith('.svg') && !expectedFiles.has(existing)) {
      unlinkSync(path.join(PREVIEWS_DIR, existing))
    }
  }
}

function updateReadmeTable(themes) {
  if (!existsSync(README_PATH)) return

  const readme = readFileSync(README_PATH, 'utf8')
  const startMarker = '<!-- THEMES:START -->'
  const endMarker = '<!-- THEMES:END -->'
  const startIdx = readme.indexOf(startMarker)
  const endIdx = readme.indexOf(endMarker)

  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) return

  const rows = themes.map((theme) => {
    const previewCell = `![${theme.name}](previews/${theme.id}.svg)`
    const nameCell = `[**${theme.name}**](${theme.file})`
    const typeCell = theme.type === 'dark' ? 'Dark' : 'Light'
    const authorCell = theme.author
      ? (theme.authorUrl ? `[${theme.author}](${theme.authorUrl})` : theme.author)
      : '—'
    return `| ${previewCell} | ${nameCell} | ${typeCell} | ${authorCell} |`
  })

  const table = [
    '| Preview | Theme | Type | Author |',
    '| --- | --- | --- | --- |',
    ...rows,
  ].join('\n')

  const nextReadme = `${readme.slice(0, startIdx + startMarker.length)}\n${table}\n${readme.slice(endIdx)}`
  writeFileSync(README_PATH, nextReadme, 'utf8')
}

function main() {
  const isCheckOnly = process.argv.includes('--check')
  const entries = readdirSync(THEMES_DIR, { withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => entry.name)
    .sort()

  const allErrors = []
  const themes = []
  const seenNames = new Set()

  for (const fileName of entries) {
    const filePath = path.join(THEMES_DIR, fileName)
    const rawContent = readFileSync(filePath, 'utf8')
    const { errors, entry } = validateTheme(fileName, rawContent)

    if (errors.length > 0) {
      allErrors.push(...errors)
      continue
    }

    const nameKey = entry.name.toLowerCase()
    if (seenNames.has(nameKey)) {
      allErrors.push(`${fileName}: Duplicate theme name "${entry.name}"`)
      continue
    }
    seenNames.add(nameKey)
    themes.push(entry)
  }

  if (allErrors.length > 0) {
    console.error('Theme validation failed:\n')
    for (const err of allErrors) {
      console.error(`  - ${err}`)
    }
    process.exit(1)
  }

  themes.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }))

  if (isCheckOnly) {
    console.log(`Validated ${themes.length} theme(s) successfully.`)
    return
  }

  const registry = {
    schemaVersion: 1,
    commit: resolveCommitSha(),
    generatedAt: new Date().toISOString(),
    themes,
  }

  writeFileSync(REGISTRY_PATH, `${JSON.stringify(registry, null, 2)}\n`, 'utf8')
  syncPreviews(themes)
  updateReadmeTable(themes)
  console.log(`Generated registry.json, ${themes.length} SVG preview(s), and README table at commit ${registry.commit}.`)
}

main()

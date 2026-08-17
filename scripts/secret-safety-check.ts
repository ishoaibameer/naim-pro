import { execFileSync } from "node:child_process"
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"

interface Finding {
  file: string
  rule: string
}

const textExtensions = new Set([
  ".example",
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".sql",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
])

function trackedFiles(): string[] {
  return execFileSync("git", ["ls-files", "-co", "--exclude-standard"], {
    encoding: "utf8",
  })
    .split(/\r?\n/)
    .filter(Boolean)
}

function filesUnder(directory: string): string[] {
  if (!existsSync(directory)) return []
  const files: string[] = []
  for (const entry of readdirSync(directory)) {
    const location = path.join(directory, entry)
    if (statSync(location).isDirectory()) files.push(...filesUnder(location))
    else files.push(location)
  }
  return files
}

function inspect(file: string): Finding[] {
  if (file.replaceAll("\\", "/") === "scripts/secret-safety-check.ts") return []
  if (
    !textExtensions.has(path.extname(file).toLowerCase()) &&
    path.basename(file) !== "Dockerfile"
  )
    return []
  let content: string
  try {
    content = readFileSync(file, "utf8")
  } catch {
    return []
  }
  const findings: Finding[] = []
  const allowedDummyHash = [
    "$argon2id$v=19$m=19456,p=1,t=2$",
    "Qqp5sAuuK/RSiiCxJT2KZA$",
    "jnKCpX/DFlkIs/ag3+y5QCBSKCg9bhtuj5QcdC+s3PE",
  ].join("")
  const credentialUrl = /postgres(?:ql)?:\/\/[^\s:@]+:([^\s@]+)@/gi
  for (const match of content.matchAll(credentialUrl)) {
    const password = match[1].toLowerCase()
    if (
      !/change-me|replace|placeholder|redacted|test-only|ci-only/.test(password)
    )
      findings.push({ file, rule: "database-url-credential" })
  }
  const rules: Array<[string, RegExp]> = [
    ["neon-password", /\bnpg_[A-Za-z0-9_-]{8,}\b/],
    ["aws-access-key", /\bAKIA[A-Z0-9]{16}\b/],
    [
      "session-secret-assignment",
      /^SESSION_SECRET=(?!.*(?:replace|placeholder|redacted|change-me)).{16,}$/m,
    ],
    [
      "bootstrap-password-assignment",
      /^BOOTSTRAP_ADMIN_PASSWORD=(?!.*(?:replace|placeholder|redacted|change-me)).+$/m,
    ],
  ]
  for (const [rule, pattern] of rules)
    if (pattern.test(content)) findings.push({ file, rule })
  for (const match of content.matchAll(/\$argon2(?:id|i|d)\$v=[^\s"']+/g))
    if (match[0] !== allowedDummyHash)
      findings.push({ file, rule: "argon-password-hash" })
  return findings
}

const candidates = [
  ...new Set([
    ...trackedFiles(),
    ...filesUnder("dist"),
    ...filesUnder(".output"),
  ]),
]
const findings = candidates.flatMap(inspect)
if (findings.length) {
  console.error("Secret-safety scan failed:")
  for (const finding of findings)
    console.error(`- ${finding.file}: ${finding.rule}`)
  process.exitCode = 1
} else {
  console.log(`Secret-safety scan passed (${candidates.length} files checked).`)
}

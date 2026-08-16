import "@tanstack/react-start/server-only"

import argon2 from "argon2"

export const PASSWORD_MIN_LENGTH = 10
export const PASSWORD_MAX_LENGTH = 1024

export const ARGON2ID_PARAMETERS = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  hashLength: 32,
} as const

export const DUMMY_PASSWORD_HASH =
  "$argon2id$v=19$m=19456,p=1,t=2$Qqp5sAuuK/RSiiCxJT2KZA$jnKCpX/DFlkIs/ag3+y5QCBSKCg9bhtuj5QcdC+s3PE"

export function assertPasswordPolicy(password: string): void {
  if (
    password.length < PASSWORD_MIN_LENGTH ||
    password.length > PASSWORD_MAX_LENGTH
  ) {
    throw new Error(
      `Password must contain between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters.`
    )
  }
}

export async function hashPassword(password: string): Promise<string> {
  assertPasswordPolicy(password)

  return argon2.hash(password, {
    type: argon2.argon2id,
    ...ARGON2ID_PARAMETERS,
  })
}

export async function verifyPassword(
  passwordHash: string,
  password: string
): Promise<boolean> {
  try {
    return await argon2.verify(passwordHash, password)
  } catch {
    return false
  }
}

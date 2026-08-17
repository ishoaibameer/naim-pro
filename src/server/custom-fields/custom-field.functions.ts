import { createServerFn } from "@tanstack/react-start"
import { getRequest, setResponseHeader } from "@tanstack/react-start/server"

import { adminMiddleware, authMiddleware } from "@/server/auth/middleware"
import { assertSameOrigin } from "@/server/auth/request-security.server"
import {
  getFormBuilder,
  reorderCustomFields,
  saveCustomFieldDefinition,
  setCustomFieldStatus,
} from "./builder.server"
import {
  customFieldRecordSchema,
  customFieldStatusSchema,
  customFieldTargetSchema,
  reorderCustomFieldsSchema,
  saveCustomFieldDefinitionSchema,
  saveCustomFieldValuesSchema,
  validateCustomFieldCreateValuesSchema,
} from "./schemas"
import {
  getCustomFieldData,
  getCustomFieldDefinitionsForCreate,
  saveCustomFieldValues,
  validateCustomFieldValuesForCreate,
} from "./values.server"

function noStore() {
  setResponseHeader("Cache-Control", "no-store")
}

function mutationRequest() {
  assertSameOrigin(getRequest())
  noStore()
}

export const getFormBuilderFn = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .validator(customFieldTargetSchema)
  .handler(async ({ context, data }) => {
    noStore()
    return getFormBuilder(context.auth, data)
  })

export const saveCustomFieldDefinitionFn = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(saveCustomFieldDefinitionSchema)
  .handler(async ({ context, data }) => {
    mutationRequest()
    return saveCustomFieldDefinition(context.auth, data)
  })

export const setCustomFieldStatusFn = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(customFieldStatusSchema)
  .handler(async ({ context, data }) => {
    mutationRequest()
    await setCustomFieldStatus(context.auth, data)
    return { success: true }
  })

export const reorderCustomFieldsFn = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(reorderCustomFieldsSchema)
  .handler(async ({ context, data }) => {
    mutationRequest()
    await reorderCustomFields(context.auth, data)
    return { success: true }
  })

export const getCustomFieldDataFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(customFieldRecordSchema)
  .handler(async ({ context, data }) => {
    noStore()
    return getCustomFieldData(context.auth, data.target, data.recordId)
  })

export const getCustomFieldDefinitionsForCreateFn = createServerFn({
  method: "GET",
})
  .middleware([authMiddleware])
  .validator(customFieldTargetSchema)
  .handler(async ({ context, data }) => {
    noStore()
    return getCustomFieldDefinitionsForCreate(context.auth, data)
  })

export const saveCustomFieldValuesFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(saveCustomFieldValuesSchema)
  .handler(async ({ context, data }) => {
    mutationRequest()
    return saveCustomFieldValues(context.auth, data)
  })

export const validateCustomFieldValuesForCreateFn = createServerFn({
  method: "POST",
})
  .middleware([authMiddleware])
  .validator(validateCustomFieldCreateValuesSchema)
  .handler(async ({ context, data }) => {
    mutationRequest()
    return validateCustomFieldValuesForCreate(context.auth, data)
  })

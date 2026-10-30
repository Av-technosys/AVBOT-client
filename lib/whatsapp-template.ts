import type { MessageTemplateInput } from './api';

export type ParameterFormat = 'POSITIONAL' | 'NAMED';
export type HeaderFormat = 'NONE' | 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'LOCATION';
export type TemplateButton = {
  type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER' | 'COPY_CODE' | 'VOICE_CALL';
  text: string;
  url: string;
  phoneNumber: string;
  example: string;
};
export type MessageDraft = {
  headerFormat: HeaderFormat;
  headerText: string;
  headerHandle: string;
  headerExamples: Record<string, string>;
  bodyText: string;
  bodyExamples: Record<string, string>;
  footerText: string;
  buttons: TemplateButton[];
};
export const emptyDraft: MessageDraft = {
  headerFormat: 'NONE',
  headerText: '',
  headerHandle: '',
  headerExamples: {},
  bodyText: '',
  bodyExamples: {},
  footerText: '',
  buttons: [],
};
export const metaOptionKeys = [
  'parameter_format',
  'allow_category_change',
  'cta_url_link_tracking_opted_out',
  'message_send_ttl_seconds',
  'sub_category',
  'display_format',
  'library_template_name',
  'library_template_button_inputs',
  'library_template_body_inputs',
  'is_primary_device_delivery_only',
  'send_type',
] as const;
export function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export function variables(text: string): string[] {
  return [...new Set([...text.matchAll(/\{\{([^{}]+)\}\}/g)].map((match) => match[1]))];
}
export function inferParameterFormat(components: Record<string, unknown>[]): ParameterFormat {
  return components.some(
    (component) =>
      (typeof component.text === 'string' &&
        variables(component.text).some((value) => !/^\d+$/.test(value))) ||
      (isObject(component.example) &&
        ('body_text_named_params' in component.example ||
          'header_text_named_params' in component.example)),
  )
    ? 'NAMED'
    : 'POSITIONAL';
}
function textExample(
  kind: 'header' | 'body',
  text: string,
  values: Record<string, string>,
  format: ParameterFormat,
) {
  const keys = variables(text);
  if (!keys.length) return {};
  const sample = (key: string) => (typeof values[key] === 'string' ? values[key] : '');
  return {
    example:
      format === 'NAMED'
        ? {
            [`${kind}_text_named_params`]: keys.map((param_name) => ({
              param_name,
              example: sample(param_name),
            })),
          }
        : {
            [`${kind}_text`]: kind === 'body' ? [keys.map(sample)] : keys.map(sample),
          },
  };
}
export function buildComponents(
  draft: MessageDraft,
  format: ParameterFormat,
): Record<string, unknown>[] {
  const components: Record<string, unknown>[] = [];
  if (draft.headerFormat === 'TEXT')
    components.push({
      type: 'HEADER',
      format: 'TEXT',
      text: draft.headerText,
      ...textExample('header', draft.headerText, draft.headerExamples, format),
    });
  else if (draft.headerFormat === 'LOCATION')
    components.push({ type: 'HEADER', format: 'LOCATION' });
  else if (draft.headerFormat !== 'NONE')
    components.push({
      type: 'HEADER',
      format: draft.headerFormat,
      example: { header_handle: [draft.headerHandle.trim()] },
    });
  components.push({
    type: 'BODY',
    text: draft.bodyText,
    ...textExample('body', draft.bodyText, draft.bodyExamples, format),
  });
  if (draft.footerText.trim()) components.push({ type: 'FOOTER', text: draft.footerText });
  if (draft.buttons.length)
    components.push({
      type: 'BUTTONS',
      buttons: draft.buttons.map((button) => {
        if (button.type === 'COPY_CODE') return { type: button.type, example: button.example };
        return {
          type: button.type,
          text: button.text,
          ...(button.type === 'PHONE_NUMBER' ? { phone_number: button.phoneNumber } : {}),
          ...(button.type === 'URL'
            ? {
                url: button.url,
                ...(variables(button.url).length ? { example: [button.example] } : {}),
              }
            : {}),
        };
      }),
    });
  return components;
}
function examples(component: Record<string, unknown>, kind: 'header' | 'body') {
  const example = isObject(component.example) ? component.example : {};
  const named = example[`${kind}_text_named_params`];
  if (Array.isArray(named))
    return Object.fromEntries(
      named
        .filter(isObject)
        .map((value) => [String(value.param_name), String(value.example ?? '')]),
    );
  const positional = example[`${kind}_text`];
  const values = Array.isArray(positional)
    ? kind === 'body' && Array.isArray(positional[0])
      ? positional[0]
      : positional
    : [];
  return Object.fromEntries(
    variables(String(component.text ?? '')).map((key, index) => [key, String(values[index] ?? '')]),
  );
}
// Only open the guided editor if rebuilding it preserves every component field.
// More specialized formats remain editable in JSON mode without losing data.
export function readDraft(
  components: Record<string, unknown>[],
  format: ParameterFormat,
): MessageDraft | null {
  const draft: MessageDraft = { ...emptyDraft, headerExamples: {}, bodyExamples: {}, buttons: [] };
  for (const component of components) {
    const type = String(component.type).toUpperCase();
    if (type === 'HEADER') {
      const headerFormat = String(component.format).toUpperCase() as HeaderFormat;
      if (!['TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT', 'LOCATION'].includes(headerFormat)) return null;
      draft.headerFormat = headerFormat;
      draft.headerText = String(component.text ?? '');
      draft.headerExamples = examples(component, 'header');
      const handles = isObject(component.example) ? component.example.header_handle : undefined;
      draft.headerHandle = Array.isArray(handles) ? String(handles[0] ?? '') : '';
    } else if (type === 'BODY') {
      if (typeof component.text !== 'string') return null;
      draft.bodyText = component.text;
      draft.bodyExamples = examples(component, 'body');
    } else if (type === 'FOOTER') draft.footerText = String(component.text ?? '');
    else if (type === 'BUTTONS' && Array.isArray(component.buttons)) {
      for (const button of component.buttons) {
        if (
          !isObject(button) ||
          !['QUICK_REPLY', 'URL', 'PHONE_NUMBER', 'COPY_CODE', 'VOICE_CALL'].includes(
            String(button.type).toUpperCase(),
          )
        )
          return null;
        draft.buttons.push({
          type: String(button.type).toUpperCase() as TemplateButton['type'],
          text: String(button.text ?? ''),
          url: String(button.url ?? ''),
          phoneNumber: String(button.phone_number ?? ''),
          example: Array.isArray(button.example)
            ? String(button.example[0] ?? '')
            : String(button.example ?? ''),
        });
      }
    } else return null;
  }
  const normalize = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(normalize);
    if (!isObject(value)) return value;
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [
          key,
          key === 'type' || key === 'format'
            ? String(value[key]).toUpperCase()
            : normalize(value[key]),
        ]),
    );
  };
  return JSON.stringify(normalize(buildComponents(draft, format))) ===
    JSON.stringify(normalize(components))
    ? draft
    : null;
}
export function metaCreatePayload(
  template: Pick<
    MessageTemplateInput,
    'name' | 'language' | 'category' | 'components' | 'metaOptions'
  >,
) {
  const options = template.metaOptions ?? {};
  return {
    ...Object.fromEntries(
      Object.entries(options).filter(([key]) =>
        metaOptionKeys.includes(key as (typeof metaOptionKeys)[number]),
      ),
    ),
    name: template.name.trim(),
    language: template.language.trim(),
    category: template.category,
    parameter_format: options.parameter_format ?? inferParameterFormat(template.components),
    components: template.components,
  };
}
export function validateComponents(components: unknown, format: ParameterFormat): string[] {
  const errors: string[] = [];
  if (
    !Array.isArray(components) ||
    !components.length ||
    !components.every((component) => isObject(component) && typeof component.type === 'string')
  )
    return ['Components must be a non-empty JSON array of objects with a type.'];
  const body = components.filter((component) => String(component.type).toUpperCase() === 'BODY');
  if (body.length !== 1) errors.push('Include exactly one message body.');
  for (const type of ['HEADER', 'FOOTER', 'BUTTONS']) {
    if (components.filter((component) => String(component.type).toUpperCase() === type).length > 1)
      errors.push(`Include at most one ${type.toLowerCase()} component.`);
  }
  function validateText(component: Record<string, unknown>, kind: 'header' | 'body') {
    const text = typeof component.text === 'string' ? component.text : '';
    if (!text.trim()) errors.push(`${kind === 'body' ? 'Body' : 'Header'} text is required.`);
    if (text.length > (kind === 'body' ? 1024 : 60))
      errors.push(`${kind} text exceeds its character limit.`);
    const keys = variables(text);
    if (kind === 'header' && keys.length > 1)
      errors.push('A text header supports only one variable.');
    const stripped = text.replace(/\{\{[^{}]+\}\}/g, '');
    if (/[{}]/.test(stripped))
      errors.push(`Use complete double-brace placeholders in the ${kind}.`);
    if (
      format === 'NAMED'
        ? keys.some((key) => !/^[a-z_]+$/.test(key))
        : keys.some((key, index) => key !== String(index + 1))
    )
      errors.push(
        `Use ${format === 'NAMED' ? 'lowercase names and underscores' : 'sequential variables starting at {{1}}'} in the ${kind}.`,
      );
    const samples = examples(component, kind);
    if (keys.some((key) => typeof samples[key] !== 'string' || !samples[key].trim()))
      errors.push(`Provide a sample value for every ${kind} variable.`);
  }
  for (const component of components) {
    const type = String(component.type).toUpperCase();
    if (type === 'BODY') validateText(component, 'body');
    if (type === 'HEADER') {
      const headerFormat = String(component.format).toUpperCase();
      if (headerFormat === 'TEXT') validateText(component, 'header');
      else if (['IMAGE', 'VIDEO', 'DOCUMENT', 'GIF'].includes(headerFormat)) {
        const handles = isObject(component.example) ? component.example.header_handle : undefined;
        if (
          !Array.isArray(handles) ||
          !handles.length ||
          handles.some((handle) => typeof handle !== 'string' || !handle.trim())
        )
          errors.push(
            'A media header needs a sample asset handle from Meta’s Resumable Upload API.',
          );
      } else if (headerFormat !== 'LOCATION') errors.push('Choose a supported header format.');
    }
    if (
      type === 'FOOTER' &&
      (typeof component.text !== 'string' ||
        !component.text.trim() ||
        component.text.length > 60 ||
        /[{}]/.test(component.text))
    )
      errors.push('Footer text must be 1–60 characters without variables.');
    if (type === 'BUTTONS') {
      if (
        !Array.isArray(component.buttons) ||
        !component.buttons.length ||
        component.buttons.length > 10 ||
        !component.buttons.every(isObject)
      ) {
        errors.push('Add between 1 and 10 buttons.');
        continue;
      }
      const buttons: Record<string, unknown>[] = component.buttons;
      for (const [buttonType, max] of [
        ['URL', 2],
        ['PHONE_NUMBER', 1],
        ['COPY_CODE', 1],
      ] as const) {
        if (
          buttons.filter((button) => String(button.type).toUpperCase() === buttonType).length > max
        )
          errors.push(
            `Use at most ${max} ${buttonType.toLowerCase()} button${max > 1 ? 's' : ''}.`,
          );
      }
      const groups = buttons.map((button) => String(button.type).toUpperCase() === 'QUICK_REPLY');
      if (groups.slice(1).filter((group, index) => group !== groups[index]).length > 1)
        errors.push('Group quick reply buttons together, before or after all other buttons.');
      for (const button of buttons) {
        const buttonType = String(button.type).toUpperCase();
        if (
          ['QUICK_REPLY', 'URL', 'PHONE_NUMBER', 'VOICE_CALL'].includes(buttonType) &&
          (typeof button.text !== 'string' ||
            !button.text.trim() ||
            button.text.length > 25 ||
            /[{}]/.test(button.text))
        )
          errors.push('Button labels must be 1–25 characters without variables.');
        if (
          buttonType === 'PHONE_NUMBER' &&
          (typeof button.phone_number !== 'string' ||
            !/^\+?[\d -]{1,20}$/.test(button.phone_number))
        )
          errors.push('Enter a valid phone button number (maximum 20 characters).');
        if (
          buttonType === 'COPY_CODE' &&
          (typeof button.example !== 'string' ||
            !button.example.trim() ||
            button.example.length > 20)
        )
          errors.push('Copy code buttons need a sample code of 1–20 characters.');
        if (buttonType === 'URL') {
          const url = typeof button.url === 'string' ? button.url : '';
          const keys = variables(url);
          try {
            const parsed = new URL(url.replace(/\{\{[^{}]+\}\}/g, 'sample'));
            if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error();
          } catch {
            errors.push('URL buttons need an http or https URL.');
          }
          if (url.length > 2000) errors.push('Button URLs cannot exceed 2,000 characters.');
          if (keys.length > 1 || (keys.length === 1 && !url.endsWith(`{{${keys[0]}}}`)))
            errors.push('A URL button supports one variable at the end of the URL.');
          if (
            keys.length &&
            (!Array.isArray(button.example) ||
              typeof button.example[0] !== 'string' ||
              !button.example[0].trim())
          )
            errors.push('Dynamic URL buttons need a sample URL suffix.');
          if (keys.some((key) => (format === 'NAMED' ? !/^[a-z_]+$/.test(key) : key !== '1')))
            errors.push('URL variables must match the selected parameter format.');
        }
      }
    }
  }
  return [...new Set(errors)];
}

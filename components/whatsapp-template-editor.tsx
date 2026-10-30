'use client';

import { useEffect, useState } from 'react';
import {
  CopyIcon,
  FileTextIcon,
  ImageIcon,
  MapPinIcon,
  MessageCircleIcon,
  PhoneIcon,
  PlusIcon,
  Trash2Icon,
  VideoIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { MessageTemplate, MessageTemplateInput, WhatsappAccount } from '@/lib/api';
import {
  buildComponents,
  emptyDraft,
  inferParameterFormat,
  isObject,
  metaCreatePayload,
  metaOptionKeys,
  readDraft,
  validateComponents,
  variables,
  type HeaderFormat,
  type MessageDraft,
  type ParameterFormat,
  type TemplateButton,
} from '@/lib/whatsapp-template';

const docsUrl =
  'https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/components';
const selectClass = 'bg-background w-full rounded-lg border p-2 text-sm';
const buttonTypes: { value: TemplateButton['type']; label: string }[] = [
  { value: 'QUICK_REPLY', label: 'Quick reply' },
  { value: 'URL', label: 'Visit website' },
  { value: 'PHONE_NUMBER', label: 'Call phone number' },
  { value: 'COPY_CODE', label: 'Copy offer code' },
  { value: 'VOICE_CALL', label: 'Call on WhatsApp' },
];

function VariableSamples({
  text,
  values,
  onChange,
  kind,
}: {
  text: string;
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
  kind: string;
}) {
  const keys = variables(text);
  if (!keys.length) return null;
  return (
    <div className="bg-muted/30 space-y-3 rounded-lg border p-3">
      <p className="text-sm font-medium">{kind} variable samples</p>
      <p className="text-muted-foreground text-xs">
        Meta requires a sample for every variable. Samples also populate the preview.
      </p>
      {keys.map((key) => (
        <div key={key} className="space-y-1">
          <Label htmlFor={`sample-${kind}-${key}`}>{`Sample for {{${key}}}`}</Label>
          <Input
            id={`sample-${kind}-${key}`}
            required
            value={values[key] ?? ''}
            onChange={(event) => onChange({ ...values, [key]: event.target.value })}
            placeholder="e.g. Ashish"
          />
        </div>
      ))}
    </div>
  );
}

function sampleText(component: Record<string, unknown>, kind: 'header' | 'body') {
  let text = String(component.text ?? '');
  const example = isObject(component.example) ? component.example : {};
  const named = example[`${kind}_text_named_params`];
  const positional = example[`${kind}_text`];
  const values = Array.isArray(positional)
    ? kind === 'body' && Array.isArray(positional[0])
      ? positional[0]
      : positional
    : [];
  variables(text).forEach((key, index) => {
    const value = Array.isArray(named)
      ? named.find((value) => isObject(value) && value.param_name === key)?.example
      : values[index];
    if (typeof value === 'string' && value) text = text.split(`{{${key}}}`).join(value);
  });
  return text;
}

function FormattedText({ text }: { text: string }) {
  // Render WhatsApp's simple inline formatting through React; user text never becomes HTML.
  return (
    <>
      {text.split(/(\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~|```[^`]+```)/g).map((part, index) => {
        if (part.startsWith('```') && part.endsWith('```'))
          return <code key={index}>{part.slice(3, -3)}</code>;
        if (part.startsWith('*') && part.endsWith('*'))
          return <strong key={index}>{part.slice(1, -1)}</strong>;
        if (part.startsWith('_') && part.endsWith('_'))
          return <em key={index}>{part.slice(1, -1)}</em>;
        if (part.startsWith('~') && part.endsWith('~'))
          return <s key={index}>{part.slice(1, -1)}</s>;
        return part;
      })}
    </>
  );
}

export function WhatsappMessagePreview({
  components,
  media,
}: {
  components: Record<string, unknown>[];
  media?: { url: string; name: string } | null;
}) {
  const header = components.find((component) => String(component.type).toUpperCase() === 'HEADER');
  const body = components.find((component) => String(component.type).toUpperCase() === 'BODY');
  const footer = components.find((component) => String(component.type).toUpperCase() === 'FOOTER');
  const buttonsComponent = components.find(
    (component) => String(component.type).toUpperCase() === 'BUTTONS',
  );
  const buttons =
    buttonsComponent && Array.isArray(buttonsComponent.buttons)
      ? buttonsComponent.buttons.filter(isObject)
      : [];
  const format = String(header?.format ?? '').toUpperCase();
  const extras = components.filter(
    (component) =>
      !['HEADER', 'BODY', 'FOOTER', 'BUTTONS'].includes(String(component.type).toUpperCase()),
  );
  return (
    <div
      aria-label="Live WhatsApp message preview"
      className="rounded-xl border bg-[#e7e2d9] p-5 text-slate-900"
    >
      <div className="mb-4 flex items-center gap-2 text-xs text-slate-600">
        <MessageCircleIcon className="size-4 text-emerald-700" /> WhatsApp message preview
      </div>
      <div className="mx-auto max-w-sm overflow-hidden rounded-lg rounded-tl-none bg-white shadow-sm">
        <div className="space-y-2 p-3">
          {header && format === 'TEXT' && (
            <p className="font-semibold break-words whitespace-pre-wrap">
              {sampleText(header, 'header') || 'Header text'}
            </p>
          )}
          {header && format !== 'TEXT' && (
            <div className="flex min-h-32 flex-col items-center justify-center gap-2 overflow-hidden rounded-md bg-slate-100 text-slate-500">
              {format === 'IMAGE' &&
                (media ? (
                  <div
                    role="img"
                    aria-label={media.name}
                    className="h-44 w-full bg-cover bg-center"
                    style={{ backgroundImage: `url(${media.url})` }}
                  />
                ) : (
                  <ImageIcon className="size-10" />
                ))}
              {format === 'VIDEO' &&
                (media ? (
                  <video src={media.url} controls className="w-full" />
                ) : (
                  <VideoIcon className="size-10" />
                ))}
              {format === 'DOCUMENT' && <FileTextIcon className="size-10" />}
              {format === 'LOCATION' && <MapPinIcon className="size-10" />}
              {!['IMAGE', 'VIDEO', 'DOCUMENT', 'LOCATION'].includes(format) && (
                <FileTextIcon className="size-10" />
              )}
              <p className="px-3 pb-2 text-xs">{media?.name || `${format.toLowerCase()} header`}</p>
            </div>
          )}
          <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
            <FormattedText
              text={
                body
                  ? sampleText(body, 'body') || 'Your message will appear here…'
                  : 'Your message will appear here…'
              }
            />
          </p>
          {footer && (
            <p className="text-xs break-words whitespace-pre-wrap text-slate-500">
              {String(footer.text ?? '')}
            </p>
          )}
          {extras.map((component, index) => (
            <div key={index} className="rounded border border-dashed p-3 text-xs text-slate-500">
              {String(component.type)} component · see API payload for details
            </div>
          ))}
          <p className="text-right text-[10px] text-slate-400">12:00 ✓✓</p>
        </div>
        {buttons.map((button, index) => (
          <div
            key={index}
            className="flex items-center justify-center gap-2 border-t px-3 py-3 text-sm font-medium text-sky-600"
          >
            {String(button.type).toUpperCase() === 'PHONE_NUMBER' ||
            String(button.type).toUpperCase() === 'VOICE_CALL' ? (
              <PhoneIcon className="size-4" />
            ) : String(button.type).toUpperCase() === 'COPY_CODE' ? (
              <CopyIcon className="size-4" />
            ) : null}
            {String(button.type).toUpperCase() === 'COPY_CODE'
              ? 'Copy code'
              : String(button.text || 'Button label')}
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-[11px] text-slate-500">
        Illustrative preview using your sample values.
      </p>
    </div>
  );
}

export function WhatsappTemplateEditor({
  template,
  account,
  busy,
  error,
  onSave,
  onCancel,
}: {
  template?: MessageTemplate;
  account?: WhatsappAccount;
  busy: boolean;
  error: string;
  onSave: (input: MessageTemplateInput) => Promise<void>;
  onCancel: () => void;
}) {
  const initialFormat =
    template?.metaOptions?.parameter_format === 'NAMED'
      ? 'NAMED'
      : template?.metaOptions?.parameter_format === 'POSITIONAL'
        ? 'POSITIONAL'
        : inferParameterFormat(template?.components ?? []);
  const [format, setFormat] = useState<ParameterFormat>(initialFormat);
  const initialDraft = template ? readDraft(template.components, initialFormat) : emptyDraft;
  const [draft, setDraft] = useState<MessageDraft>(initialDraft ?? emptyDraft);
  const [mode, setMode] = useState<'guided' | 'json'>(initialDraft ? 'guided' : 'json');
  const [raw, setRaw] = useState(
    JSON.stringify(template?.components ?? buildComponents(emptyDraft, initialFormat), null, 2),
  );
  const [name, setName] = useState(template?.name ?? '');
  const [language, setLanguage] = useState(template?.language ?? 'en_US');
  const [category, setCategory] = useState(template?.category ?? 'UTILITY');
  const [schema, setSchema] = useState(
    template?.variableSchema ? JSON.stringify(template.variableSchema, null, 2) : '',
  );
  const [options, setOptions] = useState(
    JSON.stringify(
      Object.fromEntries(
        Object.entries(template?.metaOptions ?? {}).filter(([key]) => key !== 'parameter_format'),
      ),
      null,
      2,
    ),
  );
  const [validation, setValidation] = useState<string[]>([]);
  const [media, setMedia] = useState<{ url: string; name: string } | null>(null);
  useEffect(
    () => () => {
      if (media) URL.revokeObjectURL(media.url);
    },
    [media],
  );

  let components: Record<string, unknown>[] = [];
  let jsonError = '';
  let parsedOptions: Record<string, unknown> = {};
  try {
    components = mode === 'guided' ? buildComponents(draft, format) : JSON.parse(raw);
    if (!Array.isArray(components) || !components.every(isObject))
      throw new Error('Components must be an array of JSON objects.');
    parsedOptions = options.trim() ? JSON.parse(options) : {};
    if (!isObject(parsedOptions)) throw new Error('Meta options must be a JSON object.');
  } catch (err) {
    jsonError =
      err instanceof SyntaxError
        ? 'Enter valid JSON to update the payload.'
        : (err as Error).message;
    if (!Array.isArray(components) || !components.every(isObject)) components = [];
  }
  const payload = metaCreatePayload({
    name,
    language,
    category,
    components,
    metaOptions: { ...parsedOptions, parameter_format: format },
  });

  function changeMode(next: 'guided' | 'json') {
    if (next === mode) return;
    if (next === 'json') setRaw(JSON.stringify(buildComponents(draft, format), null, 2));
    else {
      const restored = !jsonError ? readDraft(components, format) : null;
      if (!restored) {
        setValidation([
          'These components use fields outside the guided builder. Continue in JSON mode to preserve them.',
        ]);
        return;
      }
      setDraft(restored);
    }
    setMode(next);
    setValidation([]);
  }
  function updateButton(index: number, values: Partial<TemplateButton>) {
    setDraft((previous) => ({
      ...previous,
      buttons: previous.buttons.map((button, position) =>
        position === index ? { ...button, ...values } : button,
      ),
    }));
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    const errors = jsonError ? [jsonError] : validateComponents(components, format);
    if (!/^[a-z0-9_]{1,512}$/.test(name.trim()))
      errors.push(
        'Use a template name with lowercase letters, numbers, and underscores (maximum 512 characters).',
      );
    if (!language.trim()) errors.push('Choose a language code.');
    if (!['UTILITY', 'MARKETING'].includes(category)) errors.push('Choose Utility or Marketing.');
    if (
      Object.keys(parsedOptions).some(
        (key) =>
          !metaOptionKeys.includes(key as (typeof metaOptionKeys)[number]) ||
          key === 'parameter_format',
      )
    )
      errors.push('Use supported Meta options only; set parameter format with the dropdown above.');
    let variableSchema: Record<string, unknown> | null = null;
    try {
      variableSchema = schema.trim() ? JSON.parse(schema) : null;
      if (variableSchema !== null && !isObject(variableSchema)) throw new Error();
    } catch {
      errors.push('Variable schema must be a JSON object or null.');
    }
    setValidation(errors);
    if (errors.length) return;
    await onSave({
      name: name.trim(),
      language: language.trim(),
      category,
      components,
      variableSchema,
      metaOptions: { ...parsedOptions, parameter_format: format },
    });
  }
  async function copyPayload() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      toast.success('Meta create-template payload copied');
    } catch {
      toast.error('Could not copy payload');
    }
  }
  const headerVariables = variables(draft.headerText);
  const bodyVariables = variables(draft.bodyText);
  return (
    <form
      onSubmit={submit}
      className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.75fr)]"
    >
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>{template ? 'Edit template' : 'Create template'}</CardTitle>
          <CardDescription>
            Start with the message body. Add any optional components you need.
          </CardDescription>
          <a
            href={docsUrl}
            target="_blank"
            rel="noreferrer"
            className="text-primary text-xs underline"
          >
            Meta component guide ↗
          </a>
        </CardHeader>
        <CardContent>
          <fieldset disabled={busy} className="min-w-0 space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="template-name">Template name</Label>
                <Input
                  id="template-name"
                  required
                  pattern="[a-z0-9_]+"
                  maxLength={512}
                  value={name}
                  readOnly={Boolean(template?.providerTemplateId)}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="order_confirmation"
                />
                <p className="text-muted-foreground text-xs">
                  Lowercase letters, numbers, and underscores.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="template-language">Language code</Label>
                <Input
                  id="template-language"
                  required
                  maxLength={255}
                  value={language}
                  readOnly={Boolean(template?.providerTemplateId)}
                  onChange={(event) => setLanguage(event.target.value)}
                  placeholder="en_US"
                  list="template-languages"
                />
                <datalist id="template-languages">
                  {['en_US', 'en_GB', 'en', 'hi', 'es', 'pt_BR', 'fr', 'ar'].map((code) => (
                    <option key={code} value={code} />
                  ))}
                </datalist>
                <a
                  className="text-primary text-xs underline"
                  href="https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/supported-languages"
                  target="_blank"
                  rel="noreferrer"
                >
                  All supported language codes ↗
                </a>
              </div>
              <div className="space-y-2">
                <Label htmlFor="template-category">Category</Label>
                <select
                  id="template-category"
                  className={selectClass}
                  required
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                >
                  {!['UTILITY', 'MARKETING'].includes(category) && (
                    <option value={category} disabled>
                      {category || 'Select category'}
                    </option>
                  )}
                  <option value="UTILITY">Utility</option>
                  <option value="MARKETING">Marketing</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="template-format">Variable format</Label>
                <select
                  id="template-format"
                  className={selectClass}
                  disabled={Boolean(template?.providerTemplateId)}
                  value={format}
                  onChange={(event) => setFormat(event.target.value as ParameterFormat)}
                >
                  <option value="POSITIONAL">Positional: {'{{1}}, {{2}}'}</option>
                  <option value="NAMED">Named: {'{{first_name}}'}</option>
                </select>
              </div>
            </div>
            <div className="flex flex-wrap gap-2" aria-label="Message editor mode">
              <Button
                type="button"
                variant={mode === 'guided' ? 'secondary' : 'outline'}
                onClick={() => changeMode('guided')}
              >
                Message builder
              </Button>
              <Button
                type="button"
                variant={mode === 'json' ? 'secondary' : 'outline'}
                onClick={() => changeMode('json')}
              >
                Advanced components JSON
              </Button>
            </div>
            {mode === 'guided' ? (
              <>
                <section className="space-y-3 rounded-lg border p-4" aria-label="Optional header">
                  <div>
                    <h2 className="font-medium">
                      Header <span className="text-muted-foreground text-xs">Optional</span>
                    </h2>
                    <p className="text-muted-foreground text-xs">
                      Choose text, media, or a location above your message.
                    </p>
                  </div>
                  <Label htmlFor="template-header-format">Header type</Label>
                  <select
                    id="template-header-format"
                    className={selectClass}
                    value={draft.headerFormat}
                    onChange={(event) => {
                      setDraft((previous) => ({
                        ...previous,
                        headerFormat: event.target.value as HeaderFormat,
                      }));
                      setMedia(null);
                    }}
                  >
                    {['NONE', 'TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT', 'LOCATION'].map((value) => (
                      <option key={value} value={value}>
                        {value === 'NONE' ? 'No header' : value[0] + value.slice(1).toLowerCase()}
                      </option>
                    ))}
                  </select>
                  {draft.headerFormat === 'TEXT' && (
                    <>
                      <Label htmlFor="template-header-text">Header text</Label>
                      <Input
                        id="template-header-text"
                        required
                        maxLength={60}
                        value={draft.headerText}
                        onChange={(event) =>
                          setDraft((previous) => ({ ...previous, headerText: event.target.value }))
                        }
                        placeholder="Your order update"
                      />
                      <p className="text-muted-foreground text-xs">
                        {draft.headerText.length}/60 characters · at most one variable · no text
                        formatting
                      </p>
                      <VariableSamples
                        kind="Header"
                        text={draft.headerText}
                        values={draft.headerExamples}
                        onChange={(values) =>
                          setDraft((previous) => ({ ...previous, headerExamples: values }))
                        }
                      />
                    </>
                  )}
                  {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(draft.headerFormat) && (
                    <>
                      <Label htmlFor="template-header-handle">Meta sample media handle</Label>
                      <Input
                        id="template-header-handle"
                        required
                        value={draft.headerHandle}
                        onChange={(event) =>
                          setDraft((previous) => ({
                            ...previous,
                            headerHandle: event.target.value,
                          }))
                        }
                        placeholder="4::…"
                      />
                      <p className="text-muted-foreground text-xs">
                        Paste the handle returned by{' '}
                        <a
                          href="https://developers.facebook.com/docs/graph-api/guides/upload"
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary underline"
                        >
                          Meta’s Resumable Upload API
                        </a>
                        . A media ID or public URL is not a template sample handle.
                      </p>
                      <Label htmlFor="template-preview-file">Preview file (optional)</Label>
                      <Input
                        id="template-preview-file"
                        type="file"
                        accept={
                          draft.headerFormat === 'IMAGE'
                            ? 'image/png,image/jpeg'
                            : draft.headerFormat === 'VIDEO'
                              ? 'video/mp4'
                              : 'application/pdf'
                        }
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          setMedia(
                            file ? { url: URL.createObjectURL(file), name: file.name } : null,
                          );
                        }}
                      />
                      <p className="text-muted-foreground text-xs">
                        This file is used only for the preview. It is not uploaded or saved.
                      </p>
                    </>
                  )}
                  {draft.headerFormat === 'LOCATION' && (
                    <p className="text-muted-foreground text-xs">
                      A map placeholder is included in the template. Latitude, longitude, name, and
                      address are supplied when sending.
                    </p>
                  )}
                </section>
                <section className="space-y-3 rounded-lg border p-4" aria-label="Message body">
                  <h2 className="font-medium">
                    Body <span className="text-muted-foreground text-xs">Required by Meta</span>
                  </h2>
                  <Label htmlFor="template-body">Message text</Label>
                  <Textarea
                    id="template-body"
                    required
                    rows={7}
                    maxLength={1024}
                    value={draft.bodyText}
                    onChange={(event) =>
                      setDraft((previous) => ({ ...previous, bodyText: event.target.value }))
                    }
                    placeholder={
                      format === 'NAMED'
                        ? 'Hi {{first_name}}, your order {{order_number}} is confirmed.'
                        : 'Hi {{1}}, your order {{2}} is confirmed.'
                    }
                  />
                  <div className="flex flex-wrap justify-between gap-2 text-xs">
                    <span className="text-muted-foreground">
                      {draft.bodyText.length}/1,024 characters · *bold*, _italic_, ~strikethrough~
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={() => {
                        const key =
                          format === 'POSITIONAL'
                            ? String(bodyVariables.length + 1)
                            : `variable_${String.fromCharCode(97 + (bodyVariables.length % 26))}`;
                        setDraft((previous) => ({
                          ...previous,
                          bodyText: `${previous.bodyText}${previous.bodyText && !previous.bodyText.endsWith(' ') ? ' ' : ''}{{${key}}}`,
                        }));
                      }}
                    >
                      Add variable
                    </Button>
                  </div>
                  <VariableSamples
                    kind="Body"
                    text={draft.bodyText}
                    values={draft.bodyExamples}
                    onChange={(values) =>
                      setDraft((previous) => ({ ...previous, bodyExamples: values }))
                    }
                  />
                </section>
                <section className="space-y-3 rounded-lg border p-4" aria-label="Optional footer">
                  <h2 className="font-medium">
                    Footer <span className="text-muted-foreground text-xs">Optional</span>
                  </h2>
                  <Label htmlFor="template-footer">Footer text</Label>
                  <Input
                    id="template-footer"
                    maxLength={60}
                    value={draft.footerText}
                    onChange={(event) =>
                      setDraft((previous) => ({ ...previous, footerText: event.target.value }))
                    }
                    placeholder="Reply STOP to unsubscribe"
                  />
                  <p className="text-muted-foreground text-xs">
                    {draft.footerText.length}/60 characters · plain text, no variables
                  </p>
                </section>
                <section className="space-y-3 rounded-lg border p-4" aria-label="Optional buttons">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="font-medium">
                      Buttons <span className="text-muted-foreground text-xs">Optional</span>
                    </h2>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={draft.buttons.length >= 10}
                      onClick={() =>
                        setDraft((previous) => ({
                          ...previous,
                          buttons: [
                            ...previous.buttons,
                            {
                              type: 'QUICK_REPLY',
                              text: '',
                              url: '',
                              phoneNumber: '',
                              example: '',
                            },
                          ],
                        }))
                      }
                    >
                      <PlusIcon /> Add button
                    </Button>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Up to 10 buttons; at most 2 websites, 1 phone number, and 1 copy code. Keep
                    quick replies grouped together.
                  </p>
                  {draft.buttons.map((button, index) => (
                    <div key={index} className="space-y-3 rounded-lg border p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">Button {index + 1}</p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Remove button ${index + 1}`}
                          onClick={() =>
                            setDraft((previous) => ({
                              ...previous,
                              buttons: previous.buttons.filter((_, position) => position !== index),
                            }))
                          }
                        >
                          <Trash2Icon />
                        </Button>
                      </div>
                      <Label htmlFor={`button-type-${index}`}>Button type</Label>
                      <select
                        id={`button-type-${index}`}
                        className={selectClass}
                        value={button.type}
                        onChange={(event) =>
                          updateButton(index, {
                            type: event.target.value as TemplateButton['type'],
                          })
                        }
                      >
                        {buttonTypes.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                      {button.type !== 'COPY_CODE' && (
                        <>
                          <Label htmlFor={`button-label-${index}`}>Button label</Label>
                          <Input
                            id={`button-label-${index}`}
                            required
                            maxLength={25}
                            value={button.text}
                            onChange={(event) => updateButton(index, { text: event.target.value })}
                            placeholder="e.g. Track order"
                          />
                        </>
                      )}
                      {button.type === 'URL' && (
                        <>
                          <Label htmlFor={`button-url-${index}`}>Website URL</Label>
                          <Input
                            id={`button-url-${index}`}
                            required
                            maxLength={2000}
                            value={button.url}
                            onChange={(event) => updateButton(index, { url: event.target.value })}
                            placeholder="https://example.com/order/{{1}}"
                          />
                          <p className="text-muted-foreground text-xs">
                            One optional variable is allowed at the end of the URL.
                          </p>
                          {variables(button.url).length > 0 && (
                            <>
                              <Label htmlFor={`button-example-${index}`}>Sample URL suffix</Label>
                              <Input
                                id={`button-example-${index}`}
                                required
                                value={button.example}
                                onChange={(event) =>
                                  updateButton(index, { example: event.target.value })
                                }
                                placeholder="order_123"
                              />
                            </>
                          )}
                        </>
                      )}
                      {button.type === 'PHONE_NUMBER' && (
                        <>
                          <Label htmlFor={`button-phone-${index}`}>Phone number</Label>
                          <Input
                            id={`button-phone-${index}`}
                            required
                            maxLength={20}
                            value={button.phoneNumber}
                            onChange={(event) =>
                              updateButton(index, { phoneNumber: event.target.value })
                            }
                            placeholder="+919876543210"
                          />
                        </>
                      )}
                      {button.type === 'COPY_CODE' && (
                        <>
                          <Label htmlFor={`button-example-${index}`}>Sample offer code</Label>
                          <Input
                            id={`button-example-${index}`}
                            required
                            maxLength={20}
                            value={button.example}
                            onChange={(event) =>
                              updateButton(index, { example: event.target.value })
                            }
                            placeholder="SAVE20"
                          />
                        </>
                      )}
                    </div>
                  ))}
                </section>
              </>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="template-components">Meta components JSON</Label>
                <Textarea
                  id="template-components"
                  required
                  rows={18}
                  className="font-mono text-xs"
                  value={raw}
                  onChange={(event) => setRaw(event.target.value)}
                />
                <p className="text-muted-foreground text-xs">
                  Use this for specialized components such as carousels, product/catalog buttons,
                  Flows, and limited-time offers. Their extra fields are preserved. The preview
                  shows the common components.
                </p>
              </div>
            )}
            <details className="rounded-lg border p-4">
              <summary className="cursor-pointer font-medium">Advanced settings (optional)</summary>
              <div className="mt-4 space-y-4">
                <Label htmlFor="template-meta-options">
                  Additional Meta creation options (JSON object)
                </Label>
                {template?.providerTemplateId && (
                  <p className="text-muted-foreground text-xs">
                    Creation options and variable format are fixed after submission. Only
                    message_send_ttl_seconds can be changed here when editing.
                  </p>
                )}
                <Textarea
                  id="template-meta-options"
                  rows={5}
                  className="font-mono text-xs"
                  value={options}
                  onChange={(event) => setOptions(event.target.value)}
                  placeholder={'{ "allow_category_change": true }'}
                />
                <p className="text-muted-foreground text-xs">
                  Supports category reassignment, link tracking, message TTL, sub-category, display
                  format, library template inputs, primary-device delivery, and send type. Omit
                  fields you do not need. Category-specific restrictions still apply.
                </p>
                <a
                  href="https://developers.facebook.com/documentation/business-messaging/whatsapp/reference/whatsapp-business-account/message-template-api#post-version-waba-id-message-templates"
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary text-xs underline"
                >
                  Meta creation options reference ↗
                </a>
                <details>
                  <summary className="cursor-pointer text-sm">Supported option names</summary>
                  <ul className="text-muted-foreground mt-2 space-y-1 font-mono text-xs">
                    {metaOptionKeys
                      .filter((key) => key !== 'parameter_format')
                      .map((key) => (
                        <li key={key}>{key}</li>
                      ))}
                  </ul>
                </details>
                <Label htmlFor="template-variables">Local variable schema (JSON object)</Label>
                <Textarea
                  id="template-variables"
                  rows={3}
                  className="font-mono text-xs"
                  value={schema}
                  onChange={(event) => setSchema(event.target.value)}
                  placeholder={'{ "1": { "name": "customer_name", "type": "string" } }'}
                />
                <p className="text-muted-foreground text-xs">
                  Optional application metadata. This field is excluded from the Meta payload.
                </p>
              </div>
            </details>
            <details className="rounded-lg border p-4">
              <summary className="cursor-pointer font-medium">Meta review status</summary>
              <div className="mt-4 space-y-3">
                <Label htmlFor="template-status">Status</Label>
                <Input id="template-status" value={template?.status ?? 'Not submitted'} readOnly />
                <p className="text-muted-foreground text-xs">
                  Meta updates this status after review. Pending, rejected, paused, and disabled
                  templates are inactive.
                </p>
                <Label htmlFor="template-provider-id">Meta template ID</Label>
                <Input
                  id="template-provider-id"
                  value={template?.providerTemplateId ?? 'Assigned after submission'}
                  readOnly
                />
                <p className="text-muted-foreground text-sm">
                  Active: {template?.isActive ? 'Yes' : 'No'}
                </p>
              </div>
            </details>
            {(validation.length > 0 || error) && (
              <div role="alert" className="text-destructive space-y-1 text-sm">
                {validation.map((message, index) => (
                  <p key={index}>{message}</p>
                ))}
                {error && <p>{error}</p>}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="submit">{busy ? 'Submitting...' : 'Save and submit to Meta'}</Button>
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">
              Saves to your template library and submits to Meta using this WhatsApp account.
              Approval and rejection updates arrive automatically after review.
            </p>
          </fieldset>
        </CardContent>
      </Card>
      <aside className="min-w-0 space-y-4 lg:sticky lg:top-5">
        <Card>
          <CardHeader>
            <CardTitle>Live preview</CardTitle>
            <CardDescription>
              {category === 'MARKETING' ? 'Marketing' : 'Utility'} · {language || 'Language'}
              {mode === 'guided' && (bodyVariables.length || headerVariables.length)
                ? ' · sample values'
                : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <WhatsappMessagePreview components={components} media={media} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>Meta API payload</CardTitle>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={Boolean(jsonError)}
                onClick={copyPayload}
              >
                <CopyIcon /> Copy JSON
              </Button>
            </div>
            <CardDescription>Creation request for the selected business account.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-muted-foreground font-mono text-xs break-all">
              POST https://graph.facebook.com/{account?.apiVersion || '{API_VERSION}'}/
              {account?.businessAccountId || '{WABA_ID}'}/message_templates
            </p>
            {jsonError ? (
              <p role="alert" className="text-destructive text-sm">
                {jsonError}
              </p>
            ) : (
              <pre
                aria-label="Meta create-template JSON"
                className="bg-muted max-h-96 overflow-auto rounded-lg p-3 font-mono text-xs"
              >
                {JSON.stringify(payload, null, 2)}
              </pre>
            )}
            <p className="text-muted-foreground text-xs">
              Authorization: Bearer your access token · Content-Type: application/json
            </p>
          </CardContent>
        </Card>
      </aside>
    </form>
  );
}

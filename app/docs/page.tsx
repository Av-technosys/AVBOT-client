import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const endpoints = [
  [
    'GET',
    '/tenants/:tenantId/campaign-templates',
    'List saved templates across this tenant’s WhatsApp accounts.',
  ],
  [
    'GET / PUT',
    '/tenants/:tenantId/campaigns/:campaignId/flow',
    'Load or atomically save nodes, edges, positions, and the entry node. PUT includes the loaded updatedAt value.',
  ],
  ['GET / POST', '/tenants/:tenantId/whatsapp-accounts', 'List or create accounts for a tenant.'],
  [
    'GET / PUT / DELETE',
    '/tenants/:tenantId/whatsapp-accounts/:accountId',
    'View, update, or delete the selected account.',
  ],
  [
    'GET / POST',
    '/tenants/:tenantId/whatsapp-accounts/:accountId/numbers',
    'List or add phone numbers under this account.',
  ],
  [
    'GET / PUT / DELETE',
    '/tenants/:tenantId/whatsapp-accounts/:accountId/numbers/:id',
    'View, update, or delete one phone number.',
  ],
  [
    'GET / POST',
    '/tenants/:tenantId/whatsapp-accounts/:accountId/templates',
    'List or create messageTemplates records for the selected account.',
  ],
  [
    'GET / PUT / DELETE',
    '/tenants/:tenantId/whatsapp-accounts/:accountId/templates/:templateId',
    'View, update, or delete one message template.',
  ],
];

export default function DocsPage() {
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <Link href="/tenant" className="text-primary text-sm">
        Back to tenants
      </Link>
      <div>
        <h1 className="text-2xl font-semibold">Connect WhatsApp</h1>
        <p className="text-muted-foreground mt-2">Tenant → WhatsApp account → phone numbers</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>1. Save a WhatsApp account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            Open a tenant, choose WhatsApp Connect, and add the business account ID, API version,
            encrypted access token, and encrypted webhook secret. The access token field is
            optional.
          </p>
          <p>
            Saved credentials are visible on account cards and loaded into the edit form. Leave a
            credential field blank when editing to preserve its saved value.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>2. Add the account’s phone numbers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            Select Manage numbers on the saved account. Add each WhatsApp Phone Number ID and its
            phone number. Repeat to connect multiple numbers to the same account.
          </p>
          <p>
            Each number belongs to the selected account and its tenant. Number IDs and phone numbers
            must be unique. Deleting an account removes its numbers; records referenced by
            conversations or templates may prevent deletion.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>3. Manage WhatsApp templates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            Open WhatsApp Templates from WhatsApp Connect, select an account, and create, view,
            edit, or delete its saved templates. Search by name, language, category, or status. Use
            Sync from Meta to import templates already in WhatsApp Manager. Local drafts are
            preserved; edit a draft and choose Save and submit to Meta to send it for review.
          </p>
          <p>
            The message builder includes optional text/media/location headers, a footer, and
            quick-reply, website, phone, copy-code, and WhatsApp-call buttons. The preview on the
            right updates as you type and replaces variables with their sample values.
          </p>
          <p>
            Saving creates or updates the template in Meta using the selected account’s Business
            Account ID, API version, and access token. Meta assigns the template ID and review
            status. The status webhook activates approved templates and deactivates pending,
            rejected, paused, disabled, archived, or deleted templates.
          </p>
          <p>
            A name and language pair must be unique within an account. Templates referenced by
            campaigns cannot be removed until their campaign references are removed. Deleting a
            local record does not delete the template in Meta.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>4. Build a campaign workflow</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            Open Campaigns and choose Workspace, or create a campaign to open its canvas. Add nodes,
            drag them into position, and connect a Seen or Unseen output on the right to another
            node’s incoming handle on the left. Select a node or connection for additional settings.
          </p>
          <p>
            Every node requires a saved WhatsApp template from the current tenant. Regular delays
            are 1, 5, 10, 15, or 30 minutes; 5 or 12 hours; or 1, 2, 3, 5, 7, or 10 days. New nodes
            default to 5 hours.
          </p>
          <p>
            Enable Send message on seen to choose a delay of 1, 5, 10, 15, or 30 minutes; 1, 5, 8,
            or 12 hours; or 1, 2, or 3 days. The seen delay must be shorter than the regular delay.
            Disabling the toggle clears the seen delay. The regular delay remains available as the
            unseen fallback.
          </p>
          <p>
            Each node has only two outgoing connectors: Seen and Unseen / delivered. Connecting Seen
            enables Send message on seen and uses its shorter delay. Unseen / delivered uses the
            regular delay. Outcomes are stored in campaignEdges.branchKey as SEEN and NOT_SEEN; each
            outcome connects to one next node. Save workflow persists the entire graph together.
            Node IDs remain stable; each outgoing edge uses a unique branchKey. Reload if another
            editor has changed the campaign. These settings configure the workflow; scheduling and
            message delivery require the campaign runner.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Meta template creation fields</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p>
            Copy the generated JSON for POST /{'{API_VERSION}'}/{'{WABA_ID}'}/message_templates.
            Include Authorization: Bearer {'{ACCESS_TOKEN}'} and Content-Type: application/json.
            Status, provider template ID, active state, and the local variable schema are excluded.
          </p>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th scope="col" className="p-3">
                    Field
                  </th>
                  <th scope="col" className="p-3">
                    Requirement
                  </th>
                  <th scope="col" className="p-3">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['name', 'Required', 'Up to 512 lowercase letters, numbers, and underscores.'],
                  ['language', 'Required', 'A supported Meta language code, such as en_US or hi.'],
                  [
                    'category',
                    'Required',
                    'This builder supports UTILITY and MARKETING. Authentication uses a separate component format.',
                  ],
                  [
                    'parameter_format',
                    'Optional',
                    'POSITIONAL ({{1}}, {{2}}) or NAMED ({{first_name}}). Every variable needs a sample.',
                  ],
                  [
                    'HEADER',
                    'Optional',
                    'One header: TEXT (60 characters, one variable), IMAGE, VIDEO, DOCUMENT, or LOCATION. Media needs example.header_handle from the Resumable Upload API. Location values are supplied when sending.',
                  ],
                  [
                    'BODY',
                    'Required',
                    'One body, up to 1,024 characters. Positional samples use example.body_text: [[...]]; named samples use example.body_text_named_params.',
                  ],
                  [
                    'FOOTER',
                    'Optional',
                    'One plain-text footer, up to 60 characters, without variables.',
                  ],
                  [
                    'BUTTONS',
                    'Optional',
                    'Up to 10 buttons. Labels: 25 characters. At most two URL, one PHONE_NUMBER, and one COPY_CODE button. Keep quick replies grouped.',
                  ],
                  [
                    'URL',
                    'Optional button',
                    'URL up to 2,000 characters. One variable may appear at the end; include an example suffix.',
                  ],
                  [
                    'COPY_CODE',
                    'Optional button',
                    'Provide an example code of up to 20 characters. The label is supplied by WhatsApp.',
                  ],
                  [
                    'PHONE_NUMBER / VOICE_CALL',
                    'Optional buttons',
                    'Call a phone number (up to 20 characters) or call the business on WhatsApp.',
                  ],
                  [
                    'metaOptions',
                    'Optional local storage',
                    'Saved Meta request settings: category reassignment, URL tracking opt-out, TTL, sub-category, display format, library inputs, primary-device delivery, and send type. These fields are flattened into the exported Meta request.',
                  ],
                ].map(([field, requirement, description]) => (
                  <tr key={field} className="border-t">
                    <td className="p-3 font-mono text-xs">{field}</td>
                    <td className="p-3">{requirement}</td>
                    <td className="text-muted-foreground p-3">{description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            Advanced components JSON preserves specialized formats such as Flows, carousels,
            products, GIF headers, and limited-time offers. Their category and API-specific rules
            must be followed; the visual preview covers the common message components.
          </p>
          <p className="flex flex-wrap gap-3">
            <a
              className="text-primary underline"
              href="https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview"
              target="_blank"
              rel="noreferrer"
            >
              Meta template fundamentals
            </a>
            <a
              className="text-primary underline"
              href="https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/components"
              target="_blank"
              rel="noreferrer"
            >
              Components and samples
            </a>
            <a
              className="text-primary underline"
              href="https://developers.facebook.com/documentation/business-messaging/whatsapp/reference/whatsapp-business-account/message-template-api"
              target="_blank"
              rel="noreferrer"
            >
              Creation API and optional fields
            </a>
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>API endpoints</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">
                WhatsApp account, phone number, and template APIs
              </caption>
              <thead className="bg-muted/50">
                <tr>
                  <th scope="col" className="p-3">
                    Methods
                  </th>
                  <th scope="col" className="p-3">
                    Endpoint
                  </th>
                  <th scope="col" className="p-3">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody>
                {endpoints.map(([method, path, description]) => (
                  <tr key={path} className="border-t">
                    <td className="p-3 font-medium">{method}</td>
                    <td className="p-3">
                      <code className="text-xs break-all">{path}</code>
                    </td>
                    <td className="text-muted-foreground p-3">{description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-muted-foreground text-sm">
            Account payload fields: businessAccountId, apiVersion, accessToken (optional),
            encryptedToken, webhookSecretEncrypted. Number payload fields: numberId, phoneNumber.
          </p>
          <p className="text-muted-foreground text-sm">
            Template creation requires name, language, category, and components (a non-empty JSON
            array of objects with a type). Optional fields: variableSchema (JSON object or null) and
            metaOptions (Meta request settings, including parameter_format). Status, provider
            template ID, and activation are managed by Meta. Ownership is taken from the URL.
          </p>
          <p className="text-muted-foreground text-sm">
            Subscribe the Meta app to messages and message_template_status_update at POST
            /webhook/fb. Store its plaintext Meta App Secret in the account’s webhookSecretEncrypted
            field to verify X-Hub-Signature-256. The GET subscription handshake uses
            WHATSAPP_VERIFY_TOKEN, which is separate from the App Secret and must be configured in
            the server environment. Message events resolve the tenant from the saved business phone
            number. Incoming messages are saved, missing contacts are created without marketing
            consent, and delivery/read receipts update message history and campaign routing.
            Duplicate or delayed events cannot downgrade delivery evidence or change a committed
            campaign branch.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

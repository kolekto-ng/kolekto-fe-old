type RawContribution = Record<string, any>;
type ContributionFieldDefinition = {
  id?: string;
  name?: string;
  label?: string;
  field_name?: string;
  aliases?: string[];
  legacy_names?: string[];
};
type ContributionFieldCollection = {
  form_fields?: ContributionFieldDefinition[] | string;
  contributions_fields?: ContributionFieldDefinition[] | string;
} | null | undefined;

// Internal/reserved keys that live inside contributor_information but are
// never a host-defined custom field — never surface these as "custom field"
// values even when doing a loose/case-insensitive key match.
const RESERVED_INFO_KEYS = new Set([
  '__fieldValues', '_receipt', '_payer',
  'tier', 'tierid', 'tiername', 'tier_id', 'tier_name', 'tieramount',
  'quantity', 'ticketquantity', 'ticket_quantity',
  'collectiontype', 'channel', 'paidat',
]);

const NOT_PROVIDED = 'Not provided';

function getNestedValue(source: RawContribution, path: string) {
  return path.split('.').reduce<any>((value, key) => {
    if (value == null) return undefined;
    return value[key];
  }, source);
}

function firstPresent(source: RawContribution, paths: string[]) {
  for (const path of paths) {
    const value = getNestedValue(source, path);
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

// Some legacy/production rows may have a jsonb-shaped column come back as a
// JSON string (double-encoded) instead of a parsed array/object. Parse
// defensively rather than letting Array.isArray()/typeof checks silently
// treat real data as missing.
function parseIfJsonString(value: any): any {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed || (trimmed[0] !== '{' && trimmed[0] !== '[')) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

export function getContributionName(row: RawContribution): string {
  return String(
    firstPresent(row, ['name', 'contributor_name', 'full_name', 'fullName', 'contributorName']) || ''
  ).trim();
}

export function getContributionEmail(row: RawContribution): string {
  return String(
    firstPresent(row, ['email', 'contributor_email', 'contributorEmail']) || ''
  ).trim();
}

export function getContributionPhone(row: RawContribution): string {
  return String(
    firstPresent(row, ['phone', 'contributor_phone', 'phoneNumber', 'contributorPhone']) || ''
  ).trim();
}

export function getContributionReference(row: RawContribution): string {
  return String(
    firstPresent(row, [
      'payment_id', 'payment_reference', 'paymentReference', 'transactionRef',
      'receipt_details.reference',
    ]) || ''
  ).trim();
}

export function getContributionUniqueCode(row: RawContribution): string {
  return String(
    firstPresent(row, [
      'contributor_unique_code', 'uniqueCode', 'ticket_code', 'ticketCode',
      'receipt_details.unique_code',
    ]) || ''
  ).trim();
}

// Tolerant amount getter. `amount` is the canonical, always-populated column
// on every row written by the current payment flow — this only kicks in as
// a fallback for hypothetical legacy rows that used a different column name.
export function getContributionAmount(row: RawContribution): number {
  const value = firstPresent(row, [
    'amount', 'paidAmount', 'paid_amount', 'totalAmount', 'total_amount', 'amount_paid',
  ]);
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

// All the places contributor-submitted data could live across schema
// revisions. `contributor_information` (array) is the current/canonical
// shape; everything else is defensive fallback for older or differently
// shaped rows.
export function getContributionInformation(row: RawContribution): any[] {
  const candidates = [
    parseIfJsonString(row.contributor_information),
    parseIfJsonString(row.contact_info),
    parseIfJsonString(row.metadata),
    parseIfJsonString(row.customFields),
    parseIfJsonString(row.custom_fields),
    parseIfJsonString(row.formData),
    parseIfJsonString(row.answers),
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length > 0) return candidate;
    if (candidate && typeof candidate === 'object') return [candidate];
  }
  return [];
}

// Merges every entry in the contributor_information array into a single
// object (gaps filled left-to-right) instead of only reading index [0].
// Defensive: current writes only ever produce a single-entry array, but a
// legacy/manual record could plausibly have data spread across entries.
export function getContributionInformationObject(row: RawContribution): Record<string, any> {
  const info = getContributionInformation(row);
  return info.reduce<Record<string, any>>((acc, entry) => {
    if (!entry || typeof entry !== 'object') return acc;
    for (const [key, value] of Object.entries(entry)) {
      if (acc[key] === undefined || acc[key] === null || acc[key] === '') {
        acc[key] = value;
      }
    }
    return acc;
  }, {});
}

export function getContributionTierName(row: RawContribution): string {
  const info = getContributionInformationObject(row);
  return String(
    firstPresent(info, ['Tier', 'tierName', 'tier_name']) || ''
  ).trim();
}

export function getContributionTierId(row: RawContribution): string {
  const info = getContributionInformationObject(row);
  return String(
    firstPresent(info, ['TierId', 'tierId', 'tier_id']) || ''
  ).trim();
}

export function getContributionQuantity(row: RawContribution): number {
  const info = getContributionInformationObject(row);
  const value = firstPresent(info, ['Quantity', 'quantity', 'ticketQuantity', 'ticket_quantity']);
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : 1;
}

function getFieldAliases(field: ContributionFieldDefinition): string[] {
  const aliases = [
    ...(Array.isArray(field.aliases) ? field.aliases : []),
    ...(Array.isArray(field.legacy_names) ? field.legacy_names : []),
  ];

  return Array.from(
    new Set(
      aliases
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );
}

function asFieldArray(value: ContributionFieldDefinition[] | string | undefined): ContributionFieldDefinition[] {
  const parsed = parseIfJsonString(value);
  return Array.isArray(parsed) ? parsed : [];
}

export function getCollectionContributorFields(
  collection: ContributionFieldCollection
): ContributionFieldDefinition[] {
  const fromFormFields = asFieldArray(collection?.form_fields);
  const storedFields = fromFormFields.length > 0
    ? fromFormFields
    : asFieldArray(collection?.contributions_fields);

  const seen = new Set<string>();

  return storedFields.filter((field) => {
    // Some legacy field definitions may use `label`/`field_name` instead of `name`.
    const name = String(field?.name || field?.label || field?.field_name || "").trim();
    if (!name || name.toLowerCase() === "unique code") return false;

    const key = String(field?.id || name.toLowerCase());
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function getContributorFieldValue(
  row: RawContribution,
  field: ContributionFieldDefinition
): string {
  const info = getContributionInformationObject(row);
  const mappedValues =
    info.__fieldValues && typeof info.__fieldValues === "object"
      ? info.__fieldValues
      : {};

  const fieldName = String(field.name || field.label || field.field_name || "").trim();
  const candidates = Array.from(
    new Set(
      [
        field.id,
        fieldName,
        ...getFieldAliases(field),
      ]
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );

  for (const key of candidates) {
    const mappedValue = mappedValues[key];
    if (mappedValue !== undefined && mappedValue !== null && mappedValue !== "") {
      return String(mappedValue);
    }

    const directValue = info[key];
    if (directValue !== undefined && directValue !== null && directValue !== "") {
      return String(directValue);
    }
  }

  // Last-resort fallback for older/manually-entered rows: match the field's
  // display name against any info key, ignoring case/whitespace. Skips
  // internal/reserved keys so tier/quantity/receipt metadata never leak in
  // as a "custom field" value.
  if (fieldName) {
    const normalizedTarget = fieldName.toLowerCase().replace(/[\s_-]+/g, '');
    for (const [key, value] of Object.entries(info)) {
      if (key.startsWith('_')) continue;
      if (RESERVED_INFO_KEYS.has(key.toLowerCase())) continue;
      const normalizedKey = key.toLowerCase().replace(/[\s_-]+/g, '');
      if (normalizedKey === normalizedTarget && value !== undefined && value !== null && value !== '') {
        return String(value);
      }
    }
  }

  return "";
}

// Display helper: callers should use this (instead of `value || '-'`) so a
// missing field reads as "Not provided" rather than a blank cell or dash,
// without ever hiding the contributor row itself.
export function formatContributorValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return NOT_PROVIDED;
  const str = String(value).trim();
  return str === '' ? NOT_PROVIDED : str;
}

export function isAnonymousContribution(row: RawContribution): boolean {
  const name = getContributionName(row).toLowerCase();
  return !name || name === 'anonymous';
}

export function getContributionDisplayName(row: RawContribution): string {
  return isAnonymousContribution(row) ? 'Anonymous' : getContributionName(row);
}

export function normalizeContribution(row: RawContribution) {
  const name = getContributionName(row);
  const email = getContributionEmail(row);
  const phone = getContributionPhone(row);
  const paymentReference = getContributionReference(row);
  const uniqueCode = getContributionUniqueCode(row);
  const contributorInformation = getContributionInformation(row);

  return {
    ...row,
    name,
    email,
    phone,
    contributor_name: row.contributor_name ?? name,
    contributor_email: row.contributor_email ?? email,
    contributor_phone: row.contributor_phone ?? phone,
    payment_id: row.payment_id ?? paymentReference,
    payment_reference: row.payment_reference ?? paymentReference,
    contributor_unique_code: row.contributor_unique_code ?? uniqueCode,
    contributor_information: contributorInformation,
    // Fallback-only: real rows already have `amount` populated, so this is
    // a no-op for current data and only fills the gap for legacy rows that
    // stored the paid amount under a different column name.
    amount: row.amount ?? getContributionAmount(row),
    tier_name: getContributionTierName(row),
    tier_id: getContributionTierId(row),
    quantity: getContributionQuantity(row),
    check_in_status: row.check_in_status ?? 'not_checked_in',
    is_anonymous: isAnonymousContribution(row),
    display_name: getContributionDisplayName(row),
  };
}

export function normalizeContributions(rows: RawContribution[] | null | undefined) {
  return (rows || []).map(normalizeContribution);
}

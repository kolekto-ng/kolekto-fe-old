type RawContribution = Record<string, any>;

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

export function getContributionName(row: RawContribution): string {
  return String(firstPresent(row, ['name', 'contributor_name', 'full_name']) || '').trim();
}

export function getContributionEmail(row: RawContribution): string {
  return String(firstPresent(row, ['email', 'contributor_email']) || '').trim();
}

export function getContributionPhone(row: RawContribution): string {
  return String(firstPresent(row, ['phone', 'contributor_phone']) || '').trim();
}

export function getContributionReference(row: RawContribution): string {
  return String(firstPresent(row, ['payment_id', 'payment_reference', 'receipt_details.reference']) || '').trim();
}

export function getContributionUniqueCode(row: RawContribution): string {
  return String(firstPresent(row, ['contributor_unique_code', 'receipt_details.unique_code']) || '').trim();
}

export function getContributionInformation(row: RawContribution): any[] {
  if (Array.isArray(row.contributor_information)) return row.contributor_information;
  if (Array.isArray(row.contact_info)) return row.contact_info;
  if (row.contact_info && typeof row.contact_info === 'object') return [row.contact_info];
  return [];
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
    check_in_status: row.check_in_status ?? 'not_checked_in',
    is_anonymous: isAnonymousContribution(row),
    display_name: getContributionDisplayName(row),
  };
}

export function normalizeContributions(rows: RawContribution[] | null | undefined) {
  return (rows || []).map(normalizeContribution);
}

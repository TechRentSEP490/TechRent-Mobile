export type ParsedKycFields = {
  fullName?: string;
  identificationCode?: string;
  birthday?: string;
  expirationDate?: string;
  permanentAddress?: string;
  typeOfIdentification?: string;
  verifiedAt?: string;
};

type ParseKycTextArgs = {
  frontText?: string | null;
  backText?: string | null;
};

const normalizeDateToken = (value: string): string | null => {
  const cleaned = value.replace(/[^0-9/-]/g, '');
  if (cleaned.length === 0) {
    return null;
  }

  const isoMatch = cleaned.match(/^(\d{4})[-/](\d{2})[-/](\d{2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${year}-${month}-${day}`;
  }

  const dayFirstMatch = cleaned.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (dayFirstMatch) {
    const [, day, month, year] = dayFirstMatch;
    return `${year}-${month}-${day}`;
  }

  return null;
};

const normalizeAddressLine = (line: string): string => {
  const stripped = line
    .replace(/^thuong\s*tru[:\-]?/i, '')
    .replace(/^thường\s*trú[:\-]?/i, '')
    .replace(/^permanent\s*address[:\-]?/i, '')
    .replace(/^address[:\-]?/i, '')
    .replace(/^địa\s*chỉ[:\-]?/i, '')
    .replace(/^dia\s*chi[:\-]?/i, '')
    .trim();

  return stripped.length > 0 ? stripped : line.trim();
};

const isLikelyName = (line: string) => {
  if (line.length < 4) {
    return false;
  }

  if (/\d/.test(line)) {
    return false;
  }

  const upper = line.toUpperCase();
  return upper === line || upper === line.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
};

const buildLineArray = (text?: string | null) => {
  if (!text) {
    return [];
  }

  return text
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
};

const matchesLabel = (line: string, label: string) => line.toUpperCase().includes(label.toUpperCase());

const extractLabeledValue = (lines: string[], labels: string[]): string | null => {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    for (const label of labels) {
      if (!matchesLabel(line, label)) {
        continue;
      }

      const afterSeparator = line
        .split(/[:\-]/)
        .slice(1)
        .join(':')
        .trim();

      if (afterSeparator.length > 0 && !matchesLabel(afterSeparator, label)) {
        return afterSeparator;
      }

      const nextLine = lines[index + 1]?.trim();
      if (nextLine && !matchesLabel(nextLine, label)) {
        return nextLine;
      }
    }
  }

  return null;
};

const extractLegacyFields = (rawText: string) => {
  const result: ParsedKycFields = {};

  if (!rawText || rawText.trim().length === 0) {
    return result;
  }

  const cleanedText = rawText
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const concatenated = cleanedText.join(' ');

  const idMatch = concatenated.match(/\b\d{9,12}\b/);
  if (idMatch) {
    result.identificationCode = idMatch[0];
  }

  const potentialDates = new Set<string>();
  const isoMatches = concatenated.match(/\b\d{4}[-/]\d{2}[-/]\d{2}\b/g) ?? [];
  isoMatches.forEach((match) => {
    const normalized = normalizeDateToken(match);
    if (normalized) {
      potentialDates.add(normalized);
    }
  });

  const reversedMatches = concatenated.match(/\b\d{2}[-/]\d{2}[-/]\d{4}\b/g) ?? [];
  reversedMatches.forEach((match) => {
    const normalized = normalizeDateToken(match);
    if (normalized) {
      potentialDates.add(normalized);
    }
  });

  const orderedDates = Array.from(potentialDates).sort();
  if (orderedDates.length > 0) {
    result.birthday = orderedDates[0];
  }
  if (orderedDates.length > 1) {
    result.expirationDate = orderedDates[orderedDates.length - 1];
  }

  const nameCandidate = cleanedText.find((line) => isLikelyName(line));
  if (nameCandidate) {
    result.fullName = nameCandidate;
  }

  const addressCandidate =
    cleanedText.find((line) => /thuong\s*tru|thường\s*trú|permanent\s*address|address|địa\s*chỉ|dia\s*chi/i.test(line)) ??
    cleanedText.find((line) => line.length > 20 && /,/.test(line));

  if (addressCandidate) {
    result.permanentAddress = normalizeAddressLine(addressCandidate);
  }

  if (/cmnd/i.test(concatenated)) {
    result.typeOfIdentification = 'CMND';
  } else if (/cccd/i.test(concatenated)) {
    result.typeOfIdentification = 'CCCD';
  } else if (/passport/i.test(concatenated)) {
    result.typeOfIdentification = 'PASSPORT';
  }

  return result;
};

const sanitizeIdentificationValue = (value: string) => {
  const normalized = value.replace(/[^0-9A-Za-z]/g, '');
  return normalized.length > 0 ? normalized : value.trim();
};

export const parseKycText = ({ frontText, backText }: ParseKycTextArgs): ParsedKycFields => {
  const frontLines = buildLineArray(frontText);
  const backLines = buildLineArray(backText);
  const combinedText = [frontText, backText]
    .filter((value): value is string => Boolean(value && value.length > 0))
    .join('\n');

  const legacy = extractLegacyFields(combinedText);
  const result: ParsedKycFields = {
    ...legacy,
    typeOfIdentification: 'CCCD',
  };

  const extractedFullName = extractLabeledValue(frontLines, ['FULL NAME']);
  if (extractedFullName) {
    result.fullName = extractedFullName;
  }

  const extractedIdentification = extractLabeledValue(frontLines, ['NO.', 'IDENTIFICATION NUMBER']);
  if (extractedIdentification) {
    result.identificationCode = sanitizeIdentificationValue(extractedIdentification);
  }

  const extractedAddress = extractLabeledValue(frontLines, ['PLACE OF RESIDENCE', 'PERMANENT ADDRESS']);
  if (extractedAddress) {
    result.permanentAddress = normalizeAddressLine(extractedAddress);
  }

  const verifiedAt = extractLabeledValue(backLines, ['VERIFIED AT']);
  if (verifiedAt) {
    result.verifiedAt = verifiedAt;
  }

  return result;
};

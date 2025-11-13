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

const normalizeForComparison = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

const normalizeAddressLine = (line: string): string => {
  const stripped = line
    .replace(/^thuong\s*tru[:\-]?/i, '')
    .replace(/^thường\s*trú[:\-]?/i, '')
    .replace(/^permanent\s*address[:\-]?/i, '')
    .replace(/^place\s*of\s*residence[:\-]?/i, '')
    .replace(/^address[:\-]?/i, '')
    .replace(/^địa\s*chỉ[:\-]?/i, '')
    .replace(/^dia\s*chi[:\-]?/i, '')
    .trim();

  const cleaned = stripped
    .replace(/^[,;\s]+/, '')
    .replace(/\s*[,;]+\s*/g, ', ')
    .replace(/[\r\n]+/g, ', ')
    .replace(/\s+/g, ' ')
    .replace(/,\s*,/g, ', ')
    .replace(/,\s*$/, '')
    .trim();

  return cleaned.length > 0 ? cleaned : line.trim();
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

const matchesLabel = (line: string, label: string) =>
  normalizeForComparison(line).includes(normalizeForComparison(label));

const lineContainsAnyLabel = (line: string, labels: string[]) =>
  labels.some((label) => matchesLabel(line, label));

type ExtractValueOptions = {
  followLines?: number;
  joinWith?: string;
};

const extractLabeledValue = (
  lines: string[],
  labels: string[],
  options: ExtractValueOptions = {},
): string | null => {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (!lineContainsAnyLabel(line, labels)) {
      continue;
    }

    const parts = line.split(/[:\-]/);
    const afterSeparator = parts.slice(1).join(':').trim();

    let value = afterSeparator.length > 0 && !lineContainsAnyLabel(afterSeparator, labels)
      ? afterSeparator
      : '';
    let valueLineIndex = index;

    if (!value) {
      const nextLine = lines[index + 1]?.trim();
      if (nextLine && !lineContainsAnyLabel(nextLine, labels)) {
        value = nextLine;
        valueLineIndex = index + 1;
      }
    }

    if (!value) {
      continue;
    }

    const followLines = options.followLines ?? 0;

    if (followLines > 0) {
      const collected: string[] = [];

      for (let offset = 1; offset <= followLines; offset += 1) {
        const candidate = lines[valueLineIndex + offset]?.trim();
        if (!candidate) {
          break;
        }

        if (lineContainsAnyLabel(candidate, labels) || /[:]/.test(candidate)) {
          break;
        }

        collected.push(candidate.replace(/^[,;\s]+/, '').trim());
      }

      if (collected.length > 0) {
        value = [value, ...collected].join(options.joinWith ?? ' ').trim();
      }
    }

    return value.trim();
  }

  return null;
};

const FULL_NAME_LABELS = ['FULL NAME', 'HO VA TEN', 'HỌ VÀ TÊN'];
const IDENTIFICATION_LABELS = [
  'IDENTIFICATION NUMBER',
  'IDENTIFICATION NO',
  'NO.',
  'SỐ/ NO.',
  'SỐ CMND',
  'SỐ CCCD',
  'SO CMND',
  'SO CCCD',
];
const PERMANENT_ADDRESS_LABELS = [
  'PERMANENT ADDRESS',
  'PLACE OF RESIDENCE',
  'NƠI THƯỜNG TRÚ',
  'NOI THUONG TRU',
];
const VERIFIED_AT_LABELS = ['VERIFIED AT', 'NGÀY CẤP', 'NGAY CAP', 'NGÀY, THÁNG, NĂM', 'NGAY, THANG, NAM'];
const EXPIRATION_LABELS = ['DATE OF EXPIRY', 'DATE AF EXPIRY', 'CÓ GIÁ TRỊ ĐẾN', 'CO GIA TRI DEN'];

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

  const addressLabelIndex = cleanedText.findIndex((line) =>
    /thuong\s*tru|thường\s*trú|permanent\s*address|place\s*of\s*residence|address|địa\s*chỉ|dia\s*chi/i.test(
      line,
    ),
  );

  if (addressLabelIndex >= 0) {
    const addressSegments = cleanedText
      .slice(addressLabelIndex, addressLabelIndex + 3)
      .map((line) => normalizeAddressLine(line))
      .filter((line) => line.length > 0);

    if (addressSegments.length > 0) {
      result.permanentAddress = addressSegments.join(', ');
    }
  } else {
    const fallbackAddress = cleanedText.find((line) => line.length > 20 && /,/.test(line));
    if (fallbackAddress) {
      result.permanentAddress = normalizeAddressLine(fallbackAddress);
    }
  }

  if (/cmnd/i.test(concatenated)) {
    result.typeOfIdentification = 'CMND';
  } else if (/cccd/i.test(concatenated)) {
    result.typeOfIdentification = 'CCCD';
  } else if (/passport/i.test(concatenated)) {
    result.typeOfIdentification = 'PASSPORT';
  }

  const verifiedLineIndex = cleanedText.findIndex((line) =>
    /verified\s*at|ngày\s*cấp|ngay\s*cap|ngày,\s*tháng,\s*năm|ngay,\s*thang,\s*nam/i.test(line),
  );

  if (verifiedLineIndex >= 0) {
    const verifiedLine = cleanedText[verifiedLineIndex];
    const extracted = verifiedLine.split(/[:\-]/).slice(1).join(':').trim();
    const normalized = extracted.length > 0 ? normalizeDateToken(extracted) ?? extracted : '';

    if (normalized) {
      result.verifiedAt = normalized;
    } else {
      const following = cleanedText[verifiedLineIndex + 1]?.trim();
      if (following) {
        const normalizedFollowing = normalizeDateToken(following) ?? following;
        if (normalizedFollowing) {
          result.verifiedAt = normalizedFollowing;
        }
      }
    }
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

  const extractedFullName = extractLabeledValue(frontLines, FULL_NAME_LABELS);
  if (extractedFullName) {
    result.fullName = extractedFullName;
  }

  const extractedIdentification = extractLabeledValue(frontLines, IDENTIFICATION_LABELS);
  if (extractedIdentification) {
    result.identificationCode = sanitizeIdentificationValue(extractedIdentification);
  }

  const extractedAddress = extractLabeledValue(frontLines, PERMANENT_ADDRESS_LABELS, {
    followLines: 2,
    joinWith: ', ',
  });
  if (extractedAddress) {
    result.permanentAddress = normalizeAddressLine(extractedAddress);
  }

  const verifiedAt = extractLabeledValue(backLines, VERIFIED_AT_LABELS);
  if (verifiedAt) {
    result.verifiedAt = normalizeDateToken(verifiedAt) ?? verifiedAt;
  }

  const expiration = extractLabeledValue(frontLines, EXPIRATION_LABELS);
  if (expiration) {
    const normalizedExpiration = normalizeDateToken(expiration) ?? expiration;
    result.expirationDate = normalizedExpiration;
  }

  return result;
};

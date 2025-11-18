export const STOMP_FRAME_DELIMITER = '\0';

export const STOMP_CONNECT_HEADERS = {
  'accept-version': '1.1,1.0',
  'heart-beat': '10000,10000',
} as const;

export type StompFrame = {
  command: string;
  headers: Record<string, string>;
  body: string;
};

export const buildStompFrame = (
  command: string,
  headers: Record<string, string> = {},
  body: string | null = null,
) => {
  const headerLines = Object.entries(headers)
    .filter(([, value]) => typeof value === 'string' && value.length > 0)
    .map(([key, value]) => `${key}:${value}`);

  const headerSection = [command, ...headerLines].join('\n');
  const bodySection = body ?? '';

  return `${headerSection}\n\n${bodySection}${STOMP_FRAME_DELIMITER}`;
};

export const parseStompFrames = (payload: string): StompFrame[] => {
  if (!payload) {
    return [];
  }

  return payload
    .split(STOMP_FRAME_DELIMITER)
    .map((raw) => raw.replace(/^\n+/, ''))
    .filter((raw) => raw.trim().length > 0)
    .map((raw) => {
      const separatorIndex = raw.indexOf('\n\n');
      const headerChunk = separatorIndex >= 0 ? raw.slice(0, separatorIndex) : raw;
      const bodyChunk = separatorIndex >= 0 ? raw.slice(separatorIndex + 2) : '';
      const headerLines = headerChunk
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
      const [command, ...headerPairs] = headerLines;
      const headers: Record<string, string> = {};

      headerPairs.forEach((line) => {
        const colonIndex = line.indexOf(':');
        if (colonIndex === -1) {
          return;
        }
        const key = line.slice(0, colonIndex).trim();
        const value = line.slice(colonIndex + 1).trim();
        if (key.length > 0) {
          headers[key] = value;
        }
      });

      return {
        command: command ?? '',
        headers,
        body: bodyChunk,
      } as StompFrame;
    })
    .filter((frame) => frame.command.length > 0);
};

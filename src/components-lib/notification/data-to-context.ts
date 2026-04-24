import yaml from 'js-yaml';

// Converts a structured data object into preformatted text strings for a
// notification's context section. Arrays produce one string per item (strings
// pass through; objects are YAML-dumped); all other objects produce a single
// YAML-dumped string.
export const dataToContext = (data: object): string[] => {
  if (Array.isArray(data)) {
    return data.map((item) => (typeof item === 'string' ? item : yaml.dump(item)));
  }
  return [yaml.dump(data)];
};

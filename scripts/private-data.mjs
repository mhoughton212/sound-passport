const privateDataRoot = new URL("../.private-data/data/", import.meta.url);

export function privateDataFile(relativePath) {
  return new URL(relativePath, privateDataRoot);
}

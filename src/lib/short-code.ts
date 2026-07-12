const ALPHABET =
  "0123456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";

export function generateShortCode(length = 7): string {
  let result = "";
  const arr = new Uint32Array(length);
  crypto.getRandomValues(arr);
  for (let i = 0; i < length; i++) {
    result += ALPHABET[arr[i] % ALPHABET.length];
  }
  return result;
}

export function parseUserAgent(ua: string): {
  device_type: string;
  os: string;
  browser: string;
} {
  const u = ua.toLowerCase();
  let device_type = "desktop";
  if (/mobile|iphone|android.*mobile/.test(u)) device_type = "mobile";
  else if (/ipad|tablet/.test(u)) device_type = "tablet";

  let os = "Unknown";
  if (/iphone|ipad|ipod/.test(u)) os = "iOS";
  else if (/mac os x/.test(u)) os = "macOS";
  else if (/android/.test(u)) os = "Android";
  else if (/windows/.test(u)) os = "Windows";
  else if (/linux/.test(u)) os = "Linux";

  let browser = "Other";
  if (/edg\//.test(u)) browser = "Edge";
  else if (/chrome\//.test(u) && !/edg\//.test(u)) browser = "Chrome";
  else if (/safari\//.test(u) && !/chrome/.test(u)) browser = "Safari";
  else if (/firefox\//.test(u)) browser = "Firefox";

  return { device_type, os, browser };
}

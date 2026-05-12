export function parseCookie(header?: string): Record<string, string> {
    if (!header) return {};
    return Object.fromEntries(
        header.split(";").map((part) => {
            const [key, ...rest] = part.trim().split("=");
            return [key, decodeURIComponent(rest.join("="))];
        }),
    );
}

export function serializeCookie(
    name: string,
    value: string,
    maxAgeSeconds?: number,
): string {
    const parts = [
        `${name}=${encodeURIComponent(value)}`,
        "HttpOnly",
        "Path=/",
        "SameSite=Lax",
    ];
    if (maxAgeSeconds !== undefined) parts.push(`Max-Age=${maxAgeSeconds}`);
    return parts.join("; ");
}

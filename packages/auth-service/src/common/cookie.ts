export function parseCookie(header?: string): Record<string, string> {
    if (!header) return {};
    return Object.fromEntries(
        header
            .split(";")
            .map((part) => part.trim().split("="))
            .filter(([key, value]) => key && value)
            .map(([key, value]) => [key, decodeURIComponent(value)]),
    );
}

export function serializeCookie(
    name: string,
    value: string,
    maxAgeSeconds: number,
): string {
    const encoded = encodeURIComponent(value);
    const parts = [
        `${name}=${encoded}`,
        "Path=/",
        "HttpOnly",
        "SameSite=Lax",
        `Max-Age=${maxAgeSeconds}`,
    ];
    return parts.join("; ");
}

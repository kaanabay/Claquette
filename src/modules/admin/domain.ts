// Site administration (pure). The site admins are the usernames listed in SITE_ADMINS, comma
// separated. The list lives on the server only, so nobody can grant the role from the app.

/** "kaan, Ayse " → {"kaan", "ayse"} */
export function parseSiteAdmins(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((name) => name.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isListedAdmin(username: string | null, admins: ReadonlySet<string>): boolean {
  return username !== null && admins.has(username.toLowerCase());
}

const WORDS = [
  "ada", "alev", "ayna", "bahar", "balkon", "bulut", "cadde", "defne", "deniz", "elma", "erik", "fener", "gemi",
  "hamak", "incir", "kalem", "kanat", "kestane", "kiraz", "kumsal", "lale", "lamba", "liman", "mavi", "mercan",
  "nar", "nehir", "orman", "pamuk", "papatya", "pusula", "sahil", "sandal", "sedir", "tarla", "tepe", "toprak",
  "tramvay", "vapur", "vadi", "yaprak", "yelken", "zeytin", "armut", "dalga", "fidan", "kavak", "lodos", "simit",
] as const;

/**
 * A temporary password the admin can read out: three words and a number ("lale-vapur-kanat-47").
 * `random(n)` returns an integer in [0, n); the server passes a cryptographic one.
 */
export function temporaryPassword(random: (max: number) => number): string {
  const words = Array.from({ length: 3 }, () => WORDS[random(WORDS.length)]);
  return `${words.join("-")}-${10 + random(90)}`;
}

export function getDatabaseUrl(rawDatabaseUrl: string) {
  const databaseUrl = new URL(rawDatabaseUrl);

  // pg-connection-string otherwise treats sslmode=require like verify-full.
  // Opt into libpq semantics so "require" encrypts the connection without
  // rejecting database providers whose CA is not in Node's bundled CA store.
  if (databaseUrl.searchParams.has("sslmode") && !databaseUrl.searchParams.has("uselibpqcompat")) {
    databaseUrl.searchParams.set("uselibpqcompat", "true");
  }

  return databaseUrl.toString();
}

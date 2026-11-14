// GET /api/locations  →  Location[]
// TODO(schema): move to Supabase once the locations table exists.
import { LOCATIONS } from "@/mock/locations";

export function GET() {
  return Response.json(LOCATIONS);
}

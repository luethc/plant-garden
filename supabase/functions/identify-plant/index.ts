// Supabase Edge Function: identify-plant
// Receives a photo + the user's JWT, calls Claude vision, returns a validated cute plant profile.
// Secrets required: ANTHROPIC_API_KEY, UNLIMITED_EMAILS (comma-separated). SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are auto-injected.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SHAPES = ['monstera', 'heart', 'broad', 'spiky', 'strappy', 'round', 'tree', 'pitcher', 'flower'];
const SIZES = ['XS', 'S', 'M', 'L'];
const hexOk = (s: unknown) => typeof s === 'string' && /^#[0-9a-fA-F]{6}$/.test(s);

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...CORS, 'content-type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const jwt = (req.headers.get('Authorization') || '').replace('Bearer ', '').trim();
    if (!jwt) return json({ error: 'not signed in' }, 401);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: { user }, error: uErr } = await admin.auth.getUser(jwt);
    if (uErr || !user) return json({ error: 'invalid session' }, 401);

    const body = await req.json().catch(() => ({}));
    const image: string = typeof body.image === 'string' ? body.image : '';
    const species: string = typeof body.species === 'string' ? body.species.trim().slice(0, 80) : '';
    const hasImage = image.length > 0;
    if (!hasImage && !species) return json({ error: 'need a photo or a plant name' }, 400);
    if (hasImage && image.length > 1_900_000) return json({ error: 'image too large' }, 413); // ~1.4MB binary

    let mediaType = 'image/jpeg', b64 = image;
    if (hasImage) {
      const m = image.match(/^data:(image\/[a-zA-Z+]+);base64,(.*)$/);
      if (m) { mediaType = m[1]; b64 = m[2]; }
    }

    // ---- quota: unlimited for allow-listed emails, else atomic 1/day ----
    const unlimited = (Deno.env.get('UNLIMITED_EMAILS') || '')
      .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
      .includes((user.email || '').toLowerCase());
    if (!unlimited) {
      const { data: ok, error: qErr } = await admin.rpc('consume_quota', { p_user: user.id, p_limit: 1 });
      if (qErr) return json({ error: 'quota check failed' }, 500);
      if (!ok) return json({ error: 'limit', message: 'You can identify 1 plant per day. Try again tomorrow! 🌙' }, 429);
    }
    const refund = async () => { if (!unlimited) await admin.rpc('refund_quota', { p_user: user.id }); };

    // ---- call Claude vision with forced structured output ----
    const anthRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        tools: [{
          name: 'save_plant_profile',
          description: 'Record the identified houseplant as a cute app profile.',
          input_schema: {
            type: 'object',
            properties: {
              is_plant: { type: 'boolean', description: 'true only if the image clearly shows a houseplant' },
              cuteName: { type: 'string', description: 'a cute, punny first name fitting the plant (e.g. Fernando for a fern, Monty for a monstera, Pearl for a string-of-pearls)' },
              species: { type: 'string', description: 'common species name, e.g. "Boston fern"' },
              shape: { type: 'string', enum: SHAPES, description: 'closest matching silhouette from the list' },
              col: { type: 'string', description: 'dominant leaf color as #rrggbb hex' },
              acc: { type: 'string', description: 'accent/variegation color as #rrggbb hex, or omit if none' },
              size: { type: 'string', enum: SIZES },
              rarity: { type: 'integer', minimum: 1, maximum: 5, description: 'how uncommon as a houseplant' },
              light: { type: 'string', description: 'short light need, e.g. "Bright indirect"' },
              water: { type: 'integer', minimum: 1, maximum: 60, description: 'typical days between waterings' },
              toxic: { type: 'boolean', description: 'toxic to cats/dogs?' },
              tip: { type: 'string', description: 'one or two friendly sentences of care advice' },
            },
            required: ['is_plant'],
          },
        }],
        tool_choice: { type: 'tool', name: 'save_plant_profile' },
        messages: [{
          role: 'user',
          content: [
            ...(hasImage ? [{ type: 'image', source: { type: 'base64', media_type: mediaType, data: b64 } }] : []),
            { type: 'text', text:
              species && hasImage
                ? `The user has told you this plant is a "${species}" — trust that identification, do not second-guess it. Use the photo only to capture its real appearance: actual leaf color, any variegation/accent color, and size. Fill in the cute app profile via the tool, keeping species="${species}". Set is_plant=true.`
              : species
                ? `Create a cute app profile for a "${species}" houseplant via the tool. Use typical, accurate care values for this species. Keep species="${species}". Set is_plant=true.`
                : 'Identify this houseplant and fill in a cute app profile via the tool. Choose the closest shape from the allowed list. If you are not confident of the exact cultivar, give the common species or genus name rather than guessing a specific rare variety. If the image is not clearly a houseplant, set is_plant=false.' },
          ],
        }],
      }),
    });

    if (!anthRes.ok) {
      await refund();
      const t = await anthRes.text();
      return json({ error: 'ai failed', detail: t.slice(0, 200) }, 502);
    }
    const data = await anthRes.json();
    const block = (data.content || []).find((b: { type: string }) => b.type === 'tool_use');
    if (!block) { await refund(); return json({ error: 'no result' }, 502); }
    const p = block.input || {};

    if (!p.is_plant && !species) {
      await refund(); // don't burn quota on a non-plant photo (skip when the user named the species)
      return json({ plant: false, message: "Hmm, I couldn't spot a plant in that photo. Try another angle?" });
    }

    const profile = {
      name: String(p.cuteName || '').slice(0, 40) || 'New plant',
      sp: (species || String(p.species || '')).slice(0, 80) || 'unknown',
      shape: SHAPES.includes(p.shape) ? p.shape : 'broad',
      col: hexOk(p.col) ? p.col : '#5c9150',
      acc: hexOk(p.acc) ? p.acc : null,
      size: SIZES.includes(p.size) ? p.size : 'M',
      rarity: Math.min(5, Math.max(1, parseInt(p.rarity) || 1)),
      light: String(p.light || 'Bright indirect').slice(0, 60),
      water: Math.min(60, Math.max(1, parseInt(p.water) || 7)),
      toxic: !!p.toxic,
      tip: String(p.tip || 'Added from a photo — edit anytime.').slice(0, 400),
    };
    return json({ plant: true, profile });
  } catch (e) {
    return json({ error: 'server error', detail: String(e).slice(0, 200) }, 500);
  }
});

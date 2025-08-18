export default {
  async fetch(request) {
    try {
      const url = new URL(request.url);
      const target = url.searchParams.get('url');
      if (!target) {
        return new Response('Missing url param', { status: 400 });
      }

      const upstream = await fetch(target, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5'
        },
        redirect: 'follow'
      });

      const body = await upstream.arrayBuffer();
      const resp = new Response(body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: {
          'Content-Type': upstream.headers.get('Content-Type') || 'text/plain',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Cache-Control': 'no-store'
        }
      });
      return resp;
    } catch (e) {
      return new Response('Proxy error: ' + (e && e.message), { status: 502, headers: { 'Access-Control-Allow-Origin': '*' } });
    }
  }
};

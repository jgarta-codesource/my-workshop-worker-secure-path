import { Router, IRequest } from 'itty-router';

export interface Env {
	FLAG_BUCKET: R2Bucket;
}

const router = Router();

router.get('/secure', async (request: IRequest, env: Env): Promise<Response> => {
	const email = request.headers.get('cf-access-authenticated-user-email') || 'unknown-email';

	const timestamp = new Date().toISOString();

	const country = request.headers.get('cf-ipcountry') || 'unknown-country';
	const countryLower = country.toLowerCase();

	const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Authenticated</title>
      <style>
        body { 
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          display: grid;
          place-items: center;
          min-height: 100vh;
          background-color: #f4f4f4;
          color: #333;
        }
        .container {
          background: #fff;
          padding: 2rem;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
          text-align: center;
        }
        code {
          background: #eee;
          padding: 0.2rem 0.4rem;
          border-radius: 4px;
        }
        a {
          color: #007aff;
          text-decoration: none;
          font-weight: 600
        }
        a:hover {
          text-decoration: underline;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Authentication Successful</h1>
        <p>
          <code>${email}</code> authenticated at <code>${timestamp}</code>
        </p>
        <p>
          From: <a href="/secure/${countryLower}">${country}</a>
        </p>
      </div>
    </body>
    </html>
  `;

	return new Response(html, {
		headers: {
			'Content-Type': 'text/html;charset=UTF-8',
		},
	});
});

/**
 * Route: /secure/:country
 * Returns the flag SVG/image from the R2 bucket.
 */
router.get('/secure/:country', async (request: IRequest, env: Env) => {
	const { params } = request;
	const countryCode = params?.country?.toLowerCase();

	if (!countryCode) {
		return new Response('Country code missing', { status: 400 });
	}

	// Construct the object key. We assume flags are stored as e.g., "us.svg"
	// You might need to adjust this logic if your filenames are different.
	
    // FIX: Used backticks (`) for template literal string
	const objectKey = `${countryCode}.svg`

	try {
		// 1. Get the object from R2
		const flagObject = await env.FLAG_BUCKET.get(objectKey);

		if (flagObject === null) {
            // FIX: The error message indicates this line is missing backticks (`).
            // It should be a template literal string, like this:
			return new Response('Flag not found for ${countryCode]', { status: 404 });
		}

		// 2. Prepare response headers
		const headers = new Headers();
		flagObject.writeHttpMetadata(headers); // Copies ETag, Content-Type, etc.
		headers.set('etag', flagObject.httpEtag);

		// 3. Return the object body (the image)
		// The content type is set automatically from the R2 object's metadata.
		return new Response(flagObject.body, {
			headers,
		});
	} catch (e) {
		console.error(e);
		return new Response('Error fetching flag', { status: 500 });
	}
});

/**
 * Fallback route
 */
router.all('*', () => new Response('Not Found.', { status: 404 }));

/**
 * Main fetch handler
 */
export default {
    // The 'request: Request' type here will now correctly refer to the
    // global Cloudflare Worker Request type, which includes the '.cf' object.
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        
        // --- DEBUGGING: Bypass router for ALL /secure routes ---
        // The router seems to be causing the worker to hang.
        // We will bypass it for both /secure and /secure/:country paths.
        const url = new URL(request.url);
        const path = url.pathname;

        // Regex to match /secure OR /secure/xx (where xx is 2 letters)
        const secureRouteRegex = /^\/secure(?:\/([a-z]{2}))?$/i;
        const match = path.match(secureRouteRegex);

        if (match) {
            try {
                // Check if we are on the /secure/:country route
                // match[1] will be the country code (e.g., "mx") if it exists
                if (match[1]) {
                    const countryCode = match[1].toLowerCase();

                    // --- This is the logic from router.get('/secure/:country') ---
                    const objectKey = `${countryCode}.svg`
                    
                    // 1. Get the object from R2
                    const flagObject = await env.FLAG_BUCKET.get(objectKey);

                    if (flagObject === null) {
                        return new Response('Flag not found for ${countryCode}',	{ status: 404 });
                    }

                    // 2. Prepare response headers
                    const headers = new Headers();
                    flagObject.writeHttpMetadata(headers); // Copies ETag, Content-Type, etc.
                    headers.set('etag', flagObject.httpEtag);

                    // 3. Return the object body (the image)
                    return new Response(flagObject.body, {
                        headers,
                    });
                    // --- End of /secure/:country logic ---

                } else if (path === '/secure') {
                    // --- This is the logic from router.get('/secure') ---
                    
                    // 1. Get identity from Access
                    const email = request.headers.get('cf-access-authenticated-user-email') || 'unknown-email-debug';
                    // 2. Get timestamp
                    const timestamp = new Date().toISOString();
                    // 3. Get country
                    const country = request.headers.get('cf-ipcountry') || 'unknown-country-debug';
                    const countryLower = country.toLowerCase();

                    // 4. Create the HTML response
                    const html = `
                    <!DOCTYPE html>
                    <html lang="en">
                    <head>
                      <meta charset="UTF-8">
                      <meta name="viewport" content="width=device-width, initial-scale=1.0">
                      <title>Authenticated (Bypass)</title>
                      <style>
                        body { 
                          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                          display: grid;
                          place-items: center;
                          min-height: 100vh;
                          background-color: #f4f4f4;
                          color: #333;
                        }
                        .container {
                          background: #fff;
                          padding: 2rem;
                          border-radius: 8px;
                          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
                          text-align: center;
                        }
                        code {
                          background: #eee;
                          padding: 0.2rem 0.4rem;
                          border-radius: 4px;
                        }
                        a {
                          color: #007aff;
                          text-decoration: none;
                          font-weight: 600;
                        }
                        a:hover {
                          text-decoration: underline;
                        }
                      </style>
                    </head>
                    <body>
                      <div class="container">
                        <h1>Authentication Successful (Bypass)</h1>
                        <p>
                          <code>${email}</code> authenticated at <code>${timestamp}</code>
                        </p>
                        <p>
                          From: <a href="/secure/${countryLower}">${country}</a>
                        </p>
                      </div>
                    </body>
                    </html>
                  `;

                    return new Response(html, {
                        headers: {
                            'Content-Type': 'text/html;charset=UTF-8',
                        },
                    });
                    // --- End of /secure logic ---
                }

            } catch (e: any) {
                console.error('Error in /secure bypass: ${e.message}');
                return new Response('Error in /secure bypass: ${e.message}', { status: 500 });
            }
        }
        // --- END DEBUGGING BYPASS ---


		// If it's not a /secure route, let the router handle it (e.g., 404)
        return router.handle(request, env);
	},
};
To adapt your `ConfluenceClient` to support both Confluence Data Center (DC) and Confluence Cloud REST APIs using Personal Access Tokens (PATs) and determining the version based on the `baseUrl`, you'll primarily need to adjust how HTTP headers are set, particularly the `X-Atlassian-Token`.

Here's how you can modify your `src/client.ts`:

**1. Add a property to detect Cloud vs. DC:**

In your `ConfluenceClient` class, add a private readonly property, for instance `isCloud`, to store whether the client is configured for Confluence Cloud.

```typescript
// src/client.ts

// ... other imports
export class ConfluenceClient {
  private readonly axiosInstance: AxiosInstance;
  private readonly restApiBase: string;
  private readonly debug: boolean;
  private readonly logger: ReturnType<typeof createLogger>;
  private readonly customErrorHandler?: (error: any) => boolean;
  private readonly isCloud: boolean; // <--- Add this property

  constructor(config: ConfluenceClientConfig) {
    // ... (initial checks for baseUrl and auth)

    // Determine if it's a Cloud instance
    this.isCloud = config.baseUrl.includes('.atlassian.net'); // <--- Determine API type

    // ... (restApiBase, debug, logger setup)

    this.logger.debug(`Initializing ConfluenceClient for ${this.isCloud ? 'Cloud' : 'Data Center'}`, { // <--- Log API type
      baseUrl: this.restApiBase,
      authMethod: 'Token Authentication',
      sslVerification: config.rejectUnauthorized === false ? 'Disabled' : 'Enabled',
      // ... (token logging)
      isCloudInstance: this.isCloud // <--- Log determined instance type
    });

    // Configure authorization headers conditionally
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.auth.token}`, // PAT for both Cloud and DC
      ...(config.axiosConfig?.headers as Record<string, string> || {}),
    };

    if (!this.isCloud) {
      headers['X-Atlassian-Token'] = 'nocheck'; // Required for POST/PUT/DELETE in DC/Server
      this.logger.debug('Data Center API: Added X-Atlassian-Token: nocheck header.');
    } else {
      this.logger.debug('Cloud API: X-Atlassian-Token: nocheck header not added (not typically required for Cloud with PATs).');
    }

    // ... (rest of the constructor, including Axios instance creation with these headers)
    // Configure Axios with base options
    const axiosOptions: AxiosRequestConfig = {
      baseURL: this.restApiBase,
      headers, // <--- Use the conditionally configured headers
      ...config.axiosConfig, 
    };
    
    // ... (SSL handling)

    this.axiosInstance = axios.create(axiosOptions);

    // ... (error interceptor)
  }

  // ... (rest of the client methods)
}
```

**Explanation of Changes:**

1.  **`isCloud` Property**:

      * A boolean property `this.isCloud` is added to the `ConfluenceClient` class.
      * In the constructor, it's set to `true` if the `config.baseUrl` contains `.atlassian.net`, which is a common indicator for Confluence Cloud instances. Otherwise, it's `false` (assumed to be Data Center).
      * This determination is logged for clarity during debugging.

2.  **Conditional `X-Atlassian-Token` Header**:

      * The `X-Atlassian-Token: nocheck` header is crucial for preventing XSRF (Cross-Site Request Forgery) errors in Confluence Data Center when making state-changing requests (POST, PUT, DELETE).
      * For Confluence Cloud, this header is generally not needed when using PATs, as PATs inherently handle XSRF protection. Including it might be benign or could potentially cause issues in some Cloud API interactions.
      * The code now only adds the `X-Atlassian-Token: nocheck` header if `this.isCloud` is `false` (i.e., it's a Data Center instance).

**Important Considerations for `baseUrl`:**

  * The existing logic for ` this.restApiBase =  `${baseUrl.replace(//$/, '')}/rest/api`;` should generally work for both Cloud and DC, *provided* the `baseUrl` you pass to the client is structured correctly:
      * **For Confluence Cloud:** Typically `https://your-domain.atlassian.net/wiki`. This will result in `restApiBase` being `https://your-domain.atlassian.net/wiki/rest/api`.
      * **For Confluence Data Center:** Typically `https://your-server.com/confluence` (or just `https://your-server.com` if Confluence is at the root). This will result in `restApiBase` being `https://your-server.com/confluence/rest/api`.
  * The endpoint paths you've listed (e.g., `/content`, `/space/{spaceKey}`) are generally part of the V1 REST API structure, which is largely consistent between Cloud and recent DC versions when accessed via the `/rest/api` base.

**No Changes to Endpoint Paths Required (for the listed V1 APIs):**

For the specific set of endpoints your client currently uses (which are primarily V1 REST APIs), the relative paths (e.g., `/content`, `/space/{spaceKey}/archive`) appended to `this.restApiBase` should remain the same for both Cloud and DC. Significant path differences usually emerge with newer, distinct API versions like Confluence Cloud API v2 (e.g. `/wiki/api/v2/pages`), which your client isn't currently targeting based on the identified endpoints.

**Authentication:**

Your client already uses `Authorization: Bearer {token}`, which is the correct way to use Personal Access Tokens for both Confluence Cloud and Data Center. This part does not need to change.

By implementing these changes in the constructor of your `ConfluenceClient` in `src/client.ts`, you can make your client adaptable to both Confluence Cloud and Data Center environments based on the provided `baseUrl`, while continuing to use PATs for authentication.
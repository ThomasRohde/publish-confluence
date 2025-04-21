// src/types.ts

/**
 * Authentication credentials for the Confluence API
 */
export interface ConfluenceApiCredentials {
  /** Personal Access Token for authentication */
  token: string;
}

/**
 * Configuration for the Confluence client
 */
export interface ConfluenceClientConfig {
  /** Base URL for the Confluence instance, e.g., https://your-domain.atlassian.net/wiki */
  baseUrl: string;
  /** Authentication credentials */
  auth: ConfluenceApiCredentials;
  /** Enable verbose logging */
  verbose?: boolean;
  /** Custom Axios configuration */
  axiosConfig?: any;
  /** Whether to reject unauthorized SSL certificates (defaults to true) */
  rejectUnauthorized?: boolean;
  /** Custom error handler function that can suppress specific errors */
  customErrorHandler?: (error: any) => boolean;
}

/**
 * Configuration for publishing content to Confluence
 */
export interface PublishConfig {
  /** Confluence space key where the page will be published */
  spaceKey: string;
  /** Title of the page to create or update */
  pageTitle: string;
  /** Title of the parent page (optional) */
  parentPageTitle?: string;
  /** Path to the Confluence page template file (optional, uses default if not provided) */
  templatePath: string;
  /** Path to the HTML macro template file (null if no macro/attachments should be used) */
  macroTemplatePath: string | null;
  /** Array of glob patterns for files to include as attachments */
  includedFiles: string[];
  /** Array of glob patterns for files to exclude from attachments */
  excludedFiles: string[];
  /** Directory containing build output files (defaults to './dist') */
  distDir: string;
  /** Nested child pages to publish under this page */
  childPages?: PublishConfig[];
}

/**
 * Command line options for the publish-confluence tool
 */
export interface PublishOptions {
  /** Suppress all output except errors */
  quiet: boolean;
  /** Enable verbose output */
  verbose: boolean;
  /** Enable debug output (includes verbose) */
  debug: boolean;
  /** Allow self-signed SSL certificates */
  allowSelfSigned: boolean;
}

/**
 * Represents a Confluence space
 */
export interface ConfluenceSpace {
  /** Unique identifier for the space */
  id: number;
  /** Space key, used in URLs and API calls */
  key: string;
  /** Display name of the space */
  name: string;
  /** The homepage of the space, only populated if expanded in the API call */
  homepage?: ConfluencePage;
  /** Links related to this space */
  _links: {
    /** Web UI link to access this space */
    webui: string;
    /** API endpoint for this space */
    self: string;
  };
}

/**
 * Represents a version of Confluence content
 */
export interface ConfluenceVersion {
    /** Version number */
    number: number;
    /** Optional message describing the version change */
    message?: string;
    /** Whether this was a minor edit */
    minorEdit: boolean;
    // Add author, date etc. if needed
}

/**
 * Represents an ancestor of a Confluence page
 */
export interface ConfluenceAncestor {
    /** Page ID of the ancestor */
    id: string;
}

/**
 * Represents the body content of a Confluence page
 */
export interface ConfluenceBody {
    /** Storage format representation (XHTML-based) */
    storage: {
        /** The content in Confluence Storage Format (XHTML-based) */
        value: string;
        /** The format identifier */
        representation: 'storage';
    };
    // Other representations like 'view', 'export_view' might be present in responses
}

/**
 * Represents a Confluence page or other content item
 */
export interface ConfluencePage {
  /** Unique identifier for the page */
  id: string;
  /** Type of content */
  type: 'page' | 'blogpost' | 'comment' | 'attachment';
  /** Current status of the content */
  status: 'current' | 'draft' | 'trashed' | 'historical';
  /** Title of the page */
  title: string;
  /** Space information, may not be present on all endpoints unless expanded */
  space?: { key: string };
  /** Version information, only populated if expanded */
  version?: ConfluenceVersion;
  /** Ancestor pages, only populated if expanded */
  ancestors?: ConfluenceAncestor[];
  /** Page body content, only populated if expanded */
  body?: ConfluenceBody;
  /** Links related to this page */
  _links: {
    /** Web UI link to access this page */
    webui: string;
    /** API endpoint for this page */
    self: string;
    // ... other links
  };
}

/**
 * Represents an array of Confluence content items with pagination information
 * @template T The type of content items in the array
 */
export interface ConfluenceContentArray<T> {
    /** Array of content items */
    results: T[];
    /** Starting index for pagination */
    start: number;
    /** Maximum number of items to return */
    limit: number;
    /** Actual number of items returned */
    size: number;
    /** Links related to this content array */
    _links: {
        /** Base URL for API calls */
        base: string;
        /** Context path */
        context: string;
        /** URL for the next page of results, if available */
        next?: string;
        /** URL for this results page */
        self: string;
    };
}

/**
 * Represents a file attachment in Confluence
 */
export interface ConfluenceAttachment {
    /** Unique identifier for the attachment */
    id: string;
    /** Content type, always 'attachment' for attachments */
    type: 'attachment';
    /** Current status of the attachment */
    status: 'current';
    /** Filename of the attachment */
    title: string;
    /** Version information, if expanded */
    version?: ConfluenceVersion;
    /** Additional information about the file */
    extensions?: {
        /** MIME type of the file */
        mediaType: string;
        /** Size of the file in bytes */
        fileSize: number;
        /** Optional comment for the attachment */
        comment?: string;
    };
    /** Links related to this attachment */
    _links: {
        /** Web UI link to access this attachment */
        webui: string;
        /** API endpoint for this attachment */
        self: string;
        /** Direct download link for the attachment */
        download: string;
    };
}

/**
 * Information about the Confluence server
 */
export interface ServerInfo {
  /** Base URL of the Confluence instance */
  baseUrl: string;
  /** Build number of the Confluence instance */
  buildNumber: number;
  /** Display name of the Confluence instance */
  displayName: string;
  /** Major version number */
  majorVersion: number;
  /** Minor version number */
  minorVersion: number;
  /** Patch level */
  patchLevel: number;
  /** Whether this is a development build */
  developmentBuild: boolean;
  /** Title of the server */
  serverTitle: string;
  /** Source control management information */
  scmInfo: string;
  /** Date when this version was built */
  buildDate: string;
}

/**
 * Information about a Confluence user
 */
export interface ConfluenceUser {
  /** Type of user account */
  type: 'known' | 'unknown' | 'anonymous' | 'user';
  /** Username for the account */
  username: string;
  /** Unique key for the user */
  userKey: string;
  /** Profile picture information */
  profilePicture: {
    /** Path to the profile image */
    path: string;
    /** Width of the profile image */
    width: number;
    /** Height of the profile image */
    height: number;
    /** Whether this is the default profile image */
    isDefault: boolean;
  };
  /** Display name of the user */
  displayName: string;
  /** Links related to this user */
  _links: {
    /** API endpoint for this user */
    self: string;
    /** Base URL for API calls */
    base: string;
    /** Context path */
    context: string;
  };
  /** Expandable properties that can be included in future requests */
  _expandable?: {
    /** Operations this user can perform */
    operations?: string;
    /** Personal space of this user */
    personalSpace?: string;
  };
}

/**
 * Information about a user group in Confluence
 */
export interface UserGroup {
  /** Type of group, always 'group' */
  type: 'group';
  /** Name of the group */
  name: string;
  /** Links related to this group */
  _links: {
    /** API endpoint for this group */
    self: string;
  };
}

/**
 * Response containing a list of user groups
 */
export interface UserGroupsResponse {
  /** Array of user groups */
  results: UserGroup[];
  /** Number of groups returned */
  size: number;
  /** Starting index for pagination */
  start: number;
  /** Maximum number of groups to return */
  limit: number;
  /** Links related to this response */
  _links: {
    /** API endpoint for this response */
    self: string;
    /** Base URL for API calls */
    base: string;
    /** Context path */
    context: string;
  };
}

/**
 * Response containing information about content watchers
 */
export interface ContentWatchersResponse {
  /** Information about users watching the content */
  watchers: {
    /** Array of users watching the content */
    results: ConfluenceUser[];
    /** Starting index for pagination */
    start: number;
    /** Maximum number of watchers to return */
    limit: number;
    /** Number of watchers returned */
    size: number;
    /** Links related to this watchers list */
    _links: {
      /** API endpoint for this watchers list */
      self: string;
      /** Base URL for API calls */
      base: string;
      /** Context path */
      context: string;
    };
  };
  /** Information about the current user's watch status */
  watch: {
    /** Whether the current user is watching the content */
    watching: boolean;
    /** Links related to this watch status */
    _links: {
      /** API endpoint for this watch status */
      self: string;
    };
  };
}

/**
 * Status of watching content for a user
 */
export interface WatchStatus {
  /** Whether the user is watching the content */
  watching: boolean;
  /** Links related to this watch status */
  _links: {
    /** API endpoint for this watch status */
    self: string;
  };
}

/**
 * Response for a space-related task
 */
export interface SpaceTaskResponse {
  /** Unique identifier for the task */
  id: string;
  /** Name of the task */
  name: string;
  /** Current status of the task */
  status: 'waiting' | 'running' | 'complete' | 'failed';
  /** Optional message providing details about the task */
  message?: string;
  /** Result information if the task is complete */
  result?: {
    /** Additional information about the result */
    additional: {
      /** Whether the task was successful */
      successful?: boolean;
      /** Status message */
      status?: string;
    };
  };
  /** Percentage of task completion (0-100) */
  percentageComplete: number;
  /** Time elapsed since task started (in milliseconds) */
  elapsed: number;
  /** ISO timestamp when the task was created */
  created: string;
  /** Links related to this task */
  _links: {
    /** Link to check the task status */
    status: string;
    /** API endpoint for this task */
    self: string;
  };
}

/**
 * Standard REST error format from OpenAPI specification
 */
export interface RestError {
  /** HTTP status code */
  statusCode: number;
  /** Error message */
  message: string;
  /** Additional error data */
  data?: Record<string, unknown>;
}

/**
 * Legacy error format specific to Confluence API
 */
export interface ConfluenceApiErrorData {
  /** HTTP status code */
  statusCode: number;
  /** Error message */
  message: string;
  /** Additional error details */
  data?: {
    /** Whether the user is authorized */
    authorized?: boolean;
    /** Whether the request is valid */
    valid?: boolean;
    /** Array of specific errors */
    errors?: any[];
    /** Whether the operation was successful */
    successful?: boolean;
  };
}
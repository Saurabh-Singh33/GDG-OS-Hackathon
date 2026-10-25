/**
 * GitHub API Helper Utilities
 */

/**
 * Parses a GitHub repository URL or string into owner and repo.
 * Accepts:
 *   - "https://github.com/owner/repo"
 *   - "github.com/owner/repo"
 *   - "owner/repo"
 *
 * @param {string} url
 * @returns {{ owner: string, repo: string }}
 */
export function parseRepoUrl(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('Invalid repository URL');
  }

  const cleaned = url.trim().replace(/\/+$/, '').replace(/\.git$/, '');
  const match = cleaned.match(/^(?:https?:\/\/)?(?:github\.com\/)?([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/);

  if (!match) {
    throw new Error('Invalid repository URL');
  }

  return {
    owner: match[1],
    repo: match[2],
  };
}

/**
 * Parses a GitHub issue URL or string into owner, repo, and issue number.
 * Accepts:
 *   - "https://github.com/owner/repo/issues/123"
 *   - "owner/repo/issues/123"
 *
 * @param {string} url
 * @returns {{ owner: string, repo: string, number: number }}
 */
export function parseIssueUrl(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('Invalid issue URL');
  }

  const cleaned = url.trim().replace(/\/+$/, '');
  const match = cleaned.match(/^(?:https?:\/\/)?(?:github\.com\/)?([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)\/issues\/(\d+)$/);

  if (!match) {
    throw new Error('Invalid issue URL');
  }

  return {
    owner: match[1],
    repo: match[2],
    number: parseInt(match[3], 10),
  };
}

/**
 * Fetches the raw Markdown content of a repository's README.
 *
 * @param {string} owner
 * @param {string} repo
 * @returns {Promise<string>}
 */
export async function fetchReadme(owner, repo) {
  try {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, {
      headers: {
        Accept: 'application/vnd.github.raw+json',
      },
    });

    if (!response.ok) {
      throw new Error('README not found or repo does not exist');
    }

    return await response.text();
  } catch (err) {
    if (err.message === 'README not found or repo does not exist') {
      throw err;
    }
    throw new Error('README not found or repo does not exist');
  }
}

/**
 * Fetches up to 200 file paths from the repository's git tree.
 * Checks branch "main" first, falling back to "master".
 *
 * @param {string} owner
 * @param {string} repo
 * @returns {Promise<string[]>}
 */
export async function fetchTree(owner, repo) {
  try {
    let response = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`);

    if (!response.ok) {
      response = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/master?recursive=1`);
    }

    if (!response.ok) {
      throw new Error('Could not load file tree');
    }

    const data = await response.json();

    if (!data || !Array.isArray(data.tree)) {
      throw new Error('Could not load file tree');
    }

    return data.tree
      .filter((item) => item.type === 'blob')
      .map((item) => item.path)
      .slice(0, 200);
  } catch (err) {
    if (err.message === 'Could not load file tree') {
      throw err;
    }
    throw new Error('Could not load file tree');
  }
}

/**
 * Fetches issue details including title, body, and labels.
 *
 * @param {string} owner
 * @param {string} repo
 * @param {number|string} number
 * @returns {Promise<{ title: string, body: string, labels: string[] }>}
 */
export async function fetchIssue(owner, repo, number) {
  try {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${number}`);

    if (!response.ok) {
      throw new Error('Issue not found');
    }

    const data = await response.json();
    const labels = Array.isArray(data.labels)
      ? data.labels.map((label) => (typeof label === 'string' ? label : label.name))
      : [];

    return {
      title: data.title || '',
      body: data.body || '',
      labels,
    };
  } catch (err) {
    if (err.message === 'Issue not found') {
      throw err;
    }
    throw new Error('Issue not found');
  }
}

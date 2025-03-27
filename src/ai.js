const OpenAI = require('openai').default;
const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": process.env.BASE_URL,
    "X-Title": process.env.APP_NAME,
  },
});

// Regex for direct branch detection
const BRANCH_REGEX = /(GEO|ADM|GDM)-\d+/g;

// Cache for LLM responses to avoid duplicate calls
const branchDetectionCache = new Map();

async function detectBranchesWithAI(content) {
    const cacheKey = content.substring(0, 100); // Use beginning as cache key
    if (branchDetectionCache.has(cacheKey)) {
        return branchDetectionCache.get(cacheKey);
    }

    const prompt = `
    Analyze this deployment request and identify all relevant branch names.
    Branch naming conventions:
    - GEO-XXX for GeoredV3 features
    - ADM-XXX for AdminV3 features  
    - GDM-XXX for Citimission features

    Context clues:
    - "v3" typically indicates GEO-
    - Issue URLs should be converted to branch numbers
    - French text may contain branch references

    Input:
    ${content}

    Respond ONLY with a JSON array of branch names, or empty array if none found.
    Example: {"branches": ["GEO-47827", "ADM-12345"]}
    `;

    try {
        const completion = await openai.chat.completions.create({
            model: "openai/gpt-4",
            messages: [{
                role: "user",
                content: prompt
            }],
            response_format: { type: "json_object" },
            temperature: 0.1
        });

        const result = JSON.parse(completion.choices[0].message.content);
        const branches = result.branches || [];
        branchDetectionCache.set(cacheKey, branches);
        return branches;
    } catch (err) {
        console.error('AI branch detection failed:', {
            message: err.message,
            stack: err.stack,
            axiosResponse: err.isAxiosError ? err.response?.data : undefined
        });
        return [];
    }
}

function extractBranchesFromText(content) {
    // First try direct regex matching
    const directMatches = content.match(BRANCH_REGEX) || [];
    if (directMatches.length > 0) {
        return [...new Set(directMatches)];
    }

    // Fall back to AI detection if no direct matches
    return detectBranchesWithAI(content);
}

function parseVersion(version) {
    if (!version) return { major: 0, minor: 0, patch: 0, rc: 0 };
    
    const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-RC(\d+))?$/);
    if (!match) return { major: 0, minor: 0, patch: 0, rc: 0 };
    
    return {
        major: parseInt(match[1], 10),
        minor: parseInt(match[2], 10),
        patch: parseInt(match[3], 10),
        rc: match[4] ? parseInt(match[4], 10) : 0
    };
}

function calculateNextTag(prodTag, preprodTag) {
    const prod = parseVersion(prodTag);
    const preprod = parseVersion(preprodTag);
    
    if (preprod.major > prod.major || 
        preprod.minor > prod.minor || 
        preprod.patch > prod.patch) {
        // Increment RC number
        return `${preprod.major}.${preprod.minor}.${preprod.patch}-RC${preprod.rc + 1}`;
    } else {
        // Increment patch and reset RC
        return `${prod.major}.${prod.minor}.${prod.patch + 1}-RC1`;
    }
}

module.exports = {
    extractBranchesFromText,
    calculateNextTag,
    parseVersion,
    detectBranchesWithAI
};
const axios = require('axios');
const { URL } = require('url');

class TypeScriptExportExtractor {
    constructor(baseUrl = 'https://github.com/anon-dot-com/actions/blob/main/src/app') {
        this.baseUrl = baseUrl.replace(/\/$/, '');
        
        this.patterns = {
            exported_const: 'export\\s+const\\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\\s*=',
            async_function: [
                // Regular async function declarations
                'async\\s+function\\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\\s*\\(',
                // Async arrow functions assigned to variables
                'const\\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\\s*=\\s*async\\s*\\(',
                // Exported async functions
                'export\\s+async\\s+function\\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\\s*\\(',
                // Exported const async arrow functions
                'export\\s+const\\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\\s*=\\s*async\\s*\\(',
                // Class methods that are async
                'async\\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\\s*\\(',
            ]
        };
    }

    _buildUrl(provider) {
        console.log(`${this.baseUrl}/${provider}.ts`)
        return `${this.baseUrl}/${provider}.ts`;
    }

    _convertToRawUrl(githubUrl) {
        const parsed = new URL(githubUrl);
        if (!parsed.hostname.includes('github.com')) {
            throw new Error('Not a GitHub URL');
        }
        
        const pathParts = parsed.pathname.split('/');
        const blobIndex = pathParts.indexOf('blob');
        if (blobIndex !== -1) {
            pathParts.splice(blobIndex, 1);
        }
        
        return `https://raw.githubusercontent.com${pathParts.join('/')}`;
    }

    _removeComments(code) {
        // Remove multi-line comments
        code = code.replace(/\/\*[\s\S]*?\*\//g, '');
        // Remove single-line comments
        code = code.replace(/\/\/.*$/gm, '');
        return code;
    }

    _extractMatches(content, patterns) {
        const matches = new Set();
        const patternArray = Array.isArray(patterns) ? patterns : [patterns];
        
        for (const pattern of patternArray) {
            const regex = new RegExp(pattern, 'gm');
            let match;
            while ((match = regex.exec(content)) !== null) {
                matches.add(match[1]);
            }
        }
        
        return matches;
    }

    async extractFunctions(provider) {
        try {
            const githubUrl = this._buildUrl(provider);
            const rawUrl = this._convertToRawUrl(githubUrl);
            const response = await axios.get(rawUrl);
            const content = response.data;

            const cleanContent = this._removeComments(content);
            const allFunctions = new Set();
            
            const exportedConsts = this._extractMatches(cleanContent, this.patterns.exported_const);
            exportedConsts.forEach(fn => allFunctions.add(fn));
            
            const asyncFunctions = this._extractMatches(cleanContent, this.patterns.async_function);
            asyncFunctions.forEach(fn => allFunctions.add(fn));

            const sortedFunctions = Array.from(allFunctions).sort();

            return { actionSpace: sortedFunctions };

        } catch (error) {
            if (axios.isAxiosError(error)) {
                throw new Error(`Error fetching TypeScript file for provider ${provider}: ${error.message}`);
            }
            throw new Error(`Error processing TypeScript file for provider ${provider}: ${error.message}`);
        }
    }
}

async function main() {
    // Get command line arguments
    const args = process.argv.slice(2); // Remove 'node' and script name from args

    if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
        console.log(`
Usage: node script.js <provider> [--base-url <url>]

Arguments:
  provider       Name of the provider (without .ts extension)

Options:
  --base-url    Base URL for the GitHub repository
                (default: https://github.com/anon-dot-com/actions/blob/main/src/app)
  --help, -h    Show this help message
        `);
        process.exit(0);
    }

    const provider = args[0];
    let baseUrl = "https://github.com/anon-dot-com/actions/blob/main/src/app";

    // Check for --base-url option
    const baseUrlIndex = args.indexOf('--base-url');
    if (baseUrlIndex !== -1 && args[baseUrlIndex + 1]) {
        baseUrl = args[baseUrlIndex + 1];
    }

    try {
        const extractor = new TypeScriptExportExtractor(baseUrl);
        const result = await extractor.extractFunctions(provider);
        console.log(JSON.stringify(result, null, 2));
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
}

// Only run if this file is being run directly
if (require.main === module) {
    main();
}

module.exports = TypeScriptExportExtractor;
const { chromium } = require('playwright');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class ComplianceAnalyzer {
    constructor(options = {}) {
        this.outputDir = options.outputDir || './output';
        this.apiKey = options.apiKey || "fkd8493jg7392bduw";
        this.apiUrl = options.apiUrl || "http://fc-api.hypernym.ai/analyze_sync";
        this.baseGithubUrl = options.baseGithubUrl || 'https://github.com/anon-dot-com/actions/blob/main/src/app';
        this.results = {
            timestamp: new Date().toISOString(),
            websiteInfo: null,
            semanticAnalysis: null,
            userDataAnalysis: null,
            actionSpace: null
        };
    }

    async initialize() {
        await fs.mkdir(this.outputDir, { recursive: true });
    }

    async saveResults() {
        const outputPath = path.join(this.outputDir, 'compliance_analysis.json');
        await fs.writeFile(outputPath, JSON.stringify(this.results, null, 2));
        return outputPath;
    }

    async extractWebsiteInfo(websiteOrBrand) {
        const browser = await chromium.launch({ headless: true });
        const context = await browser.newContext();
        const page = await context.newPage();
        
        try {
            const mainSearchQuery = encodeURIComponent(websiteOrBrand);
            await page.goto(`https://www.google.com/search?q=${mainSearchQuery}`);
            
            const firstResult = await page.waitForSelector('div.g a', { timeout: 5000 });
            const mainWebsiteUrl = await firstResult.getAttribute('href');
            
            await page.goto(mainWebsiteUrl);
            
            const mainMetadata = await page.evaluate(() => ({
                title: document.title || null,
                description: document.querySelector('meta[name="description"]')?.content || null,
                keywords: document.querySelector('meta[name="keywords"]')?.content || null,
                author: document.querySelector('meta[name="author"]')?.content || null
            }));

            const tosSearchQuery = encodeURIComponent(`${websiteOrBrand} terms of service OR terms and conditions`);
            await page.goto(`https://www.google.com/search?q=${tosSearchQuery}`);
            
            const tosResult = await page.waitForSelector('div.g a', { timeout: 5000 });
            const tosUrl = await tosResult.getAttribute('href');
            
            await page.goto(tosUrl);
            
            const tosContent = await page.evaluate(() => {
                return document.body.innerText.replace(/\s+/g, ' ').trim();
            });

            const messageHistory = await this.getMessageHistory();

            this.results.websiteInfo = {
                mainWebsite: {
                    url: mainWebsiteUrl,
                    metadata: mainMetadata,
                    extractedAt: new Date().toISOString()
                },
                termsOfService: {
                    url: tosUrl,
                    plainText: tosContent,
                    extractedAt: new Date().toISOString()
                },
                messageHistory
            };
            
            return this.results.websiteInfo;
        } finally {
            await browser.close();
        }
    }

    async getMessageHistory() {
        try {
            return await fs.readFile('allMessages.txt', 'utf8');
        } catch {
            try {
                return await fs.readFile('dummyLinkedIn.txt', 'utf8');
            } catch {
                console.warn('No message history found');
                return '';
            }
        }
    }

    async semanticCompression(inputData) {
        const payload = {
            essay_text: inputData.termsOfService.plainText,
            message_history: inputData.messageHistory || ""
        };

        try {
            const response = await axios.post(this.apiUrl, payload, {
                headers: {
                    "Content-Type": "application/json",
                    "X-API-Key": this.apiKey
                }
            });

            this.results.semanticAnalysis = response.data;
            return response.data;
        } catch (error) {
            console.error('Semantic compression failed:', error.message);
            return null;
        }
    }

    async userDataCompression(textContent) {
        try {
            const response = await axios.post(this.apiUrl, {
                essay_text: textContent,
                message_history: ""
            }, {
                headers: {
                    "Content-Type": "application/json",
                    "X-API-Key": this.apiKey
                }
            });

            this.results.userDataAnalysis = response.data;
            return response.data;
        } catch (error) {
            console.error('User data compression failed:', error.message);
            return null;
        }
    }

    async extractActionSpace(provider) {
        try {
            const githubUrl = `${this.baseGithubUrl}/${provider}.ts`;
            const rawUrl = githubUrl.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
            
            const response = await axios.get(rawUrl);
            const content = response.data;

            const cleanContent = content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
            
            const patterns = {
                exported_const: /export\s+const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/g,
                async_function: /async\s+(?:function\s+)?([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g
            };

            const functions = new Set();
            
            for (const pattern of Object.values(patterns)) {
                let match;
                while ((match = pattern.exec(cleanContent)) !== null) {
                    functions.add(match[1]);
                }
            }

            this.results.actionSpace = {
                actionSpace: Array.from(functions).sort()
            };
            
            return this.results.actionSpace;
        } catch (error) {
            console.error('Action space extraction failed:', error.message);
            return null;
        }
    }

    async analyze(websiteOrBrand) {
        await this.initialize();
        
        try {
            console.log('Extracting website information...');
            await this.extractWebsiteInfo(websiteOrBrand);

            console.log('Performing semantic analysis...');
            await this.semanticCompression(this.results.websiteInfo);

            console.log('Analyzing user data...');
            await this.userDataCompression(this.results.websiteInfo.termsOfService.plainText);

            console.log('Extracting action space...');
            await this.extractActionSpace(websiteOrBrand);

            const outputPath = await this.saveResults();
            console.log(`Analysis results saved to: ${outputPath}`);

            return this.results;
        } catch (error) {
            console.error('Analysis failed:', error);
            throw error;
        }
    }
}

async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0 || args.includes('--help')) {
        console.log(`
Usage: node compliance.js <website-or-brand> <provider> [options]

Options:
  --output-dir <dir>    Output directory for results (default: ./output)
  --api-key <key>       Custom API key for analysis
  --api-url <url>       Custom API URL for analysis
  --github-url <url>    Custom GitHub base URL for action space extraction
  --help               Show this help message
        `);
        process.exit(0);
    }

    const websiteOrBrand = args[0];
    const provider = args[1];
    
    const options = {
        outputDir: args.includes('--output-dir') ? args[args.indexOf('--output-dir') + 1] : './output',
        apiKey: args.includes('--api-key') ? args[args.indexOf('--api-key') + 1] : undefined,
        apiUrl: args.includes('--api-url') ? args[args.indexOf('--api-url') + 1] : undefined,
        baseGithubUrl: args.includes('--github-url') ? args[args.indexOf('--github-url') + 1] : undefined
    };

    const analyzer = new ComplianceAnalyzer(options);
    
    try {
        await analyzer.analyze(websiteOrBrand);
        console.log('Analysis completed successfully');
    } catch (error) {
        console.error('Analysis failed:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = ComplianceAnalyzer;